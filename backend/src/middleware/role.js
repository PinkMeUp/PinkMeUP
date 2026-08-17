/**
 * Role-based access control middleware helpers
 */

const { USER_ROLES } = require('../utils/constants');

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
};

const isAdmin = () => authorize(USER_ROLES.ADMIN);
const isStylist = () => authorize(USER_ROLES.STYLIST, USER_ROLES.ADMIN);
const isCustomer = () => authorize(USER_ROLES.CUSTOMER, USER_ROLES.ADMIN);

module.exports = { authorize, isAdmin, isStylist, isCustomer };