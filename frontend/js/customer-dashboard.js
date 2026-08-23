document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const signOutBtn = document.getElementById('signOutBtn');

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
  if (signOutBtn) signOutBtn.addEventListener('click', signOut);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) closeSidebar();
  });
});

let SERVICES = [];
let CATEGORIES = [];

async function loadServices() {
  const res = await fetch(`${API_URL}/services?limit=100`, { credentials: 'include' });
  const data = await res.json();
  SERVICES = data.data.services.map(s => ({ id: s._id, category: s.category, name: s.name, price: s.price, duration: s.duration }));
  CATEGORIES = [...new Set(SERVICES.map(s => s.category))];
  activeCat = CATEGORIES[0];
}

let STYLISTS = [];

async function loadStylists() {
  const res = await fetch(`${API_URL}/stylists?limit=100`, { credentials: 'include' });
  const data = await res.json();
  STYLISTS = (data.data.stylists || []).map(s => ({
    id: s._id,
    name: [s.userId?.firstName, s.userId?.lastName].filter(Boolean).join(' ') || 'Stylist',
    isAvailable: s.isAvailable !== false,
    serviceIds: (s.serviceIds || []).map(id => id.toString ? id.toString() : id)
  }));
}

let appointments = [];

async function loadAppointments() {
  try {
    const res = await fetch(`${API_URL}/bookings/my?limit=100`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || !data?.data?.bookings) {
      appointments = [];
      return;
    }

    const now = new Date();

    appointments = data.data.bookings.map(b => {
      let displayStatus;
      if (b.status === 'cancelled') {
        displayStatus = 'cancelled';
      } else if (b.status === 'completed') {
        displayStatus = 'past';
      } else {
        const apptDateTime = new Date(b.date);
        const [h, m] = (b.startTime || '0:0').split(':').map(Number);
        apptDateTime.setHours(h, m, 0, 0);
        displayStatus = apptDateTime >= now ? 'upcoming' : 'past';
      }

      const appointmentDate = new Date(b.date);
      const localDate = !Number.isNaN(appointmentDate.getTime())
        ? `${appointmentDate.getFullYear()}-${String(appointmentDate.getMonth() + 1).padStart(2, '0')}-${String(appointmentDate.getDate()).padStart(2, '0')}`
        : String(b.date || '').slice(0, 10);

      return {
        id: b._id,
        services: (b.serviceIds || []).map(s => ({ id: s._id, name: s.name, price: s.price, duration: s.duration })),
        date: localDate,
        time: b.startTime,
        stylistId: b.stylistId?._id || b.stylistId || '',
        stylist: [b.stylistId?.userId?.firstName, b.stylistId?.userId?.lastName].filter(Boolean).join(' ') || 'Stylist',
        notes: b.notes,
        status: displayStatus,
        rawStatus: b.status
      };
    });
  } catch (error) {
    console.warn('Could not load appointments:', error);
    appointments = [];
  }
}

let wizardStep = 1;
let cartIds = [];
let activeCat = CATEGORIES[0];
let bookState = { date: '', time: '', stylistId: '', stylist: '' };
let availableSlots = [];
let rescheduleApptId = null;
let rescheduleAvailableSlots = [];
let rescheduleSelectedTime = '';
let isBookingSubmitting = false;

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`${viewId}-view`).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`).classList.add('active');

  if (viewId === 'overview') renderOverview();
  if (viewId === 'appointments') renderAppointments();
  if (viewId === 'book') resetWizard();
}

document.querySelectorAll('.nav-item').forEach(n =>
  n.addEventListener('click', () => switchView(n.dataset.view))
);

function renderOverview() {
  const total = appointments.length;
  const upcoming = appointments.filter(a => a.status === 'upcoming').length;
  const spend = appointments.filter(a => a.status !== 'cancelled').reduce((s, a) => s + a.services.reduce((x, sv) => x + sv.price, 0), 0);
  const svcCount = appointments.filter(a => a.status !== 'cancelled').reduce((s, a) => s + a.services.length, 0);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statUpcoming').textContent = upcoming;
  document.getElementById('statSpend').textContent = `R${spend.toLocaleString()}`;
  document.getElementById('statServices').textContent = svcCount;

  const upcomingAppts = appointments.filter(a => a.status === 'upcoming');
  const el = document.getElementById('overviewUpcomingBody');
  if (!upcomingAppts.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-spa"></i><p>No upcoming appointments yet. Treat yourself!</p><button class="btn-primary" onclick="switchView('book')"><i class="fas fa-plus"></i> Book now</button></div>`;
    return;
  }

  el.innerHTML = `<table>
    <thead><tr><th>Date & Time</th><th>Services</th><th>Stylist</th><th>Total</th><th></th></tr></thead>
    <tbody>${upcomingAppts.map(a => apptRow(a)).join('')}</tbody>
  </table>`;
  bindRowActions();
}

