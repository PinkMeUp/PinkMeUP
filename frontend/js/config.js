/**
 * Frontend runtime API configuration.
 *
 * For static sites, this is the central place to define the backend origin.
 * The value is public and not sensitive because it is the endpoint for API requests.
 */
window.API_ORIGIN = window.API_ORIGIN || 'https://pinkmeup-api.onrender.com';
window.API_URL = window.API_URL || `${window.API_ORIGIN}/api/v1`;
window.GOOGLE_AUTH_URL = window.GOOGLE_AUTH_URL || `${window.API_URL}/auth/google`;
