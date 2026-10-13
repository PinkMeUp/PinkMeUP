/** Public runtime API configuration. Set window.API_ORIGIN or window.API_URL
 * before this script for a separately hosted API. Defaults to the current site. */
const configuredOrigin = window.API_ORIGIN || document.querySelector('meta[name="api-origin"]')?.content || window.location.origin;
window.API_ORIGIN = configuredOrigin.replace(/\/$/, '');
window.API_URL = (window.API_URL || `${window.API_ORIGIN}/api/v1`).replace(/\/$/, '');
window.GOOGLE_AUTH_URL = window.GOOGLE_AUTH_URL || `${window.API_URL}/auth/google`;
