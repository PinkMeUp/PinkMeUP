const form = document.getElementById('reset-form');
const errorEl = document.getElementById('error');
const successEl = document.getElementById('success');
const resetToken = new URLSearchParams(window.location.search).get('token');
const btn = document.getElementById('reset-btn');

if (resetToken) {
    document.querySelector('.reset-description').textContent = 'Choose a new password for your account.';
    document.querySelector('label[for="email"]').textContent = 'New password';
    const input = document.getElementById('email');
    input.id = 'new-password';
    input.type = 'password';
    input.autocomplete = 'new-password';
    input.placeholder = 'At least 6 characters';
    input.minLength = 6;
    document.querySelector('label').htmlFor = input.id;
    btn.textContent = 'Reset Password';
} else {
    requireGuest();
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');
    const value = document.getElementById(resetToken ? 'new-password' : 'email').value;
    if (resetToken ? value.length < 6 : !value.trim()) {
        errorEl.textContent = resetToken ? 'Password must be at least 6 characters.' : 'Email is required.';
        errorEl.classList.add('show');
        return;
    }
    btn.disabled = true;
    btn.textContent = resetToken ? 'Resetting...' : 'Sending...';
    try {
        const response = await apiFetch(`${API_URL}/auth/${resetToken ? 'reset-password' : 'forgot-password'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resetToken ? { token: resetToken, newPassword: value } : { email: value.trim() })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not reset your password.');
        successEl.textContent = resetToken ? 'Password reset successfully. You can now sign in.' : 'Reset link sent. Check your inbox.';
        successEl.classList.add('show');
        form.reset();
        if (resetToken) {
            clearAuthToken();
            localStorage.removeItem('user');
            window.history.replaceState(null, '', window.location.pathname);
            form.hidden = true;
        }
    } catch (error) {
        errorEl.textContent = error.message || 'Network error. Please try again.';
        errorEl.classList.add('show');
    } finally {
        btn.disabled = false;
        btn.textContent = resetToken ? 'Reset Password' : 'Send Reset Link';
    }
});
