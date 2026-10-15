// ===================================================================
// EMPLOYEE HOME
// A short answer to "where do I stand" — leave left, recent
// requests, attendance this month. Everything is the signed-in
// person's own.
// ===================================================================
import {
myProfile,
myLeaveBalances,
myLeaveRequests,
myAttendance
} from './db.js';
import { remaining } from './logic/leave.js';
const avatarEl = document.getElementById('avatar');
const nameEl = document.getElementById('name');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('statusBadge');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
const balancesEl = document.getElementById('balances');
const leaveRowsEl = document.getElementById('leaveRows');
const attSummaryEl = document.getElementById('attSummary');
// -------------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------------
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function initials(name) {
const parts = String(name || '').trim().split(/\s+/);
const first = parts[0] ? parts[0][0] : '';
const last = parts[1] ? parts[1][0] : '';
return (first + last).toUpperCase();
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
function thisMonth() {
const now = new Date();
const month = String(now.getMonth() + 1).padStart(2, '0');
return now.getFullYear() + '-' + month;
}
function showAlert(message) {
alertEl.className = 'alert alert--error';
alertEl.textContent = message;
alertEl.hidden = false;
}
// -------------------------------------------------------------------
// RENDER
// -------------------------------------------------------------------
function renderHead(me) {
avatarEl.textContent = initials(me.full_name);
nameEl.textContent = me.full_name;
const dept = me.departments ? me.departments.name : '—';
const desg = me.designations ? me.designations.name : '—';
metaEl.textContent = me.employee_code + ' · ' + desg + ' · ' + dept;
statusEl.className = badgeClass(me.status);
statusEl.textContent = me.status;
countEl.textContent = me.employee_code;
}
function renderBalances(rows) {
if (rows.length === 0) {
balancesEl.innerHTML =
'<div class="state">' +
'<div class="state__text">No balances set yet.</div>' +
'</div>';
return;
}
balancesEl.innerHTML = rows.map(function (b) {
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
'of ' + b.entitlement_days + ' days left' +
'</div>' +
'</div>';
}).join('');
}
function renderLeave(rows) {
const recent = rows.slice(0, 5);
if (recent.length === 0) {
leaveRowsEl.innerHTML =
'<tr><td colspan="4">' +
'<div class="state">' +
'<div class="state__text">No requests yet.</div>' +
'</div>' +
'</td></tr>';
return;
}
leaveRowsEl.innerHTML = recent.map(function (r) {
const type = r.leave_types ? r.leave_types.name : '—';
return '<tr>' +
'<td>' + safe(type) + '</td>' +
'<td>' + niceDate(r.from_date) + '</td>' +
'<td class="num">' + (r.number_of_days || 0) + '</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span></td>' +
'</tr>';
}).join('');
}
function renderAttendance(rows) {
if (rows.length === 0) {
attSummaryEl.innerHTML =
'<div class="state">' +
'<div class="state__text">' +
'Nothing recorded this month yet.' +
'</div>' +
'</div>';
return;
}
const counts = {};
let hours = 0;
rows.forEach(function (r) {
counts[r.status] = (counts[r.status] || 0) + 1;
hours += Number(r.working_hours || 0);
});
let html = '';
Object.keys(counts).forEach(function (key) {
html += '<div class="balance-bar__item">' +
'<div class="balance-bar__label">' +
safe(key) +
'</div>' +
'<div class="balance-bar__value">' +
counts[key] +
'</div>' +
'</div>';
});
html += '<div class="balance-bar__item">' +
'<div class="balance-bar__label">Hours</div>' +
'<div class="balance-bar__value">' +
hours.toFixed(1) +
'</div>' +
'</div>';
attSummaryEl.innerHTML = html;
}
// -------------------------------------------------------------------
// START
// -------------------------------------------------------------------
async function start() {
try {
const me = await myProfile();
if (!me) return;
renderHead(me);
// None of these depend on each other, so they go together.
const data = await Promise.all([
myLeaveBalances(),
myLeaveRequests(),
myAttendance(thisMonth())
]);
renderBalances(data[0]);
renderLeave(data[1]);
renderAttendance(data[2]);
} catch (err) {
showAlert(err.message);
}
}
start();