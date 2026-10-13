const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('../backend/node_modules/mongoose');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { chromium } = require('../frontend/node_modules/playwright');
const staticHandler = require('../frontend/node_modules/serve-handler');

// Never use the application's database. Each run owns a unique disposable DB.
const dbName = `pinkmeup_regression_${crypto.randomBytes(8).toString('hex')}`;
Object.assign(process.env, {
  NODE_ENV: 'test', PORT: '5000', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  SESSION_SECRET: crypto.randomBytes(32).toString('hex'), JWT_EXPIRES_IN: '7d', FRONTEND_URL: 'http://localhost',
  MONGODB_URI: process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017'
});
for (const key of ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[key];
const app = require('../backend/src/app');
const User = require('../backend/src/models/User.model');
const Service = require('../backend/src/models/Service.model');
const Stylist = require('../backend/src/models/Stylist.model');
const Appointment = require('../backend/src/models/Appointment.model');
const Settings = require('../backend/src/models/BusinessSetting.model');
let server, origin, browser, service, stylist, customer, admin, token, date;
const password = 'Regression123!';
const guest = { guestName: 'Quick Guest', guestEmail: 'quick@example.com', guestPhone: '+27821234567' };
const asJSON = (body, headers = {}) => ({method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)});
async function request(route, status, options) {
  const response = await fetch(origin + '/api/v1' + route, options);
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return { response, data };
}
function booking(overrides = {}) {
  return { serviceIds: [String(service._id)], stylistId: null, date, startTime: '10:00', ...guest, ...overrides };
}
async function pageWithErrors(context) {
  const page = await context.newPage();
  const errors = [];
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => {errors.push(error.message); console.error('Browser error:', error.message);});
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  return { page, errors };
}
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {dbName, serverSelectionTimeoutMS: 5000});
  const makeUser = (email, role) => User.create({firstName: 'Test', lastName: 'User', email, phone: '+27821234567', password, role});
  const stylistUser = await makeUser('stylist@example.com', 'stylist');
  customer = await makeUser('customer@example.com', 'customer');
  admin = await makeUser('admin@example.com', 'admin');
  service = await Service.create({name: 'Regression Service', category: 'Hair', price: 150, duration: 60});
  stylist = await Stylist.create({userId: stylistUser._id, serviceIds: [service._id]});
  await Settings.create({});
  token = jwt.sign({id: customer._id}, process.env.JWT_SECRET);
  const target = new Date(); target.setDate(target.getDate() + 7);
  if (target.getDay() === 6) target.setDate(target.getDate() + 2);
  if (target.getDay() === 0) target.setDate(target.getDate() + 1);
  date = `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(target.getDate()).padStart(2,'0')}`;
  server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/health')) return app(req, res);
    return staticHandler(req, res, {public: path.resolve(__dirname, '../frontend'), ...require('../frontend/serve.json')});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  process.env.FRONTEND_URL = origin;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({executablePath, args: ['--no-sandbox']});
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('guest validation rejects missing details and failed bookings do not create users', async () => {
  await request('/bookings', 400, asJSON(booking({guestPhone: ''})));
  await request('/bookings', 404, asJSON(booking({serviceIds: [new mongoose.Types.ObjectId().toString()]})));
  assert.equal(await User.countDocuments({email: guest.guestEmail}), 0);
  await request('/guest-bookings', 400, asJSON({serviceIds: [String(service._id)], date, startTime: '10:00'}));
});

test('availability rejects malformed IDs and unavailable services, and returns stylist names', async () => {
  await request(`/bookings/availability/time-slots?date=${date}&serviceIds=invalid`, 400);
  await request(`/bookings/availability/time-slots?date=2026-02-30`, 400);
  await request(`/bookings/availability/time-slots?date=${date}&stylistId=broken`, 400);
  await request(`/bookings/availability/time-slots?date=${date}&serviceIds=${new mongoose.Types.ObjectId()}`, 400);
  const result = await request(`/bookings/availability/stylist?date=${date}&stylistId=${stylist._id}`, 200);
  assert.equal(result.data.data.stylist.name, 'Test User');
});

