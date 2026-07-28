/**
 * Login page logic
 */

const form = document.getElementById('login-form');
const errorEl = document.getElementById('error');

/**
 * Handle form submission
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');

    // Get form values
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate fields
    if (!email || !password) {
        errorEl.textContent = 'All fields are required';
        errorEl.classList.add('show');
        return;
    }

    // Disable button while submitting
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing In...';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            errorEl.textContent = data.message || 'Invalid email or password';
            errorEl.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Sign In';
            return;
        }

        // Save user data and redirect
        setAuthData(data.data.user);
        window.location.href = 'dashboard.html';

    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});