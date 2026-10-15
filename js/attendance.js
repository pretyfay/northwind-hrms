// ATTENDANCE PAGE
// Reads the form, calls the logic, calls the database, draws the
// table. No rules are decided here.

import {
getAttendance,
createAttendance,
deleteAttendance,
getActiveEmployees,
findUserIdByName
} from './db.js';
import {
STATUSES,
NON_WORKING,
calculateHours,
suggestStatus,
validateAttendance,
hasErrors,
today
} from './logic/attendance.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';

// ELEMENTS

const formEl = document.getElementById('attendanceForm');
const alertEl = document.getElementById('alert');
const hoursEl = document.getElementById('hoursPreview');
const rowsEl = document.getElementById('attendanceRows');
const countEl = document.getElementById('rowCount');
const saveBtn = document.getElementById('saveBtn');
const employeeEl = document.getElementById('employeeId');
const dateEl = document.getElementById('date');
const checkInEl = document.getElementById('checkIn');
const checkOutEl = document.getElementById('checkOut');
const statusEl = document.getElementById('status');
const empFilterEl = document.getElementById('employeeFilter');
const dateFilterEl = document.getElementById('dateFilter');
const statusFilterEl = document.getElementById('statusFilter');
const clearBtn = document.getElementById('clearFilters');
const userEl = document.getElementById('userSwitcher');
// The user changed the status themselves, so stop suggesting one.
let statusTouched = false;

// HELPERS

function badgeClass(status) {
const key = String(status || 'draft')
.toLowerCase()
.replace(' ', '-')
.split('-')[0];
return 'badge badge--' + key;
}
function initials(name) {
const parts = String(name || '').trim().split(/\s+/);
const first = parts[0] ? parts[0][0] : '';
const last = parts[1] ? parts[1][0] : '';
return (first + last).toUpperCase();
}
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
// "2026-09-28" becomes "28 Sep 2026"
function niceDate(value) {
if (!value) return '—';
return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {
day: '2-digit',
month: 'short',
year: 'numeric'
});
}
// "08:30:00" becomes "08:30"
function niceTime(value) {
if (!value) return '—';
return String(value).slice(0, 5);
}
function showAlert(kind, message) {
alertEl.className = 'alert alert--' + kind;
alertEl.textContent = message;
alertEl.hidden = false;
window.scrollTo({ top: 0, behavior: 'smooth' });
}
function hideAlert() {
alertEl.hidden = true;
}

// READ THE FORM

function readForm() {
return {
employeeId: employeeEl.value,
date: dateEl.value,
checkIn: checkInEl.value,
checkOut: checkOutEl.value,
status: statusEl.value,
remarks: document.getElementById('remarks').value.trim()
};
}

// LIVE HOURS AND SUGGESTED STATUS

function updateLive() {
const hours = calculateHours(checkInEl.value, checkOutEl.value);
hoursEl.textContent = 'Working hours: ' + hours.toFixed(2);
if (!statusTouched && checkInEl.value) {
statusEl.value = suggestStatus(
checkInEl.value,
checkOutEl.value
);
}
// Times make no sense for these statuses, so grey them out.
const off = NON_WORKING.includes(statusEl.value);
checkInEl.disabled = off;
checkOutEl.disabled = off;
if (off) {
checkInEl.value = '';
checkOutEl.value = '';
hoursEl.textContent = 'Working hours: 0.00';
}
}

// ERRORS

function clearErrors() {
formEl.querySelectorAll('.err').forEach(function (el) {
el.textContent = '';
});
formEl.querySelectorAll('.is-invalid').forEach(function (el) {
el.classList.remove('is-invalid');
});
hideAlert();
}
function showErrors(errors) {
Object.keys(errors).forEach(function (field) {
const msgEl = formEl.querySelector('[data-err="' + field + '"]');
if (msgEl) msgEl.textContent = errors[field];
const inputEl = formEl.querySelector('[name="' + field + '"]');
if (inputEl) inputEl.classList.add('is-invalid');
});
}

// SAVE

async function handleSubmit(event) {
event.preventDefault();
clearErrors();
const record = readForm();
const errors = validateAttendance(record);
if (hasErrors(errors)) {
showErrors(errors);
return;
}
saveBtn.disabled = true;
saveBtn.textContent = 'Saving…';
try {
const userId = await findUserIdByName(getCurrentUser().name);
await createAttendance(record, userId);
showAlert('success', 'Attendance recorded.');
resetForm();
loadRecords();
} catch (err) {
showAlert('error', err.message);
}
saveBtn.disabled = false;
saveBtn.textContent = 'Save record';
}
function resetForm() {
checkInEl.value = '';
checkOutEl.value = '';
document.getElementById('remarks').value = '';
statusTouched = false;
statusEl.value = 'Present';
checkInEl.disabled = false;
checkOutEl.disabled = false;
updateLive();
}

// DELETE