test('Quick Book completes in a browser without an account, with automatic stylist assignment', async () => {
  const context = await browser.newContext();
  try {
    const {page, errors} = await pageWithErrors(context);
    const protectedRequests = [];
    page.on('request', req => {if (/auth\/profile|bookings\/my/.test(req.url())) protectedRequests.push(req.url());});
    await page.goto(origin + '/index.html');
    await page.getByRole('link', {name: 'QUICK BOOK', exact: true}).click();
    await page.waitForSelector('#book-view.active .svc-card');
    assert.ok(page.url().includes('guest=1'));
    await page.locator('.svc-card').first().click();
    await page.locator('#wNext').click();
    for (let month = 0; month < 2 && !await page.locator(`[data-date="${date}"]`).count(); month++) {
      await page.locator('[onclick="changeMonth(1)"]').click();
    }
    await page.locator(`[data-date="${date}"]`).click();
    await page.waitForSelector('.time-slot');
    await page.locator('.time-slot').filter({hasText: /^10:00$/}).click();
    await page.locator('#wNext').click();
    await page.locator('#detName').fill(guest.guestName);
    await page.locator('#detEmail').fill(guest.guestEmail);
    await page.locator('#detPhone').fill(guest.guestPhone);
    await page.locator('#detNotes').fill('<img src=x onerror="window.reviewInjected=true">');
    await page.locator('#wNext').click();
    assert.equal(await page.locator('#reviewCard img').count(), 0);
    assert.ok((await page.locator('#reviewCard').textContent()).includes('<img src=x'));
    await page.locator('#wNext').click();
    await page.waitForSelector('#confirmationModal.open');
    assert.equal(await page.locator('#confirmStylist').textContent(), 'Test User');
    assert.equal(await page.locator('#confirmTotal').textContent(), 'R150');
    assert.equal(await page.locator('#confirmGuest').textContent(), guest.guestName);
    await page.locator('#confirmationModal .btn-ghost').click();
    await page.waitForSelector('#book-view.active');
    assert.deepEqual(errors, []);
    assert.deepEqual(protectedRequests, []);
    const user = await User.findOne({email: guest.guestEmail});
    const appointment = await Appointment.findOne({customerId: user._id});
    assert.equal(String(appointment.stylistId), String(stylist._id));
    assert.equal(appointment.isWalkIn, false);
  } finally {await context.close();}
});

test('occupied time is rejected, disabled customers and non-customer guests are rejected', async () => {
  await Appointment.create({customerId: customer._id, stylistId: stylist._id, serviceIds: [service._id], date, startTime: '13:00', endTime: '14:00', totalDuration:60, totalPrice:150, status:'confirmed'});
  await request('/bookings', 409, asJSON(booking({startTime:'13:00'})));
  await request('/bookings', 400, asJSON(booking({guestEmail: admin.email, startTime: '12:00'})));
  await User.updateOne({_id: customer._id}, {isActive: false});
  await request('/bookings', 403, asJSON(booking({guestEmail: customer.email, startTime: '12:00'})));
  await User.updateOne({_id: customer._id}, {isActive: true});
  const result = await request(`/bookings/availability/time-slots?date=${date}&serviceIds=${service._id}`, 200);
  assert.ok(!result.data.data.availableSlots.includes('13:00'));
});

test('admin walk-ins use the same eligibility rules and are recorded as walk-ins', async () => {
  const adminToken = jwt.sign({id: admin._id}, process.env.JWT_SECRET);
  const payload = {firstName: 'Walk', lastName: 'In', email: 'walkin@example.com', phone: '+27821234567', serviceIds: [String(service._id)], stylistId: String(stylist._id), date, startTime: '12:00'};
  await User.updateOne({_id: stylist.userId}, {isActive: false});
  await request('/admin/bookings', 400, asJSON(payload, {Authorization: `Bearer ${adminToken}`}));
  assert.equal(await User.countDocuments({email: payload.email}), 0);
  await User.updateOne({_id: stylist.userId}, {isActive: true});
  const result = await request('/admin/bookings', 201, asJSON(payload, {Authorization: `Bearer ${adminToken}`}));
  assert.equal(result.data.data.isWalkIn, true);
  assert.equal(result.data.data.customerId.email, payload.email);
});

test('valid bearer session takes precedence over a stale cookie and loads the customer dashboard', async () => {
  const headers = {Authorization: `Bearer ${token}`, Cookie: 'token=stale-cookie'};
  const result = await request('/auth/profile', 200, {headers});
  assert.equal(result.data.data.user.email, customer.email);
  const context = await browser.newContext();
  try {
    await context.addInitScript(token => {localStorage.setItem('authToken', token);}, token);
    await context.addCookies([{name: 'token', value: 'stale-cookie', url: origin}]);
    const {page, errors} = await pageWithErrors(context);
    const unauthorized = [];
    page.on('response', response => {if (response.url().startsWith(origin+'/api/') && response.status() === 401) unauthorized.push(response.url());});
    await page.goto(origin + '/customerdashboard.html');
    await page.waitForFunction(() => document.getElementById('detPhone').value === '+27821234567');
    await page.waitForSelector('#svcGrid .svc-card', {state: 'attached'});
    assert.deepEqual(unauthorized, []);
    assert.deepEqual(errors, []);
    assert.ok(!page.url().includes('login'));
  } finally {await context.close();}
});

test('stale local customer sessions redirect to sign-in; stale quick-book sessions still allow guests', async () => {
  for (const guestMode of [false, true]) {
    const context = await browser.newContext();
    try {
      await context.addInitScript(() => {localStorage.setItem('user', JSON.stringify({role:'customer',firstName:'Stale'})); localStorage.setItem('authToken','expired');});
      await context.addCookies([{name:'token',value:'expired',url:origin}]);
      const {page, errors} = await pageWithErrors(context);
      await page.goto(origin+'/customerdashboard.html'+(guestMode?'?guest=1':''));
      if (guestMode) await page.waitForSelector('#book-view.active .svc-card');
      else await page.waitForURL(/\/login(?:\.html)?$/);
      assert.deepEqual(errors, []);
    } finally {await context.close();}
  }
});