function apptRow(a) {
  const total = a.services.reduce((s, sv) => s + sv.price, 0);
  const chips = a.services.slice(0, 2).map(sv => `<span class="chip">${sv.name}</span>`).join('');
  const more = a.services.length > 2 ? `<span class="chip-more">+${a.services.length - 2} more</span>` : '';
  const statusMap = { upcoming: 'badge-upcoming', past: 'badge-past', cancelled: 'badge-cancelled', pending: 'badge-pending' };
  return `<tr>
    <td>
      <div style="font-weight:600;font-size:0.75rem;">${formatDate(a.date)}</div>
      <div style="font-size:0.65rem;color:var(--muted);">${a.time}</div>
      <span class="badge ${statusMap[a.status]}" style="margin-top:0.2rem;">${a.status}</span>
    </td>
    <td class="td-services"><div class="service-chips">${chips}${more}</div></td>
    <td style="font-size:0.75rem;">${a.stylist}</td>
    <td style="font-weight:700;color:var(--rose);font-size:0.75rem;">R${total.toLocaleString()}</td>
    <td>
      <div class="appt-actions">
        <button class="icon-btn" title="View details" data-view-id="${a.id}"><i class="fas fa-eye"></i></button>
        ${a.status === 'upcoming' ? `
          <button class="icon-btn" title="Reschedule" data-reschedule-id="${a.id}"><i class="fas fa-calendar-alt"></i></button>
          <button class="icon-btn danger" title="Cancel" data-cancel-id="${a.id}"><i class="fas fa-times"></i></button>
        ` : ''}
      </div>
    </td>
  </tr>`;
}

function renderAppointments() {
  const el = document.getElementById('appointmentsBody');
  if (!appointments.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>You haven't booked any appointments yet.</p><button class="btn-primary" onclick="switchView('book')"><i class="fas fa-plus"></i> Book now</button></div>`;
    return;
  }

  const sorted = [...appointments].sort((a, b) => b.date.localeCompare(a.date));
  el.innerHTML = `<table>
    <thead><tr><th>Date & Time</th><th>Services</th><th>Stylist</th><th>Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${sorted.map(a => apptRow(a)).join('')}</tbody>
  </table>`;
  bindRowActions();
}

