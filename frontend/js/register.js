/**
 * Register page logic
 */

const form = document.getElementById('register-form');
const errorEl = document.getElementById('error');

requireGuest();


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
    const missing = [];
    if (!firstName) missing.push('first name');
    if (!lastName) missing.push('last name');
    if (!email) missing.push('email');
    if (!phone) missing.push('phone');
    if (!password) missing.push('password');
    if (missing.length) {
        errorEl.textContent = `Please fill in: ${missing.join(', ')}.`;
        errorEl.classList.add('show');
        return;
    }

    const NAME_PATTERN = /^\p{L}+(?:['\u2019 -]\p{L}+)*$/u;
    if (!NAME_PATTERN.test(firstName)) {
        errorEl.textContent = 'First name may only contain letters, spaces, hyphens and apostrophes.';
        errorEl.classList.add('show');
        return;
    }
    if (!NAME_PATTERN.test(lastName)) {
        errorEl.textContent = 'Last name may only contain letters, spaces, hyphens and apostrophes.';
        errorEl.classList.add('show');
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorEl.textContent = 'Enter a valid email address (e.g. name@example.com).';
        errorEl.classList.add('show');
        return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!/^[+\d\s()-]+$/.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15 || /^(\d)\1+$/.test(phoneDigits)) {
        errorEl.textContent = 'Enter a valid phone number (10-15 digits, e.g. 062 034 4647).';
        errorEl.classList.add('show');
        return;
    }

    if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        errorEl.textContent = 'Password must be at least 6 characters and include at least one letter and one number.';
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

        // Save user data and redirect to the correct dashboard now that the session cookie is set
        setAuthData(data.data.user);
        redirectToDashboard(data.data.user);

    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
});