
// SIGN IN
// Takes an email and a password, hands them to Supabase, and
// sends the person wherever their role belongs.

import { supabase } from './db.js';
import {
getSession,
getCurrentEmployee,
homeFor,
signOut
} from './auth.js';
const formEl = document.getElementById('loginForm');
const alertEl = document.getElementById('alert');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');

// MESSAGES

// Reasons the guard may have sent somebody back here.
const REASONS = {
unlinked: 'That account is not linked to an employee record. ' +
'Ask HR to add you first.',
inactive: 'Your employee record is not active. ' +
'Please contact HR.'
};
function showAlert(kind, message) {
alertEl.className = 'alert alert--' + kind;
alertEl.textContent = message;
alertEl.hidden = false;
}
function hideAlert() {
alertEl.hidden = true;
}
function clearErrors() {
formEl.querySelectorAll('.err').forEach(function (el) {
el.textContent = '';
});
formEl.querySelectorAll('.is-invalid').forEach(function (el) {
el.classList.remove('is-invalid');
});
hideAlert();
}
function showError(field, message) {
const msgEl = formEl.querySelector('[data-err="' + field + '"]');
if (msgEl) msgEl.textContent = message;
const inputEl = formEl.querySelector('[name="' + field + '"]');
if (inputEl) inputEl.classList.add('is-invalid');
}

// SIGN IN

async function handleSubmit(event) {
event.preventDefault();
clearErrors();
const email = emailEl.value.trim();
const password = passwordEl.value;
if (!email) {
showError('email', 'Email is required.');
return;
}
if (!password) {
showError('password', 'Password is required.');
return;
}
submitBtn.disabled = true;
submitBtn.textContent = 'Signing in…';
try {
const result = await supabase.auth.signInWithPassword({
email: email,
password: password
});
if (result.error) {
// Supabase deliberately does not say whether it was the
// email or the password that was wrong. Telling an
// attacker which emails exist is a gift. We keep that.
throw new Error('Email or password is incorrect.');
}
const employee = await getCurrentEmployee();
if (!employee) {
await signOut();
throw new Error(REASONS.unlinked);
}
if (employee.status !== 'Active') {
await signOut();
throw new Error(REASONS.inactive);
}
window.location.replace(homeFor(employee));
} catch (err) {
showAlert('error', err.message);
submitBtn.disabled = false;
submitBtn.textContent = 'Sign in';
}
}

// START

async function start() {
// Did the guard send somebody back here with a reason?
const params = new URLSearchParams(window.location.search);
const reason = params.get('error');
if (reason && REASONS[reason]) {
showAlert('error', REASONS[reason]);
}
// Already signed in? Then there is nothing to do here.
const session = await getSession();
if (session) {
const employee = await getCurrentEmployee();
if (employee && employee.status === 'Active') {
window.location.replace(homeFor(employee));
return;
}
}
formEl.addEventListener('submit', handleSubmit);
emailEl.focus();
}
start();