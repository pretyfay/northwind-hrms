// ===================================================================
// REGISTER
// The employee creates their own account with the work email HR
// already has on file. The database trigger links the two.
// ===================================================================
import { supabase } from './db.js';
import { getCurrentEmployee, homeFor, signOut } from './auth.js';
const formEl = document.getElementById('registerForm');
const alertEl = document.getElementById('alert');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const confirmEl = document.getElementById('confirm');
const submitBtn = document.getElementById('submitBtn');
function showAlert(kind, message) {
alertEl.className = 'alert alert--' + kind;
alertEl.textContent = message;
alertEl.hidden = false;
window.scrollTo({ top: 0, behavior: 'smooth' });
}
function clearErrors() {
formEl.querySelectorAll('.err').forEach(function (el) {
el.textContent = '';
});
formEl.querySelectorAll('.is-invalid').forEach(function (el) {
el.classList.remove('is-invalid');
});
alertEl.hidden = true;
}
function showError(field, message) {
const msgEl = formEl.querySelector('[data-err="' + field + '"]');
if (msgEl) msgEl.textContent = message;
const inputEl = formEl.querySelector('[name="' + field + '"]');
if (inputEl) inputEl.classList.add('is-invalid');
}
function validate(email, password, confirm) {
if (!email) return ['email', 'Work email is required.'];
if (email.indexOf('@') === -1) {
return ['email', 'That does not look like an email address.'];
}
if (!password) return ['password', 'Password is required.'];
if (password.length < 8) {
return ['password', 'Use at least 8 characters.'];
}
if (password !== confirm) {
return ['confirm', 'The two passwords do not match.'];
}
return null;
}
async function handleSubmit(event) {
event.preventDefault();
clearErrors();
const email = emailEl.value.trim();
const password = passwordEl.value;
const confirm = confirmEl.value;
const problem = validate(email, password, confirm);
if (problem) {
showError(problem[0], problem[1]);
return;
}
submitBtn.disabled = true;
submitBtn.textContent = 'Creating…';
try {
const result = await supabase.auth.signUp({
email: email,
password: password
});
if (result.error) {
throw new Error(result.error.message);
}
// The trigger has now run. Did it find an employee with
// this email?
const employee = await getCurrentEmployee();
if (!employee) {
await signOut();
throw new Error(
'Your account was created, but no employee record ' +
'uses this email. Ask HR to add you, then sign in.'
);
}
window.location.replace(homeFor(employee));
} catch (err) {
showAlert('error', err.message);
submitBtn.disabled = false;
submitBtn.textContent = 'Create account';
}
}
function start() {
formEl.addEventListener('submit', handleSubmit);
emailEl.focus();
}
start();