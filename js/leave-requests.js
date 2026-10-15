
// LEAVE REQUESTS PAGE

import {
getLeaveRequests,
createLeaveRequest,
getActiveEmployees,
getLeaveTypes,
getBalance,
findUserIdByName
} from './db.js';
import {
countDays,
remaining,
checkBalance,
validateRequest,
hasErrors
} from './logic/leave.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';

// ELEMENTS

const formEl = document.getElementById('leaveForm');
const alertEl = document.getElementById('alert');
const rowsEl = document.getElementById('leaveRows');
const countEl = document.getElementById('rowCount');
const employeeEl = document.getElementById('employeeId');
const typeEl = document.getElementById('leaveTypeId');
const fromEl = document.getElementById('fromDate');
const toEl = document.getElementById('toDate');
const reasonEl = document.getElementById('reason');
const daysOutEl = document.getElementById('daysOut');
const balanceOutEl = document.getElementById('balanceOut');
const afterOutEl = document.getElementById('afterOut');
const draftBtn = document.getElementById('draftBtn');
const submitBtn = document.getElementById('submitBtn');
const empFilterEl = document.getElementById('employeeFilter');
const typeFilterEl = document.getElementById('typeFilter');
const statusFilterEl = document.getElementById('statusFilter');
const clearBtn = document.getElementById('clearFilters');
const userEl = document.getElementById('userSwitcher');
let leaveTypes = [];
let chosenStatus = 'Draft';
let currentBalance = null;

// HELPERS

function badgeClass(status) {
const key = String(status || 'draft')
.toLowerCase()
.split(' ')[0];
return 'badge badge--' + key;
}
function initials(name) {
const parts = String(name || '').trim().split(/\s+/);
const a = parts[0] ? parts[0][0] : '';
const b = parts[1] ? parts[1][0] : '';
return (a + b).toUpperCase();
}
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function niceDate(value) {
if (!value) return '—';
return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {
day: '2-digit', month: 'short', year: 'numeric'
});
}
function showAlert(kind, message) {
alertEl.className = 'alert alert--' + kind;
alertEl.textContent = message;
alertEl.hidden = false;
window.scrollTo({ top: 0, behavior: 'smooth' });
}
function findType(id) {
return leaveTypes.find(function (t) {
return String(t.id) === String(id);
});
}

// READ THE FORM

function readForm() {
return {
employeeId: employeeEl.value,
leaveTypeId: typeEl.value,
fromDate: fromEl.value,
toDate: toEl.value,
reason: reasonEl.value.trim(),
status: chosenStatus
};
}

// LIVE BALANCE BAR

