import { API_URL, setAuthData } from '../utils/auth.js';

const form = document.getElementById('register-form');
const errorDisplay = document.getElementById('form-error');

const firstNameError = document.getElementById('firstName-error');
const lastNameError = document.getElementById('lastName-error');
const emailError = document.getElementById('email-error');
const phoneError = document.getElementById('phone-error');
const passwordError = document.getElementById('password-error');

const clearErrors = () => {
  errorDisplay.textContent = '';
  errorDisplay.classList.remove('show');
  [firstNameError, lastNameError, emailError, phoneError, passwordError].forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
};

const showFieldError = (field, message) => {
  const errorMap = {
    firstName: firstNameError,
    lastName: lastNameError,
    email: emailError,
    phone: phoneError,
    password: passwordError
  };
  const el = errorMap[field];
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  let isValid = true;
  if (!firstName) { showFieldError('firstName', 'First name is required'); isValid = false; }
  if (!lastName) { showFieldError('lastName', 'Last name is required'); isValid = false; }
  if (!email) { showFieldError('email', 'Email is required'); isValid = false; }
  if (!phone) { showFieldError('phone', 'Phone number is required'); isValid = false; }
  if (!password || password.length < 6) { 
    showFieldError('password', 'Password must be at least 6 characters'); 
    isValid = false; 
  }

  if (!isValid) return;

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
      errorDisplay.textContent = data.message || 'Registration failed. Please try again.';
      errorDisplay.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }

    setAuthData(data.data.user);
    window.location.href = 'login.html';

  } catch (error) {
    errorDisplay.textContent = 'Network error. Please check your connection.';
    errorDisplay.classList.add('show');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});