function bindRowActions() {
  document.querySelectorAll('[data-view-id]').forEach(btn =>
    btn.addEventListener('click', () => openDetailModal(btn.dataset.id))
  );

  document.querySelectorAll('[data-cancel-id]').forEach(btn =>
    btn.addEventListener('click', () => cancelAppointment(btn.dataset.cancelId))
  );

  document.querySelectorAll('[data-reschedule-id]').forEach(btn =>
    btn.addEventListener('click', () => openRescheduleModal(btn.dataset.rescheduleId))
  );
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function openRescheduleModal(id) {
  const modal = document.getElementById('rescheduleModal');
  if (!modal) return;

  const appointment = appointments.find(a => a.id === id);
  if (!appointment) {
    showToast('Appointment could not be found.');
    return;
  }

  if (appointment.status !== 'upcoming') {
    showToast('Only upcoming appointments can be rescheduled.');
    return;
  }

  rescheduleApptId = id;
  rescheduleAvailableSlots = [];
  rescheduleSelectedTime = '';

  const dateInput = document.getElementById('rescheduleDate');
  if (!dateInput) return;

  dateInput.min = getLocalDateString();
  dateInput.value = '';

  renderRescheduleTimeSlots();
  modal.classList.add('open');

  if (!dateInput.dataset.listenerAttached) {
    dateInput.addEventListener('change', loadRescheduleSlots);
    dateInput.dataset.listenerAttached = 'true';
  }
}

function closeRescheduleModal() {
  const modal = document.getElementById('rescheduleModal');
  if (modal) modal.classList.remove('open');

  rescheduleApptId = null;
  rescheduleAvailableSlots = [];
  rescheduleSelectedTime = '';

  const dateInput = document.getElementById('rescheduleDate');
  if (dateInput) dateInput.value = '';

  renderRescheduleTimeSlots();
}

async function loadRescheduleSlots() {
  const dateInput = document.getElementById('rescheduleDate');
  const message = document.getElementById('rescheduleSlotsMessage');
  if (!dateInput) return;

  const date = dateInput.value;
  rescheduleAvailableSlots = [];
  rescheduleSelectedTime = '';
  renderRescheduleTimeSlots();

  if (!date) {
    if (message) message.textContent = 'Select a date to view available times.';
    return;
  }

  const appointment = appointments.find(a => a.id === rescheduleApptId);
  if (!appointment) {
    if (message) message.textContent = 'Appointment could not be found.';
    return;
  }

  if (!appointment.services || !appointment.services.length) {
    if (message) message.textContent = 'This appointment has no services.';
    return;
  }

  const serviceIds = appointment.services.map(service => service.id).filter(Boolean);
  if (!serviceIds.length) {
    if (message) message.textContent = 'Unable to determine the services for this appointment.';
    return;
  }

  if (message) message.textContent = 'Loading available times...';

  try {
    const res = await fetch(
      `${API_URL}/bookings/availability/time-slots?stylistId=${encodeURIComponent(appointment.stylistId || '')}&date=${encodeURIComponent(date)}&serviceIds=${encodeURIComponent(serviceIds.join(','))}&excludeAppointmentId=${encodeURIComponent(rescheduleApptId)}`,
      { credentials: 'include' }
    );

    const data = await res.json();

    if (!res.ok) {
      rescheduleAvailableSlots = [];
      if (message) message.textContent = data.message || 'Could not load available times.';
      renderRescheduleTimeSlots();
      return;
    }

    rescheduleAvailableSlots = Array.isArray(data.data?.availableSlots) ? data.data.availableSlots : [];

    if (date === appointment.date && appointment.time && !rescheduleAvailableSlots.includes(appointment.time)) {
      rescheduleAvailableSlots.push(appointment.time);
    }

    rescheduleAvailableSlots.sort();

    if (!rescheduleAvailableSlots.length) {
      if (message) message.textContent = 'No available times for this date. Please choose another date.';
    } else if (message) {
      message.textContent = `${rescheduleAvailableSlots.length} available time slot(s).`;
    }

    renderRescheduleTimeSlots();
  } catch (error) {
    console.error('Could not load reschedule availability:', error);
    rescheduleAvailableSlots = [];
    if (message) message.textContent = 'Could not load available times. Please try again.';
    renderRescheduleTimeSlots();
  }
}

function renderRescheduleTimeSlots() {
  const container = document.getElementById('rescheduleTimeSlots');
  if (!container) return;

  if (!rescheduleAvailableSlots.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:0.8rem;color:var(--muted);font-size:0.7rem;">No available times</div>`;
    return;
  }

  container.innerHTML = rescheduleAvailableSlots.map(slot => {
    const selected = rescheduleSelectedTime === slot;
    return `<button type="button" class="time-slot ${selected ? 'selected' : ''}" onclick="selectRescheduleTime('${slot}')">${slot}</button>`;
  }).join('');
}

function selectRescheduleTime(time) {
  if (!rescheduleAvailableSlots.includes(time)) return;
  rescheduleSelectedTime = time;
  renderRescheduleTimeSlots();
}

async function confirmReschedule() {
  if (!rescheduleApptId) {
    showToast('No appointment selected.');
    return;
  }

  const dateInput = document.getElementById('rescheduleDate');
  const date = dateInput ? dateInput.value : '';
  const time = rescheduleSelectedTime;

  if (!date) {
    showToast('Please pick a new date.');
    return;
  }

  if (!time) {
    showToast('Please select an available time.');
    return;
  }

  const appointment = appointments.find(a => a.id === rescheduleApptId);
  if (!appointment) {
    showToast('Appointment could not be found.');
    return;
  }

  const confirmButton = document.getElementById('confirmRescheduleBtn');
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rescheduling...';
  }

  try {
    const res = await fetch(`${API_URL}/bookings/${encodeURIComponent(rescheduleApptId)}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ date, startTime: time })
    });

    const data = await res.json();

    if (res.status === 409) {
      showToast('That slot is no longer available. Please select another time.');
      await loadRescheduleSlots();
      return;
    }

    if (!res.ok) {
      showToast(data.message || 'Reschedule failed.');
      return;
    }

    showToast('Appointment rescheduled successfully.');
    closeRescheduleModal();
    await loadAppointments();
    renderAppointments();
    renderOverview();
  } catch (error) {
    console.error('Reschedule error:', error);
    showToast('Could not reschedule the appointment. Please try again.');
  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.innerHTML = '<i class="fas fa-calendar-alt"></i> Confirm New Time';
    }
  }
}

async function cancelAppointment(id) {
  const appt = appointments.find(a => a.id === id);
  if (!appt) return;
  if (!confirm(`Cancel your appointment on ${formatDate(appt.date)} at ${appt.time}?`)) return;

  const res = await fetch(`${API_URL}/bookings/${id}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({})
  });

  if (!res.ok) {
    showToast('Could not cancel appointment.');
    return;
  }

  await loadAppointments();
  renderAppointments();
  renderOverview();
  showToast('Appointment cancelled.');
}