async function updateBalanceBar() {
const days = countDays(fromEl.value, toEl.value);
daysOutEl.textContent = days;
const type = findType(typeEl.value);
if (!type || !employeeEl.value) {
balanceOutEl.textContent = '—';
afterOutEl.textContent = '—';
currentBalance = null;
return;
}
// Unpaid leave has no balance at all.
if (!type.has_balance) {
balanceOutEl.textContent = 'Not applicable';
afterOutEl.textContent = 'Deducted from salary';
currentBalance = null;
return;
}
const year = fromEl.value
? Number(fromEl.value.slice(0, 4))
: new Date().getFullYear();
try {
currentBalance = await getBalance(
employeeEl.value,
typeEl.value,
year
);
if (!currentBalance) {
balanceOutEl.textContent = 'None';
afterOutEl.textContent = '—';
return;
}
const left = remaining(currentBalance);
balanceOutEl.textContent = left + ' days';
const after = left - days;
afterOutEl.textContent = after + ' days';
afterOutEl.className = 'balance-bar__value' +
(after < 0 ? ' balance-bar__value--bad' : '');
} catch (err) {
balanceOutEl.textContent = '—';
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
alertEl.hidden = true;
}
function showErrors(errors) {
Object.keys(errors).forEach(function (field) {
const msgEl = formEl.querySelector('[data-err="' + field + '"]');
if (msgEl) msgEl.textContent = errors[field];
const inputEl = formEl.querySelector('[name="' + field + '"]');
if (inputEl) inputEl.classList.add('is-invalid');
});
}

// SUBMIT

async function handleSubmit(event) {
event.preventDefault();
clearErrors();
const form = readForm();
const errors = validateRequest(form);
if (hasErrors(errors)) {
showErrors(errors);
showAlert('error', 'Please fix the highlighted fields.');
return;
}
// The balance rule lives in logic/leave.js so the approval
// screen can run exactly the same check later.
const days = countDays(form.fromDate, form.toDate);
const type = findType(form.leaveTypeId);
const problem = checkBalance(type, currentBalance, days);
if (problem) {
showAlert('error', problem);
return;
}
draftBtn.disabled = true;
submitBtn.disabled = true;
try {
const userId = await findUserIdByName(getCurrentUser().name);
const created = await createLeaveRequest(form, userId);
showAlert(
'success',
'Leave request saved — ' + created.number_of_days + ' days.'
);
resetForm();
loadRequests();
} catch (err) {
showAlert('error', err.message);
}
draftBtn.disabled = false;
submitBtn.disabled = false;
}
function resetForm() {
fromEl.value = '';
toEl.value = '';
reasonEl.value = '';
updateBalanceBar();
}

// TABLE

function showSkeleton() {
let html = '';
for (let i = 0; i < 4; i++) {
html += '<tr>' +
'<td><span class="skeleton" style="width:130px"></span></td>' +
'<td><span class="skeleton" style="width:80px"></span></td>' +
'<td><span class="skeleton" style="width:80px"></span></td>' +
'<td><span class="skeleton" style="width:80px"></span></td>' +
'<td><span class="skeleton" style="width:30px"></span></td>' +
'<td><span class="skeleton" style="width:90px"></span></td>' +
'<td><span class="skeleton" style="width:70px"></span></td>' +
'</tr>';
}
rowsEl.innerHTML = html;
}
function renderRows(rows) {
countEl.textContent =
rows.length === 1 ? '1 request' : rows.length + ' requests';
if (rows.length === 0) {
rowsEl.innerHTML =
'<tr><td colspan="7"><div class="state">' +
'<div class="state__title">No leave requests</div>' +
'<div class="state__text">Use the form above.</div>' +
'</div></td></tr>';
return;
}
rowsEl.innerHTML = rows.map(function (r) {
const emp = r.employees || {};
const type = r.leave_types || {};
return '<tr>' +
'<td><div class="person">' +
'<span class="avatar">' +
safe(initials(emp.full_name)) + '</span>' +
'<span class="person__name">' +
safe(emp.full_name || '—') + '</span>' +
'</div></td>' +
'<td>' + safe(type.name || '—') + '</td>' +
'<td>' + niceDate(r.from_date) + '</td>' +
'<td>' + niceDate(r.to_date) + '</td>' +
'<td class="num">' + r.number_of_days + '</td>' +
'<td class="muted">' + safe(r.reason || '—') + '</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) + '</span></td>' +
'</tr>';
}).join('');
}
async function loadRequests() {
showSkeleton();
try {
const rows = await getLeaveRequests({
employeeId: empFilterEl.value,
leaveTypeId: typeFilterEl.value,
status: statusFilterEl.value
});
renderRows(rows);
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="7"><div class="state state--error">' +
'<div class="state__title">Could not load</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div></td></tr>';
}
}

// DROPDOWNS

async function loadDropdowns() {
try {
const employees = await getActiveEmployees();
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
leaveTypes = await getLeaveTypes();
leaveTypes.forEach(function (t) {
const a = document.createElement('option');
a.value = t.id;
a.textContent = t.name + (t.has_balance ? '' : ' (no balance)');
typeEl.appendChild(a);
const b = document.createElement('option');
b.value = t.id;
b.textContent = t.name;
typeFilterEl.appendChild(b);
});
} catch (err) {
showAlert('error', 'Could not load lists: ' + err.message);
}
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

employeeEl.addEventListener('change', updateBalanceBar);
typeEl.addEventListener('change', updateBalanceBar);
fromEl.addEventListener('change', updateBalanceBar);
toEl.addEventListener('change', updateBalanceBar);
draftBtn.addEventListener('click', function () {
chosenStatus = 'Draft';
});
submitBtn.addEventListener('click', function () {
chosenStatus = 'Pending Approval';
});
formEl.addEventListener('submit', handleSubmit);
empFilterEl.addEventListener('change', loadRequests);
typeFilterEl.addEventListener('change', loadRequests);
statusFilterEl.addEventListener('change', loadRequests);
clearBtn.addEventListener('click', function () {
empFilterEl.value = '';
typeFilterEl.value = '';
statusFilterEl.value = '';
loadRequests();
});

// START

function start() {
loadUserSwitcher();
loadDropdowns();
loadRequests();
}

start();