test('password reset reports unavailable SMTP and token links render a working new-password form', async () => {
  await request('/auth/forgot-password', 503, asJSON({email: customer.email}));
  const unchanged = await User.findById(customer._id);
  assert.equal(unchanged.resetPasswordToken, undefined);
  const resetToken = crypto.randomBytes(32).toString('hex');
  await User.updateOne({_id: customer._id}, {resetPasswordToken: resetToken, resetPasswordExpires: new Date(Date.now()+3600000)});
  const context = await browser.newContext();
  try {
    const {page, errors} = await pageWithErrors(context);
    await page.goto(origin+'/reset.html?token='+resetToken);
    await page.locator('#new-password').fill('UpdatedPassword123');
    await page.locator('#reset-btn').click();
    await page.waitForSelector('#success.show');
    assert.ok((await page.locator('#success').textContent()).includes('Password reset successfully'));
    assert.ok(!page.url().includes('token='));
    assert.deepEqual(errors, []);
  } finally {await context.close();}
  await request('/auth/login', 200, asJSON({email: customer.email, password:'UpdatedPassword123'}));
  await request('/auth/reset-password', 400, asJSON({token: resetToken, newPassword:'OtherPassword123'}));
});

test('API configuration honors explicit overrides and normalizes trailing slashes', async () => {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {window.API_ORIGIN='https://api.example.com/';});
    const {page} = await pageWithErrors(context);
    await page.goto(origin+'/login.html');
    assert.equal(await page.evaluate(() => window.API_URL), 'https://api.example.com/api/v1');
    assert.equal(await page.locator('#google-auth').getAttribute('href'), 'https://api.example.com/api/v1/auth/google');
  } finally {await context.close();}
});

test('authenticated customers can book, reschedule and cancel their appointments', async () => {
  const headers = {Authorization: `Bearer ${token}`};
  const result = await request('/bookings', 201, asJSON(booking({startTime:'14:00', guestName:undefined, guestEmail:undefined, guestPhone:undefined}), headers));
  const id = result.data.data._id;
  assert.equal(result.data.data.customerId.email, customer.email);
  await request(`/bookings/${id}/reschedule`, 200, {...asJSON({date,startTime:'15:00'},headers),method:'PUT'});
  const updated = await Appointment.findById(id);
  assert.equal(updated.startTime, '15:00');
  assert.equal(updated.endTime, '16:00');
  await request(`/bookings/${id}/cancel`, 200, {...asJSON({reason:'Regression cleanup'},headers),method:'PUT'});
  assert.equal((await Appointment.findById(id)).status, 'cancelled');
});

test('late availability responses cannot restore stale date slots', async () => {
  const context = await browser.newContext();
  let release;
  try {
    const {page, errors} = await pageWithErrors(context);
    await page.goto(origin+'/customerdashboard.html?guest=1');
    await page.waitForSelector('#book-view.active .svc-card');
    await page.locator('.svc-card').first().click();
    await page.locator('#wNext').click();
    let firstStarted;
    const started = new Promise(resolve => {firstStarted = resolve;});
    const held = new Promise(resolve => {release = resolve;});
    let count = 0;
    await page.route('**/bookings/availability/time-slots?*', async route => {
      if (++count === 1) {firstStarted(); await held; await route.fulfill({json:{data:{availableSlots:['09:00']}}});}
      else await route.fulfill({json:{data:{availableSlots:[],message:'No slots for the new date'}}});
    });
    const selectDate = date => page.evaluate(value => {
      const input=document.getElementById('apptDate');input.value=value;input.dispatchEvent(new Event('change'));
    }, date);
    await selectDate(date);
    await started;
    await selectDate('2099-01-01');
    await page.waitForFunction(() => document.getElementById('timeSlots').textContent.includes('No slots for the new date'));
    release();
    await page.waitForResponse(response => response.url().includes('date='+date) && response.url().includes('time-slots'));
    // Wait for fetch and rendering microtasks from the old response.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.time-slot').count(), 0);
    assert.ok((await page.locator('#timeSlots').textContent()).includes('No slots for the new date'));
    assert.deepEqual(errors, []);
  } finally {release?.(); await context.close();}
});


test('public guest booking ignores expired account cookies', async () => {
  const result = await request('/guest-bookings', 201, asJSON({firstName:'Expired',lastName:'Session',email:'expired@example.com',phone:'+27821234567',serviceIds:[String(service._id)],date,startTime:'09:00'}, {Cookie:'token=expired'}));
  assert.equal(result.data.data.customerId.email, 'expired@example.com');
});
