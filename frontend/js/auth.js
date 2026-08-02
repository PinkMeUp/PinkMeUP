/**
 * Auth utilities - shared functions for authentication
 */

const API_ORIGIN = window.API_ORIGIN || window.location.origin;
const API_URL = window.API_URL || `${API_ORIGIN}/api/v1`;
const GOOGLE_AUTH_URL = window.GOOGLE_AUTH_URL || `${API_ORIGIN}/api/v1/auth/google`;
const AUTH_TOKEN_KEY = 'authToken';

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

function setAuthToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

function saveAuthData(user, token) {
    setAuthData(user);
    if (token) {
        setAuthToken(token);
    }
}

function parseTokenFromHash() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (token) {
        setAuthToken(token);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return token;
    }

    return null;
}

/**
 * Fetch logged-in user from backend cookie or bearer token session
 * Used for Google OAuth login
 */
async function syncAuthFromServer() {
    try {
        const token = getAuthToken();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'GET',
            credentials: 'include',
            headers
        });

        if (!response.ok) {
            if (token) {
                clearAuthToken();
            }
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
    clearAuthToken();
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

/**
 * Set runtime auth links for pages that use Google sign-in.
 */
function configureAuthLinks() {
    const googleLink = document.getElementById('google-auth');
    if (googleLink) {
        googleLink.href = GOOGLE_AUTH_URL;
    }
}

parseTokenFromHash();
configureAuthLinks();