async function handleDelete(id) {
const ok = window.confirm('Remove this attendance record?');
if (!ok) return;
try {
const userId = await findUserIdByName(getCurrentUser().name);
await deleteAttendance(id, userId);
showAlert('success', 'Record removed.');
loadRecords();
} catch (err) {
showAlert('error', err.message);
}
}

// THE TABLE

function showSkeleton() {
let html = '';
for (let i = 0; i < 4; i++) {
html += '<tr>' +
'<td><span class="skeleton" style="width:80px"></span></td>' +
'<td><span class="skeleton" style="width:130px"></span></td>' +
'<td><span class="skeleton" style="width:50px"></span></td>' +
'<td><span class="skeleton" style="width:50px"></span></td>' +
'<td><span class="skeleton" style="width:40px"></span></td>' +
'<td><span class="skeleton" style="width:60px"></span></td>' +
'<td><span class="skeleton" style="width:70px"></span></td>' +
'<td></td>' +
'</tr>';
}
rowsEl.innerHTML = html;
}
function renderRows(records) {
const n = records.length;
countEl.textContent = n === 1 ? '1 record' : n + ' records';
if (n === 0) {
rowsEl.innerHTML =
'<tr><td colspan="8">' +
'<div class="state">' +
'<div class="state__title">No attendance records</div>' +
'<div class="state__text">' +
'Use the form above to record the first one.' +
'</div>' +
'</div>' +
'</td></tr>';
return;
}
rowsEl.innerHTML = records.map(function (r) {
const emp = r.employees || {};
const hours = Number(r.working_hours || 0);
return '<tr>' +
'<td>' + niceDate(r.attendance_date) + '</td>' +
'<td>' +
'<div class="person">' +
'<span class="avatar">' +
safe(initials(emp.full_name)) +
'</span>' +
'<span class="person__name">' +
safe(emp.full_name || '—') +
'</span>' +
'</div>' +
'</td>' +
'<td>' + niceTime(r.check_in) + '</td>' +
'<td>' + niceTime(r.check_out) + '</td>' +
'<td class="num">' + hours.toFixed(2) + '</td>' +
'<td>' +
'<span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span>' +
'</td>' +
'<td class="muted">' + safe(r.remarks || '—') + '</td>' +
'<td class="num">' +
'<button class="icon-btn" type="button" ' +
'data-del="' + r.id + '" title="Remove">' +
'&times;' +
'</button>' +
'</td>' +
'</tr>';
}).join('');
rowsEl.querySelectorAll('[data-del]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleDelete(btn.getAttribute('data-del'));
});
});
}
async function loadRecords() {
showSkeleton();
try {
const records = await getAttendance({
employeeId: empFilterEl.value,
date: dateFilterEl.value,
status: statusFilterEl.value
});
renderRows(records);
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="8">' +
'<div class="state state--error">' +
'<div class="state__title">Could not load records</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div>' +
'</td></tr>';
}
}

// DROPDOWNS

async function loadEmployees() {
try {
const employees = await getActiveEmployees();
if (employees.length === 0) {
showAlert(
'error',
'No active employees. Activate an employee first.'
);
}
employees.forEach(function (e) {
const label = e.full_name + ' · ' + e.employee_code;
const a = document.createElement('option');
a.value = e.id;
a.textContent = label;
employeeEl.appendChild(a);
const b = document.createElement('option');
b.value = e.id;
b.textContent = label;
empFilterEl.appendChild(b);
});
} catch (err) {
showAlert('error', 'Could not load employees: ' + err.message);
}
}
function loadStatuses() {
STATUSES.forEach(function (s) {
const a = document.createElement('option');
a.value = s;
a.textContent = s;
statusEl.appendChild(a);
const b = document.createElement('option');
b.value = s;
b.textContent = s;
statusFilterEl.appendChild(b);
});
statusEl.value = 'Present';
}
function loadUserSwitcher() {
USERS.forEach(function (u, index) {
const option = document.createElement('option');
option.value = index;
option.textContent = u.name + ' · ' + u.role;
userEl.appendChild(option);
});
userEl.addEventListener('change', function () {
setCurrentUser(userEl.value);
});
}

// EVENTS

checkInEl.addEventListener('input', updateLive);
checkOutEl.addEventListener('input', updateLive);
statusEl.addEventListener('change', function () {
statusTouched = true;
updateLive();
});
formEl.addEventListener('submit', handleSubmit);
empFilterEl.addEventListener('change', loadRecords);
dateFilterEl.addEventListener('change', loadRecords);
statusFilterEl.addEventListener('change', loadRecords);
clearBtn.addEventListener('click', function () {
empFilterEl.value = '';
dateFilterEl.value = '';
statusFilterEl.value = '';
loadRecords();
});

// START

function start() {
loadUserSwitcher();
loadStatuses();
loadEmployees();
dateEl.value = today();
dateEl.setAttribute('max', today());
updateLive();
loadRecords();
}
start();