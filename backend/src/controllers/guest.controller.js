/** Guest and admin walk-in requests share the normal booking rules. */
const { createBooking } = require('./booking.controller');

const createGuestBooking = (req, res) => {
  req.body = {
    ...req.body,
    guestName: [req.body.firstName, req.body.lastName].filter(Boolean).join(' '),
    guestEmail: req.body.email,
    guestPhone: req.body.phone
  };
  return createBooking(req, res);
};

module.exports = { createGuestBooking };
