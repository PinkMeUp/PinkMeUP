/**
 * Compatibility helpers for older pages.
 *
 * Booking behaviour now lives in the customer dashboard. This file is kept so
 * a legacy page can include it without failing to parse or throwing on load.
 */

window.guardRoute = function guardRoute(...allowedRoles) {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

  if (!user) {
    window.location.href = 'login.html';
    return false;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.alert('Access denied. You do not have permission to view this page.');
    window.location.href = 'login.html';
    return false;
  }

  return true;
};

const logoutButton = document.getElementById('logoutBtn');
if (logoutButton) {
  logoutButton.addEventListener('click', () => {
    if (typeof logout === 'function') {
      logout();
      return;
    }

    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
  });
}
