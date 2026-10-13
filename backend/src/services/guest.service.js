/**
 * Guest service - handles guest user creation for walk-in bookings
 */

const User = require('../models/User.model');
const crypto = require('crypto');

const createGuestUser = async (email = null, phone = null, name = null) => {
  const guestEmail = email ? email.trim().toLowerCase() : `guest_${crypto.randomUUID()}@example.invalid`;
  const guestPassword = crypto.randomBytes(16).toString('hex');

  const trimmedName = (name || '').trim();
  const nameParts = trimmedName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || 'Guest';
  const lastName = nameParts.slice(1).join(' ') || 'User';

  const guest = await User.create({
    firstName,
    lastName,
    email: guestEmail,
    password: guestPassword,
    phone: phone || '000-000-0000',
    role: 'customer',
    isActive: true
  });

  return guest;
};

const findOrCreateGuest = async (email, phone = null, name = null) => {
  if (email) {
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) return existing;
  }
  try {
    return await createGuestUser(email, phone, name);
  } catch (error) {
    // Concurrent requests may both observe that the customer is missing.
    if (error.code === 11000 && email) {
      const existing = await User.findOne({ email: email.trim().toLowerCase() });
      if (existing) return existing;
    }
    throw error;
  }
};

const isGuestUser = (user) => {
  return user.email && user.email.startsWith('guest_') || user.firstName === 'Guest';
};

module.exports = {
  createGuestUser,
  findOrCreateGuest,
  isGuestUser
};