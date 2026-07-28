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
 * Check if user is authenticated locally
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
 * Fetch logged-in user from backend cookie session
 * Used for Google OAuth login
 */
async function syncAuthFromServer() {
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();

        if (data.user) {
            setAuthData(data.user);
            return true;
        }

        return false;

    } catch (error) {
        console.error('Auth sync failed:', error);
        return false;
    }
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
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout failed:', error);
    }

    clearAuthData();
}