function openDetailModal(id) {
  const a = appointments.find(x => x.id === id);
  if (!a) return;

  const total = a.services.reduce((s, sv) => s + sv.price, 0);
  const dur = a.services.reduce((s, sv) => s + sv.duration, 0);
  const statusMap = { upcoming: 'badge-upcoming', past: 'badge-past', cancelled: 'badge-cancelled', pending: 'badge-pending' };

  document.getElementById('modalContent').innerHTML = `
    <div style="margin-bottom:0.8rem;">
      <span class="badge ${statusMap[a.status]}">${a.status}</span>
    </div>
    <div class="review-section-title">Appointment Info</div>
    <div class="review-row"><span>Date</span><span>${formatDate(a.date)}</span></div>
    <div class="review-row"><span>Time</span><span>${a.time}</span></div>
    <div class="review-row"><span>Stylist</span><span>${a.stylist}</span></div>
    <div class="review-row"><span>Duration</span><span>~${formatDur(dur)}</span></div>

    <div class="review-section-title" style="margin-top:0.8rem;">Services Booked</div>
    <div class="review-services-list">
      ${a.services.map(sv => `
        <div class="review-svc-item">
          <div>
            <div style="font-weight:600;font-size:0.76rem;">${sv.name}</div>
            <div style="font-size:0.65rem;color:var(--muted);">${sv.duration} min</div>
          </div>
          <span style="font-weight:700;color:var(--rose);">R${sv.price}</span>
        </div>`).join('')}
    </div>
    <div class="review-total"><span>Total</span><span>R${total.toLocaleString()}</span></div>

    ${a.notes ? `<div class="review-section-title" style="margin-top:0.8rem;">Notes</div><p style="font-size:0.76rem;color:var(--muted);">${a.notes}</p>` : ''}
    ${a.status === 'upcoming' ? `<button class="btn-primary" style="margin-top:1rem;background:#DC2626;" onclick="cancelAppointment('${a.id}');closeModal()"><i class="fas fa-times"></i> Cancel Appointment</button>` : ''}
  `;

  document.getElementById('detailOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('detailOverlay').classList.remove('open');
}

document.getElementById('detailOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function resetWizard() {
  wizardStep = 1;
  cartIds = [];
  activeCat = CATEGORIES[0] || '';
  bookState = { date: '', time: '', stylistId: '', stylist: '' };
  renderCatNav();
  renderSvcGrid();
  renderCart();
  gotoStep(1);

  const today = getLocalDateString();
  const apptDateInput = document.getElementById('apptDate');
  apptDateInput.min = today;
  apptDateInput.value = '';

  if (!apptDateInput.dataset.listenerAttached) {
    apptDateInput.addEventListener('change', refreshTimeSlots);
    apptDateInput.dataset.listenerAttached = 'true';
  }

  renderStylistGrid();
  availableSlots = [];
  renderTimeSlotsIntoDOM();
}

function renderCatNav() {
  const el = document.getElementById('catNav');
  el.innerHTML = CATEGORIES.map(cat => `
    <button class="cat-btn ${cat === activeCat ? 'active' : ''}" onclick="setActiveCat('${cat}')">${cat}</button>
  `).join('');
}

function setActiveCat(cat) {
  activeCat = cat;
  renderCatNav();
  renderSvcGrid();
}

function renderSvcGrid() {
  const svcs = SERVICES.filter(s => s.category === activeCat);
  document.getElementById('svcGrid').innerHTML = svcs.map(s => `
    <div class="svc-card ${cartIds.includes(s.id) ? 'selected' : ''}" onclick="toggleService('${s.id}')">
      <div class="svc-card-name">${s.name}</div>
      <div class="svc-card-meta">
        <span class="svc-card-price">R${s.price}</span>
        <span class="svc-card-dur">${s.duration} min</span>
      </div>
    </div>
  `).join('');
}

function toggleService(id) {
  if (cartIds.includes(id)) {
    cartIds = cartIds.filter(serviceId => serviceId !== id);
  } else {
    cartIds.push(id);
  }

  if (bookState.stylistId && !isStylistEligible(bookState.stylistId)) {
    bookState.stylistId = '';
    bookState.stylist = '';
    bookState.time = '';
  }

  availableSlots = [];
  renderSvcGrid();
  renderCart();
  renderStylistGrid();
  renderTimeSlotsIntoDOM();

  if (cartIds.length && bookState.stylistId && document.getElementById('apptDate')?.value) {
    refreshTimeSlots();
  }
}

function isStylistEligible(stylistId) {
  const stylist = STYLISTS.find(s => s.id === stylistId && s.isAvailable !== false);
  if (!stylist) return false;

  const selectedServices = SERVICES.filter(service => cartIds.includes(service.id));
  if (!selectedServices.length) return false;

  if (!Array.isArray(stylist.serviceIds) || !stylist.serviceIds.length) return false;

  return selectedServices.every(service => stylist.serviceIds.includes(service.id));
}

function removeFromCart(id) {
  cartIds = cartIds.filter(serviceId => serviceId !== id);

  if (bookState.stylistId && !isStylistEligible(bookState.stylistId)) {
    bookState.stylistId = '';
    bookState.stylist = '';
    bookState.time = '';
  }

  renderSvcGrid();
  renderCart();
  renderStylistGrid();
  availableSlots = [];
  renderTimeSlotsIntoDOM();

  if (cartIds.length && bookState.stylistId && document.getElementById('apptDate')?.value) {
    refreshTimeSlots();
  }
}

function renderCart() {
  const items = SERVICES.filter(s => cartIds.includes(s.id));
  const total = items.reduce((s, sv) => s + sv.price, 0);
  const dur = items.reduce((s, sv) => s + sv.duration, 0);
  const count = items.length;

  document.getElementById('cartCount').textContent = count;

  const container = document.getElementById('cartItems');
  container.querySelectorAll('.cart-chip').forEach(el => el.remove());

  let emptyMsg = document.getElementById('cartEmpty');
  if (!emptyMsg) {
    emptyMsg = document.createElement('div');
    emptyMsg.className = 'cart-empty-msg';
    emptyMsg.id = 'cartEmpty';
    emptyMsg.textContent = 'Tap a service above to add it here';
    container.appendChild(emptyMsg);
  }

  if (count === 0) {
    emptyMsg.style.display = 'block';
    document.getElementById('cartSummary').style.display = 'none';
  } else {
    emptyMsg.style.display = 'none';
    items.forEach(sv => {
      const chip = document.createElement('div');
      chip.className = 'cart-chip';
      chip.innerHTML = `${sv.name} <button class="cart-chip-remove" onclick="removeFromCart('${sv.id}')"><i class="fas fa-times"></i></button>`;
      container.appendChild(chip);
    });
    document.getElementById('cartSummary').style.display = 'flex';
    document.getElementById('cartTotal').textContent = `R${total.toLocaleString()}`;
    document.getElementById('cartDuration').textContent = `~${formatDur(dur)} total`;
    document.getElementById('totalDurLabel').textContent = formatDur(dur);
  }
}

function renderStylistGrid() {
  const grid = document.getElementById('stylistGrid');
  if (!grid) return;

  const selectedServices = SERVICES.filter(service => cartIds.includes(service.id));

  if (!selectedServices.length) {
    bookState.stylistId = '';
    bookState.stylist = '';

    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:1rem;"><p>Please select at least one service first.</p></div>`;
    return;
  }

  const eligibleStylists = STYLISTS.filter(stylist => {
    if (stylist.isAvailable === false) return false;
    if (!Array.isArray(stylist.serviceIds) || !stylist.serviceIds.length) return false;
    return selectedServices.every(service => stylist.serviceIds.includes(service.id));
  });

  if (bookState.stylistId && !eligibleStylists.some(stylist => stylist.id === bookState.stylistId)) {
    bookState.stylistId = '';
    bookState.stylist = '';
    bookState.time = '';
    availableSlots = [];
    renderTimeSlotsIntoDOM();
  }

  if (!eligibleStylists.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:1rem;"><i class="fas fa-user-slash"></i><p>No stylists are available for all of the selected services.</p></div>`;
    return;
  }

  grid.innerHTML = eligibleStylists.map(stylist => {
    const name = stylist.name || 'Stylist';
    const initial = name.charAt(0).toUpperCase();

    return `
      <button type="button" class="stylist-btn ${bookState.stylistId === stylist.id ? 'selected' : ''}" onclick="selectStylist('${stylist.id}', '${name.replace(/'/g, "\\'")}' )">
        <div class="stylist-av">${initial}</div>
        <div class="stylist-name">${name}</div>
      </button>
    `;
  }).join('');
}

function selectStylist(id, name) {
  bookState.stylistId = id;
  bookState.stylist = name;
  renderStylistGrid();
  refreshTimeSlots();
}

async function loadAvailableSlots() {
  const dateInput = document.getElementById('apptDate');
  const dateVal = dateInput ? dateInput.value : '';

  availableSlots = [];

  if (!dateVal || !bookState.stylistId || !cartIds.length) {
    renderTimeSlotsIntoDOM();
    return;
  }

  if (!isStylistEligible(bookState.stylistId)) {
    bookState.time = '';
    renderTimeSlotsIntoDOM();
    showToast('The selected stylist does not provide all selected services.');
    return;
  }

  try {
    const res = await fetch(
      `${API_URL}/bookings/availability/time-slots?stylistId=${encodeURIComponent(bookState.stylistId)}&date=${encodeURIComponent(dateVal)}&serviceIds=${encodeURIComponent(cartIds.join(','))}`,
      { credentials: 'include' }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('Availability request failed:', data.message || data);
      availableSlots = [];
      renderTimeSlotsIntoDOM();
      showToast(data.message || 'Could not load available times.');
      return;
    }

    availableSlots = Array.isArray(data.data?.availableSlots) ? data.data.availableSlots : [];
  } catch (error) {
    console.error('Could not load available slots:', error);
    availableSlots = [];
    showToast('Could not load available times. Please try again.');
  }

  if (bookState.time && !availableSlots.includes(bookState.time)) {
    bookState.time = '';
  }

  renderTimeSlotsIntoDOM();
}

function renderTimeSlots() {
  const container = document.getElementById('timeSlots');

  if (!availableSlots.length) {
    return `
      <div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--muted);font-size:0.7rem;">
        ${!document.getElementById('apptDate')?.value
          ? 'Select a date first.'
          : !bookState.stylistId
            ? 'Select a stylist first.'
            : !cartIds.length
              ? 'Select at least one service first.'
              : 'No available times for this date.'}
      </div>
    `;
  }

  return availableSlots.map(slot => {
    const selected = bookState.time === slot;
    return `<button type="button" class="time-slot ${selected ? 'selected' : ''}" onclick="selectTime('${slot}')">${slot}</button>`;
  }).join('');
}

function renderTimeSlotsIntoDOM() {
  const el = document.getElementById('timeSlots');
  if (el) {
    el.innerHTML = renderTimeSlots();
  }
}

async function refreshTimeSlots() {
  bookState.time = '';
  await loadAvailableSlots();
  renderTimeSlotsIntoDOM();
}

function selectTime(time) {
  if (!availableSlots.includes(time)) return;
  bookState.time = time;
  renderTimeSlotsIntoDOM();
}

function gotoStep(n) {
  wizardStep = n;
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`wbody${i}`).style.display = i === n ? 'block' : 'none';
    const ws = document.getElementById(`ws${i}`);
    ws.classList.toggle('active', i === n);
    ws.classList.toggle('done', i < n);
  }
  document.getElementById('stepInd').textContent = `Step ${n} of 4`;
  document.getElementById('wPrev').style.visibility = n === 1 ? 'hidden' : 'visible';
  document.getElementById('wNext').innerHTML = n === 4 ? '<i class="fas fa-check"></i> Confirm Booking' : 'Next <i class="fas fa-arrow-right"></i>';

  if (n === 4) buildReview();
}

