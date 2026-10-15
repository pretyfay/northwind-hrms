// ===================================================================
// MY LEAVE
// The employee files their own request. The screen never sends
// an employee id — db.js takes it from the session — so this
// page cannot file leave in anyone else's name.
// ===================================================================
import {
getLeaveTypes,
myLeaveBalances,
myLeaveRequests,
createMyLeaveRequest,
submitMyLeaveRequest,
withdrawMyLeaveRequest
} from './db.js';
import { countDays, remaining, today } from './logic/leave.js';
const formEl = document.getElementById('leaveForm');
const alertEl = document.getElementById('alert');
const countEl = document.getElementById('rowCount');
const typeEl = document.getElementById('leaveTypeId');
const fromEl = document.getElementById('fromDate');
const toEl = document.getElementById('toDate');
const reasonEl = document.getElementById('reason');
const daysEl = document.getElementById('daysPreview');
const draftBtn = document.getElementById('draftBtn');
const submitBtn = document.getElementById('submitBtn');
const balancesEl = document.getElementById('balances');
const rowsEl = document.getElementById('rows');
// Kept so the balance rule can be checked before sending.
let types = [];
let balances = [];
// -------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function badgeClass(status) {
const key = String(status || 'draft').toLowerCase().split(' ')[0];
return 'badge badge--' + key;
}
function niceDate(value) {
if (!value) return '—';
const only = String(value).slice(0, 10);
return new Date(only + 'T00:00:00').toLocaleDateString('en-GB', {
day: '2-digit',
month: 'short',
year: 'numeric'
});
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
function typeById(id) {
return types.filter(function (t) {
return String(t.id) === String(id);
})[0] || null;
}
function balanceFor(typeId) {
return balances.filter(function (b) {
return String(b.leave_type_id) === String(typeId);
})[0] || null;
}
// -------------------------------------------------------------------
// THE RULES, CHECKED BEFORE SENDING
// -------------------------------------------------------------------
function readForm() {
return {
leaveTypeId: typeEl.value,
fromDate: fromEl.value,
toDate: toEl.value,
reason: reasonEl.value.trim()
};
}
function validate(form) {
if (!form.leaveTypeId) {
return ['leaveTypeId', 'Choose a leave type.'];
}
if (!form.fromDate) return ['fromDate', 'From date is required.'];
if (!form.toDate) return ['toDate', 'To date is required.'];
if (form.toDate < form.fromDate) {
return ['toDate', 'The end date cannot be before the start.'];
}
const days = countDays(form.fromDate, form.toDate);
const type = typeById(form.leaveTypeId);
// Only types that carry a balance can run out.
if (type && type.has_balance) {
const balance = balanceFor(form.leaveTypeId);
if (!balance) {
return ['leaveTypeId',
'You have no balance set for this type. Contact HR.'];
}
const left = Number(remaining(balance));
if (days > left) {
return ['toDate',
'That is ' + days + ' days but only ' + left +
' are left.'];
}
}
return null;
}
function updateDays() {
if (!fromEl.value || !toEl.value) {
daysEl.textContent = '';
return;
}
const days = countDays(fromEl.value, toEl.value);
if (days < 1) {
daysEl.textContent = '';
return;
}
daysEl.textContent = days === 1 ? '1 day' : days + ' days';
}
// -------------------------------------------------------------------
// SAVE
// -------------------------------------------------------------------
async function save(status) {
clearErrors();
const form = readForm();
const problem = validate(form);
if (problem) {
showError(problem[0], problem[1]);
return;
}
form.status = status;
draftBtn.disabled = true;
submitBtn.disabled = true;
try {
await createMyLeaveRequest(form);
showAlert('success', status === 'Draft'
? 'Saved as a draft.'
: 'Sent to HR.');
resetForm();
load();
} catch (err) {
showAlert('error', err.message);
}
draftBtn.disabled = false;
submitBtn.disabled = false;
}
function resetForm() {
typeEl.value = '';
fromEl.value = '';
toEl.value = '';
reasonEl.value = '';
daysEl.textContent = '';
}
async function handleSubmitDraft(request) {
try {
await submitMyLeaveRequest(request);
showAlert('success', 'Sent to HR.');
load();
} catch (err) {
showAlert('error', err.message);
}
}
async function handleWithdraw(request) {
const ok = window.confirm('Delete this draft?');
if (!ok) return;
try {
await withdrawMyLeaveRequest(request);
showAlert('success', 'Draft deleted.');
load();
} catch (err) {
showAlert('error', err.message);
}
}
// -------------------------------------------------------------------
// THE LISTS
// -------------------------------------------------------------------
function renderBalances() {
if (balances.length === 0) {
balancesEl.innerHTML =
'<div class="state">' +
'<div class="state__text">No balances set yet.</div>' +
'</div>';
return;
}
balancesEl.innerHTML = balances.map(function (b) {
const left = remaining(b);
const low = Number(left) <= 2 ? ' stat__value--bad' : '';
return '<div class="stat">' +
'<div class="stat__label">' +
safe(b.leave_type_name) +
'</div>' +
'<div class="stat__value' + low + '">' +
left +
'</div>' +
'<div class="hint">' +
'taken ' + b.taken_days + ' of ' +
b.entitlement_days +
'</div>' +
'</div>';
}).join('');
}
function renderRows(requests) {
const n = requests.length;
countEl.textContent = n === 1 ? '1 request' : n + ' requests';
if (n === 0) {
rowsEl.innerHTML =
'<tr><td colspan="7">' +
'<div class="state">' +
'<div class="state__title">No requests yet</div>' +
'<div class="state__text">' +
'Use the form above to ask for leave.' +
'</div>' +
'</div>' +
'</td></tr>';
return;
}
rowsEl.innerHTML = requests.map(function (r) {
const type = r.leave_types ? r.leave_types.name : '—';
// Only a draft is still mine to change.
const actions = r.status === 'Draft'
? '<div class="row-actions">' +
'<button class="btn btn--sm" type="button" ' +
'data-send="' + r.id + '">Submit</button>' +
'<button class="btn btn--sm btn--danger" type="button" ' +
'data-del="' + r.id + '">Delete</button>' +
'</div>'
: '<span class="muted">—</span>';
return '<tr>' +
'<td class="strong">' + safe(type) + '</td>' +
'<td>' + niceDate(r.from_date) + '</td>' +
'<td>' + niceDate(r.to_date) + '</td>' +
'<td class="num">' + (r.number_of_days || 0) + '</td>' +
'<td class="muted">' + safe(r.reason || '—') + '</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span></td>' +
'<td>' + actions + '</td>' +
'</tr>';
}).join('');
rowsEl.querySelectorAll('[data-send]').forEach(function (btn) {
btn.addEventListener('click', function () {
const id = btn.getAttribute('data-send');
handleSubmitDraft({ id: id });
});
});
rowsEl.querySelectorAll('[data-del]').forEach(function (btn) {
btn.addEventListener('click', function () {
const id = btn.getAttribute('data-del');
handleWithdraw({ id: id });
});
});
}
async function load() {
rowsEl.innerHTML =
'<tr><td colspan="7">' +
'<span class="skeleton" style="width:220px"></span>' +
'</td></tr>';
try {
balances = await myLeaveBalances();
renderBalances();
const requests = await myLeaveRequests();
renderRows(requests);
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="7">' +
'<div class="state state--error">' +
'<div class="state__title">Could not load</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div>' +
'</td></tr>';
}
}
async function loadTypes() {
try {
types = await getLeaveTypes();
types.forEach(function (t) {
const option = document.createElement('option');
option.value = t.id;
option.textContent = t.name + (t.is_paid ? '' : ' · unpaid');
typeEl.appendChild(option);
});
} catch (err) {
showAlert('error', 'Could not load leave types: ' + err.message);
}
}
// -------------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------------
fromEl.addEventListener('change', updateDays);
toEl.addEventListener('change', updateDays);
draftBtn.addEventListener('click', function () {
save('Draft');
});
formEl.addEventListener('submit', function (event) {
event.preventDefault();
save('Pending Approval');
});
// -------------------------------------------------------------------
// START
// -------------------------------------------------------------------
function start() {
fromEl.value = today();
toEl.value = today();
updateDays();
loadTypes();
load();
}
start();