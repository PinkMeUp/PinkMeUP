import { API_URL, setAuthData } from '../utils/auth.js';

const form = document.getElementById('login-form');
const errorDisplay = document.getElementById('form-error');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');

const clearErrors = () => {
  errorDisplay.textContent = '';
  errorDisplay.classList.remove('show');
  emailError.textContent = '';
  emailError.classList.remove('show');
  passwordError.textContent = '';
  passwordError.classList.remove('show');
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  let isValid = true;
  if (!email) { emailError.textContent = 'Email is required'; emailError.classList.add('show'); isValid = false; }
  if (!password) { passwordError.textContent = 'Password is required'; passwordError.classList.add('show'); isValid = false; }

  if (!isValid) return;

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
      errorDisplay.textContent = data.message || 'Invalid email or password.';
      errorDisplay.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    setAuthData(data.data.user);
window.location.href = '/frontend/src/views/dashboard.html';
  } catch (error) {
    errorDisplay.textContent = 'Network error. Please check your connection.';
    errorDisplay.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});