function wizardNext() {
  if (wizardStep === 1) {
    if (!cartIds.length) { showToast('Please select at least one service.'); return; }
  }

  if (wizardStep === 2) {
    if (!document.getElementById('apptDate').value) { showToast('Please pick a date.'); return; }
    if (!bookState.time) { showToast('Please pick a time slot.'); return; }
    if (!bookState.stylistId) { showToast('Please choose a stylist.'); return; }
    bookState.date = document.getElementById('apptDate').value;
  }

  if (wizardStep === 3) {
    const name = document.getElementById('detName').value.trim();
    const email = document.getElementById('detEmail').value.trim();
    const phone = document.getElementById('detPhone').value.trim();
    if (!name || !email || !phone) { showToast('Please fill in your name, email, and phone number.'); return; }
  }

  if (wizardStep === 4) {
    confirmBooking();
    return;
  }

  gotoStep(wizardStep + 1);
}

function wizardPrev() {
  if (wizardStep > 1) gotoStep(wizardStep - 1);
}

function buildReview() {
  const items = SERVICES.filter(s => cartIds.includes(s.id));
  const total = items.reduce((s, sv) => s + sv.price, 0);
  const dur = items.reduce((s, sv) => s + sv.duration, 0);

  document.getElementById('reviewCard').innerHTML = `
    <div class="review-section-title">Selected Services</div>
    <div class="review-services-list">
      ${items.map(sv => `
        <div class="review-svc-item">
          <div>
            <div style="font-weight:600;font-size:0.76rem;">${sv.name}</div>
            <div style="font-size:0.65rem;color:var(--muted);">${sv.duration} min</div>
          </div>
          <span style="font-weight:700;color:var(--rose);">R${sv.price}</span>
        </div>`).join('')}
    </div>
    <div class="review-total"><span>Total</span><span>R${total.toLocaleString()}</span></div>
    <div style="margin-top:0.4rem;font-size:0.65rem;color:var(--muted);">Estimated duration: ~${formatDur(dur)}</div>

    <div class="review-section-title" style="margin-top:1rem;">Appointment Info</div>
    <div class="review-row"><span>Date</span><span>${formatDate(bookState.date)}</span></div>
    <div class="review-row"><span>Time</span><span>${bookState.time}</span></div>
    <div class="review-row"><span>Stylist</span><span>${bookState.stylist}</span></div>

    <div class="review-section-title" style="margin-top:1rem;">Your Details</div>
    <div class="review-row"><span>Name</span><span>${document.getElementById('detName').value}</span></div>
    <div class="review-row"><span>Phone</span><span>${document.getElementById('detPhone').value}</span></div>
    <div class="review-row"><span>Email</span><span>${document.getElementById('detEmail').value}</span></div>
    ${document.getElementById('detNotes').value ? `<div class="review-row"><span>Notes</span><span>${document.getElementById('detNotes').value}</span></div>` : ''}
  `;
}

