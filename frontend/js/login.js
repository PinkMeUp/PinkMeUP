const form = document.getElementById('login-form');
const errorEl = document.getElementById('error');
const successEl = document.getElementById('success');

// Password toggle
const toggleBtn = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');

toggleBtn.addEventListener('click', function() {
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        this.textContent = 'Hide';
    } else {
        passwordInput.type = 'password';
        this.textContent = 'Show';
    }
});

// Remember Me - load saved email
document.addEventListener('DOMContentLoaded', function() {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
        document.getElementById('remember').checked = true;
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    successEl.classList.remove('show');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;

    if (!email || !password) {
        errorEl.textContent = 'All fields are required';
        errorEl.classList.add('show');
        return;
    }

    // Save email if Remember Me is checked
    if (remember) {
        localStorage.setItem('rememberedEmail', email);
    } else {
        localStorage.removeItem('rememberedEmail');
    }

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

        setAuthData(data.data.user);
        window.location.href = 'dashboard.html';

    } catch (error) {
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
});