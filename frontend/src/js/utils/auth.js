/**
 * Auth utilities - shared functions for authentication
 */

const API_URL = 'https://pinkmeup-api.onrender.com/api/v1';

/**
 * Get current user from localStorage
 */
const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
const isAuthenticated = () => {
  return !!getCurrentUser();
};

/**
 * Save user data to localStorage
 */
const setAuthData = (user) => {
  localStorage.setItem('user', JSON.stringify(user));
};

/**
 * Clear auth data (logout)
 */
const clearAuthData = () => {
  localStorage.removeItem('user');
  window.location.href = '/login.html';
};

/**
 * Redirect if not authenticated
 */
const requireAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
};

/**
 * Redirect if already authenticated
 */
const requireGuest = () => {
  if (isAuthenticated()) {
    window.location.href = '/dashboard.html';
    return false;
  }
  return true;
};

/**
 * API request helper with credentials
 */
const authFetch = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include' // Important for cookies!
  });

  return response;
};

export {
  API_URL,
  getCurrentUser,
  isAuthenticated,
  setAuthData,
  clearAuthData,
  requireAuth,
  requireGuest,
  authFetch
};