async function confirmBooking() {
  if (isBookingSubmitting) return;

  const name = document.getElementById('detName').value.trim();
  const email = document.getElementById('detEmail').value.trim();
  const phone = document.getElementById('detPhone').value.trim();

  if (!name || !email || !phone) {
    showToast('Please fill in your name, email, and phone number.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Please enter a valid email address.');
    return;
  }

  isBookingSubmitting = true;
  const wNextBtn = document.getElementById('wNext');
  wNextBtn.disabled = true;
  wNextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';

  try {
    const res = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        serviceIds: cartIds,
        stylistId: bookState.stylistId,
        date: bookState.date,
        startTime: bookState.time,
        notes: document.getElementById('detNotes').value,
        guestName: name,
        guestEmail: email,
        guestPhone: phone
      })
    });

    const data = await res.json();

    if (res.status === 409) {
      showToast('This time slot is no longer available. Please select another time.');
      gotoStep(2);
      await refreshTimeSlots();
      return;
    }

    if (!res.ok) {
      showToast(data.message || 'Booking failed.');
      return;
    }

    showToast('Booking confirmed! Check your email for confirmation.');
    cartIds = [];
    renderCart();
    await loadAppointments();
    setTimeout(() => { switchView('appointments'); }, 800);
  } catch (error) {
    console.error('Booking error:', error);
    showToast('Could not create booking. Please try again.');
  } finally {
    isBookingSubmitting = false;
    wNextBtn.disabled = false;
    wNextBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
  }
}

