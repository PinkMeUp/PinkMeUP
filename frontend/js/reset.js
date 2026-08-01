const form = document.getElementById('reset-form');
const errorEl = document.getElementById('error');
const successEl = document.getElementById('success');

requireGuest();

requireGuest();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');

    const email = document.getElementById('email').value.trim();

    if (!email) {
        errorEl.textContent = 'Email is required';
        errorEl.classList.add('show');
        return;
    }

    const btn = document.getElementById('reset-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            errorEl.textContent = data.message || 'Something went wrong';
            errorEl.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
            return;
        }

        successEl.textContent = 'Reset link sent to your email. Check your inbox.';
        successEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
        document.getElementById('email').value = '';

    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Send Reset Link';
    }
});