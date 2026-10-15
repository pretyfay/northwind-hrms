
// LEAVE APPROVAL PAGE
//
// One card per pending request. Approving deducts the balance;
// rejecting demands a reason.

import {
getLeaveRequests,
approveLeaveRequest,
rejectLeaveRequest,
getBalance,
findUserIdByName
} from './db.js';
import {
remaining,
checkBalance,
validateRejection
} from './logic/leave.js';
import { canTransition } from './logic/status.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';
const cardsEl = document.getElementById('cards');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
const userEl = document.getElementById('userSwitcher');
// Keep the loaded requests so the buttons can find them again.
let pending = [];

// HELPERS

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

// DRAW THE CARDS

function renderCards() {
countEl.textContent = pending.length === 1
? '1 request waiting'
: pending.length + ' requests waiting';
if (pending.length === 0) {
cardsEl.innerHTML =
'<div class="panel"><div class="state">' +
'<div class="state__title">Nothing to approve</div>' +
'<div class="state__text">' +
'Every request has been handled.' +
'</div>' +
'</div></div>';
return;
}
cardsEl.innerHTML = pending.map(function (r) {
const emp = r.employees || {};
const type = r.leave_types || {};
return '<article class="approval" data-id="' + r.id + '">' +
'<div class="approval__head">' +
'<span class="avatar avatar--lg">' +
safe(initials(emp.full_name)) +
'</span>' +
'<div class="approval__who">' +
'<div class="approval__name">' +
safe(emp.full_name || '—') +
'</div>' +
'<div class="mono approval__code">' +
safe(emp.employee_code || '') +
'</div>' +
'</div>' +
'<span class="badge badge--pending">Pending Approval</span>' +
'</div>' +
'<div class="approval__facts">' +
fact('Leave type', safe(type.name || '—')) +
fact('From', niceDate(r.from_date)) +
fact('To', niceDate(r.to_date)) +
fact('Days', r.number_of_days) +
fact('Balance after', '<span data-bal="' + r.id + '">…' +
'</span>') +
'</div>' +
'<div class="approval__reason">' +
'<span class="approval__reason-label">Reason</span>' +
safe(r.reason || '—') +
'</div>' +
'<div class="approval__reject" data-reject="' + r.id + '"' +
' hidden>' +
'<label class="lbl" for="rr-' + r.id + '">' +
'Rejection reason (required)' +
'</label>' +
'<input class="input" id="rr-' + r.id + '" type="text"' +
' placeholder="Why is this being rejected?">' +
'<p class="err" data-rerr="' + r.id + '"></p>' +
'</div>' +
'<div class="approval__actions">' +
'<button class="btn btn--danger" type="button"' +
' data-act="reject" data-id="' + r.id + '">' +
'Reject' +
'</button>' +
'<button class="btn btn--primary" type="button"' +
' data-act="approve" data-id="' + r.id + '">' +
'Approve' +
'</button>' +
'</div>' +
'</article>';
}).join('');
wireButtons();
fillBalances();
}
function fact(label, value) {
return '<div class="fact">' +
'<span class="fact__label">' + label + '</span>' +
'<span class="fact__value">' + value + '</span>' +
'</div>';
}
// Show what the balance would be if this request were approved.
async function fillBalances() {
for (const r of pending) {
const slot = document.querySelector('[data-bal="' + r.id + '"]');
if (!slot) continue;
const type = r.leave_types || {};
if (!type.has_balance) {
slot.textContent = 'Not applicable';
continue;
}
try {
const year = Number(String(r.from_date).slice(0, 4));
const balance = await getBalance(
r.employee_id, r.leave_type_id, year
);
if (!balance) {
slot.textContent = 'No balance';
continue;
}
const after = remaining(balance) - Number(r.number_of_days);
slot.textContent = after + ' days';
if (after < 0) {
slot.className = 'text-bad';
}
} catch (err) {
slot.textContent = '—';
}
}
}

// BUTTONS

function wireButtons() {
cardsEl.querySelectorAll('[data-act]').forEach(function (btn) {
btn.addEventListener('click', function () {
const id = btn.getAttribute('data-id');
const act = btn.getAttribute('data-act');
if (act === 'approve') {
handleApprove(id);
} else {
handleReject(id);
}
});
});
}
function findRequest(id) {
return pending.find(function (r) {
return String(r.id) === String(id);
});
}

// APPROVE

async function handleApprove(id) {
const request = findRequest(id);
if (!request) return;
// The status engine decides whether this move is legal.
if (!canTransition('leave_request', request.status, 'Approved')) {
showAlert('error',
'This request cannot be approved from ' + request.status + '.');
return;
}
// Re-check the balance. The one taken at submit time may be
// stale — another request could have used it since.
const type = request.leave_types || {};
if (type.has_balance) {
const year = Number(String(request.from_date).slice(0, 4));
const balance = await getBalance(
request.employee_id, request.leave_type_id, year
);
const problem = checkBalance(
type, balance, Number(request.number_of_days)
);
if (problem) {
showAlert('error', problem);
return;
}
}
try {
const userId = await findUserIdByName(getCurrentUser().name);
await approveLeaveRequest(request, userId);
showAlert('success', 'Leave approved and balance updated.');
load();
} catch (err) {
showAlert('error', err.message);
}
}

// REJECT

async function handleReject(id) {
const box = document.querySelector('[data-reject="' + id + '"]');
if (!box) return;
// First click opens the reason box. Second click submits.
if (box.hidden) {
box.hidden = false;
box.querySelector('input').focus();
return;
}
const input = box.querySelector('input');
const errEl = document.querySelector('[data-rerr="' + id + '"]');
const reason = input.value.trim();
const problem = validateRejection(reason);
if (problem) {
errEl.textContent = problem;
input.classList.add('is-invalid');
return;
}
const request = findRequest(id);
if (!request) return;
try {
const userId = await findUserIdByName(getCurrentUser().name);
await rejectLeaveRequest(request, reason, userId);
showAlert('success', 'Leave rejected.');
load();
} catch (err) {
showAlert('error', err.message);
}
}

// LOAD
async function load() {
cardsEl.innerHTML =
'<div class="panel"><div class="state">Loading…</div></div>';
try {
pending = await getLeaveRequests({ status: 'Pending Approval' });
renderCards();
} catch (err) {
cardsEl.innerHTML =
'<div class="panel"><div class="state state--error">' +
'<div class="state__title">Could not load requests</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div></div>';
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
function start() {
loadUserSwitcher();
load();
}

start();