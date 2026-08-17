/**
 * Database seeder - populates database with initial data
 * Usage: npm run seed
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../src/models/User.model');
const Service = require('../src/models/Service.model');
const Stylist = require('../src/models/Stylist.model');
const Appointment = require('../src/models/Appointment.model');
const BusinessSetting = require('../src/models/BusinessSetting.model');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const clearDatabase = async () => {
  console.log('Clearing database...');
  await User.deleteMany({});
  await Service.deleteMany({});
  await Stylist.deleteMany({});
  await Appointment.deleteMany({});
  await BusinessSetting.deleteMany({});
  console.log('Database cleared');
};

const seedBusinessSettings = async () => {
  console.log('Seeding business settings...');
  const settings = await BusinessSetting.create({
    businessHours: {
      monday: { start: '08:00', end: '17:00', isOpen: true },
      tuesday: { start: '08:00', end: '17:00', isOpen: true },
      wednesday: { start: '08:00', end: '17:00', isOpen: true },
      thursday: { start: '08:00', end: '17:00', isOpen: true },
      friday: { start: '08:00', end: '17:00', isOpen: true },
      saturday: { start: '09:00', end: '14:00', isOpen: true },
      sunday: { start: '', end: '', isOpen: false }
    },
    slotInterval: 30,
    maxBookingsPerSlot: 1,
    bookingLeadTime: 60,
    cancellationWindow: 1440,
    timezone: 'Africa/Johannesburg',
    businessName: 'PinkMeUp Beauty Spa & Academy'
  });
  console.log('Business settings seeded');
  return settings;
};

const seedUsers = async () => {
  console.log('Seeding users...');
  const users = [
    {
      firstName: 'Phumuzile', lastName: 'Moyo',
      email: 'admin@pinkmeup.com',
      password: await bcrypt.hash('Admin@123', 10),
      phone: '+27 82 123 4567', role: 'admin', isActive: true
    },
    {
      firstName: 'Thandi', lastName: 'Nkosi',
      email: 'thandi@pinkmeup.com',
      password: await bcrypt.hash('Stylist@123', 10),
      phone: '+27 82 234 5678', role: 'stylist', isActive: true
    },
    {
      firstName: 'Lerato', lastName: 'Mokoena',
      email: 'lerato@pinkmeup.com',
      password: await bcrypt.hash('Stylist@123', 10),
      phone: '+27 82 345 6789', role: 'stylist', isActive: true
    },
    {
      firstName: 'Sipho', lastName: 'Zulu',
      email: 'sipho@example.com',
      password: await bcrypt.hash('Customer@123', 10),
      phone: '+27 82 456 7890', role: 'customer', isActive: true
    },
    {
      firstName: 'Zanele', lastName: 'Dlamini',
      email: 'zanele@example.com',
      password: await bcrypt.hash('Customer@123', 10),
      phone: '+27 82 567 8901', role: 'customer', isActive: true
    }
  ];
  const created = await User.insertMany(users);
  console.log('Users seeded:', created.length);
  return created;
};

const seedServices = async () => {
  console.log('Seeding services...');
  const services = [
    { name: 'Hair Braiding', description: 'Professional braiding with various styles', price: 350, duration: 120, category: 'Hair', isActive: true },
    { name: 'Manicure', description: 'Full nail care with polish', price: 250, duration: 45, category: 'Nails', isActive: true },
    { name: 'Pedicure', description: 'Complete foot care with polish', price: 300, duration: 60, category: 'Nails', isActive: true },
    { name: 'Facial Treatment', description: 'Deep cleansing with exfoliation', price: 400, duration: 60, category: 'Skincare', isActive: true },
    { name: 'Waxing', description: 'Professional hair removal', price: 200, duration: 30, category: 'Body', isActive: true },
    { name: 'Massage Therapy', description: 'Relaxing full-body massage', price: 500, duration: 90, category: 'Therapy', isActive: true },
    { name: 'Makeup Application', description: 'Professional makeup for any occasion', price: 450, duration: 60, category: 'Makeup', isActive: true },
    { name: 'Brow Shaping', description: 'Precision eyebrow shaping', price: 150, duration: 20, category: 'Brows', isActive: true }
  ];
  const created = await Service.insertMany(services);
  console.log('Services seeded:', created.length);
  return created;
};

const seedStylists = async (users) => {
  console.log('Seeding stylists...');
  const stylistUsers = users.filter(u => u.role === 'stylist');
  if (!stylistUsers.length) {
    console.warn('No stylist users found');
    return [];
  }

  const stylists = [
    { userId: stylistUsers[0]._id, specialties: ['Hair Braiding', 'Waxing', 'Brow Shaping'], isAvailable: true, rating: 4.5, ratingCount: 12 },
    { userId: stylistUsers[1]._id, specialties: ['Manicure', 'Pedicure', 'Makeup Application'], isAvailable: true, rating: 4.2, ratingCount: 8 }
  ];
  const created = await Stylist.insertMany(stylists);
  console.log('Stylists seeded:', created.length);
  return created;
};

const seedAppointments = async (users, services, stylists) => {
  console.log('Seeding appointments...');
  const customers = users.filter(u => u.role === 'customer');
  if (!customers.length || !services.length || !stylists.length) {
    console.warn('Missing data for appointments');
    return [];
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const twoDaysLater = new Date();
  twoDaysLater.setDate(twoDaysLater.getDate() + 2);

  const s1 = services[0], s2 = services[1], s3 = services[4], s4 = services[6];

  const appointments = [
    {
      customerId: customers[0]._id, stylistId: stylists[0]._id,
      serviceIds: [s1._id, s2._id], date: tomorrow,
      startTime: '09:00', endTime: '11:45', totalDuration: 165, totalPrice: 600,
      status: 'confirmed', notes: 'Bridal package'
    },
    {
      customerId: customers[0]._id, stylistId: stylists[1]._id,
      serviceIds: [s4._id], date: tomorrow,
      startTime: '14:00', endTime: '15:00', totalDuration: 60, totalPrice: 450,
      status: 'confirmed', notes: 'Bridal makeup trial'
    },
    {
      customerId: customers[1]._id, stylistId: stylists[0]._id,
      serviceIds: [s3._id], date: tomorrow,
      startTime: '11:30', endTime: '12:00', totalDuration: 30, totalPrice: 200,
      status: 'pending', notes: 'Prefers female stylist'
    },
    {
      customerId: customers[1]._id, stylistId: stylists[1]._id,
      serviceIds: [s2._id, s4._id], date: twoDaysLater,
      startTime: '10:00', endTime: '11:45', totalDuration: 105, totalPrice: 700,
      status: 'confirmed', notes: 'Wedding day prep'
    }
  ];

  const created = await Appointment.insertMany(appointments);
  console.log('Appointments seeded:', created.length);
  return created;
};

const seedDatabase = async () => {
  try {
    console.log('=================================');
    console.log('   PinkMeUp Database Seeder');
    console.log('=================================');

    await connectDB();
    await clearDatabase();

    const settings = await seedBusinessSettings();
    const users = await seedUsers();
    const services = await seedServices();
    const stylists = await seedStylists(users);
    const appointments = await seedAppointments(users, services, stylists);

    console.log('=================================');
    console.log('   Seeding Complete!');
    console.log('=================================');
    console.log('Business Settings: 1');
    console.log('Users:', users.length);
    console.log('Services:', services.length);
    console.log('Stylists:', stylists.length);
    console.log('Appointments:', appointments.length);
    console.log('=================================');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedDatabase();