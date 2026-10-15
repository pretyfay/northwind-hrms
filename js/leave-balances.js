
// LEAVE BALANCES PAGE
// Read-only. Remaining days are calculated by the view, never
// stored in a column.

import {
getLeaveBalances,
getActiveEmployees
} from './db.js';
import { USERS, setCurrentUser } from './config.js';
const rowsEl = document.getElementById('balanceRows');
const countEl = document.getElementById('rowCount');
const empFilterEl = document.getElementById('employeeFilter');
const yearFilterEl = document.getElementById('yearFilter');
const userEl = document.getElementById('userSwitcher');
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
function renderRows(rows) {
countEl.textContent =
rows.length === 1 ? '1 balance' : rows.length + ' balances';
if (rows.length === 0) {
rowsEl.innerHTML =
'<tr><td colspan="6"><div class="state">' +
'<div class="state__title">No balances</div>' +
'</div></td></tr>';
return;
}
rowsEl.innerHTML = rows.map(function (b) {
const entitled = Number(b.entitlement_days) || 0;
const taken = Number(b.taken_days) || 0;
const left = Number(b.remaining_days) || 0;
const percent = entitled > 0
? Math.round((taken / entitled) * 100)
: 0;
const low = entitled > 0 && left <= entitled * 0.2;
return '<tr>' +
'<td><div class="person">' +
'<span class="avatar">' +
safe(initials(b.full_name)) + '</span>' +
'<span class="person__name">' +
safe(b.full_name) + '</span>' +
'</div></td>' +
'<td>' + safe(b.leave_type_name) + '</td>' +
'<td class="num">' + entitled + '</td>' +
'<td class="num">' + taken + '</td>' +
'<td class="num' + (low ? ' text-bad' : '') + '">' +
left + '</td>' +
'<td>' +
'<span class="bar__track">' +
'<span class="bar__fill' +
(low ? ' bar__fill--warn' : '') +
'" style="width:' + percent + '%"></span>' +
'</span>' +
'</td>' +
'</tr>';
}).join('');
}
async function load() {
try {
const rows = await getLeaveBalances({
employeeId: empFilterEl.value,
year: yearFilterEl.value
});
renderRows(rows);
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="6"><div class="state state--error">' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div></td></tr>';
}
}
async function loadFilters() {
const thisYear = new Date().getFullYear();
[thisYear + 1, thisYear, thisYear - 1].forEach(function (y) {
const option = document.createElement('option');
option.value = y;
option.textContent = y;
if (y === thisYear) option.selected = true;
yearFilterEl.appendChild(option);
});
try {
const employees = await getActiveEmployees();
employees.forEach(function (e) {
const option = document.createElement('option');
option.value = e.id;
option.textContent = e.full_name + ' · ' + e.employee_code;
empFilterEl.appendChild(option);
});
} catch (err) {
console.error(err.message);
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
empFilterEl.addEventListener('change', load);
yearFilterEl.addEventListener('change', load);
async function start() {
loadUserSwitcher();
await loadFilters();
load();
}

start();