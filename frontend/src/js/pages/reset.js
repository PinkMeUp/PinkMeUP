import { API_URL } from '../utils/auth.js';

const form = document.getElementById('reset-form');
const errorDisplay = document.getElementById('form-error');
const successDisplay = document.getElementById('form-success');
const emailError = document.getElementById('email-error');

const clearMessages = () => {
  errorDisplay.textContent = '';
  errorDisplay.classList.remove('show');
  successDisplay.textContent = '';
  successDisplay.classList.remove('show');
  emailError.textContent = '';
  emailError.classList.remove('show');
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const email = document.getElementById('email').value.trim();

  if (!email) {
    emailError.textContent = 'Email is required';
    emailError.classList.add('show');
    return;
  }

  const btn = document.getElementById('reset-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      errorDisplay.textContent = data.message || 'Something went wrong. Please try again.';
      errorDisplay.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Send Reset Link';
      return;
    }

    successDisplay.textContent = 'Reset link sent to your email. Please check your inbox.';
    successDisplay.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
    document.getElementById('email').value = '';

  } catch (error) {
    errorDisplay.textContent = 'Network error. Please check your connection.';
    errorDisplay.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
});