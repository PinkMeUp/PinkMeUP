/**
 * Auth utilities - shared functions for authentication
 */

const API_URL = 'https://pinkmeup-api.onrender.com/api/v1';

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
    return !!getCurrentUser();
}

/**
 * Save user data to localStorage
 */
function setAuthData(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

/**
 * Clear auth data and redirect to login
 */
function clearAuthData() {
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

/**
 * Redirect to login if not authenticated
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

/**
 * Redirect to dashboard if already authenticated
 */
function requireGuest() {
    if (isAuthenticated()) {
        window.location.href = '/dashboard.html';
        return false;
    }
    return true;
}

/**
 * Logout function
 */
function logout() {
    clearAuthData();
}