async function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  if (!name) { showToast('Name cannot be empty.'); return; }

  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ') || firstName;

  const res = await fetch(`${API_URL}/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      firstName,
      lastName,
      phone: document.getElementById('profilePhone').value.trim()
    })
  });

  const data = await res.json();
  if (!res.ok) { showToast(data.message || 'Update failed.'); return; }

  document.getElementById('profileFullName').textContent = name;
  showToast('Profile updated.');
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatDur(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

async function signOut() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (error) {
    console.warn('Logout request failed:', error);
  }

  localStorage.removeItem('user');
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('authToken');

  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
    }
  });

  history.replaceState(null, '', 'login.html');
  showToast('Signed out successfully');
  setTimeout(() => { window.location.replace('login.html'); }, 300);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

(async function init() {
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (!currentUser) {
    window.location.replace('login.html');
    return;
  }

  if (currentUser.role && currentUser.role.toLowerCase() !== 'customer') {
    if (currentUser.role.toLowerCase() === 'admin') {
      window.location.replace('admindashboard.html');
    } else if (currentUser.role.toLowerCase() === 'stylist') {
      window.location.replace('stylistdashboard.html');
    } else {
      window.location.replace('login.html');
    }
    return;
  }

  const user = currentUser;
  if (user) {
    document.getElementById('profileFullName').textContent = user.name || user.firstName + ' ' + user.lastName || 'User';
    document.getElementById('profileEmail').textContent = user.email || '';
    document.getElementById('detName').value = user.name || user.firstName + ' ' + user.lastName || '';
    document.getElementById('detEmail').value = user.email || '';
    document.getElementById('profileName').value = user.name || user.firstName + ' ' + user.lastName || '';
    document.getElementById('profilePhone').value = user.phone || '';
    document.getElementById('profileEmailInput').value = user.email || '';

    const initials = (user.firstName ? user.firstName[0] : '') + (user.lastName ? user.lastName[0] : '');
    if (initials) {
      document.getElementById('headerAvatar').textContent = initials;
      document.getElementById('profileAvatar').textContent = initials;
    }
  }

  await Promise.all([loadServices(), loadStylists()]);
  await loadAppointments();
  renderOverview();
  resetWizard();
})();
