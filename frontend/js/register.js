/**
 * Register page logic
 */

const form = document.getElementById('register-form');
const errorEl = document.getElementById('error');

/**
 * Handle form submission
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');

    // Get form values
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    // Validate fields
    if (!firstName || !lastName || !email || !phone || !password) {
        errorEl.textContent = 'All fields are required';
        errorEl.classList.add('show');
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.add('show');
        return;
    }

    // Disable button while submitting
    const btn = document.getElementById('register-btn');
    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ firstName, lastName, email, password, phone })
        });

        const data = await response.json();

        if (!response.ok) {
            errorEl.textContent = data.message || 'Registration failed';
            errorEl.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }

        // Save user data and redirect to login
        setAuthData(data.data.user);
        window.location.href = 'login.html';

    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
});