import {
getAuditLogs,
getApprovalHistory,
getUsers
} from './db.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';
const headEl = document.getElementById('head');
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
const userEl = document.getElementById('userSwitcher');
const tableFilterEl = document.getElementById('tableFilter');
const actionFilterEl = document.getElementById('actionFilter');
const fromFilterEl = document.getElementById('fromFilter');
const toFilterEl = document.getElementById('toFilter');
const clearBtn = document.getElementById('clearFilters');
let mode = 'data';
let userMap = {};

// HELPERS

function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function badgeClass(status) {
const key = String(status || 'draft').toLowerCase().split(' ')[0];
return 'badge badge--' + key;
}
function whenText(value) {
if (!value) return '—';
return new Date(value).toLocaleString('en-GB', {
day: '2-digit', month: 'short', year: 'numeric',
hour: '2-digit', minute: '2-digit'
});
}
function nameOf(id) {
return userMap[id] || '—';
}
function showAlert(message) {
alertEl.className = 'alert alert--error';
alertEl.textContent = message;
alertEl.hidden = false;
}
function emptyState(span) {
return '<tr><td colspan="' + span + '">' +
'<div class="state">' +
'<div class="state__title">Nothing recorded</div>' +
'<div class="state__text">' +
'Nothing matches these filters.' +
'</div>' +
'</div>' +
'</td></tr>';
}

// DATA CHANGES

function headData() {
headEl.innerHTML =
'<tr>' +
'<th style="width:160px">When</th>' +
'<th>Table</th>' +
'<th>Action</th>' +
'<th>Field</th>' +
'<th>Before</th>' +
'<th>After</th>' +
'<th>By</th>' +
'</tr>';
}
function renderData(rows) {
if (rows.length === 0) {
rowsEl.innerHTML = emptyState(7);
return;
}
rowsEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td class="muted">' +
whenText(r.performed_at) +
'</td>' +
'<td class="mono">' + safe(r.table_name) + '</td>' +
'<td>' + safe(r.action) + '</td>' +
'<td class="mono">' + safe(r.field_name || '—') +
'</td>' +
'<td class="muted">' + safe(r.old_value || '—') +
'</td>' +
'<td class="strong">' + safe(r.new_value || '—') +
'</td>' +
'<td>' + safe(nameOf(r.performed_by)) + '</td>' +
'</tr>';
}).join('');
}

// STATUS MOVES

function headFlow() {
headEl.innerHTML =
'<tr>' +
'<th style="width:160px">When</th>' +
'<th>Record type</th>' +
'<th>From</th>' +
'<th>To</th>' +
'<th>Remarks</th>' +
'<th>By</th>' +
'</tr>';
}
function renderFlow(rows) {
if (rows.length === 0) {
rowsEl.innerHTML = emptyState(6);
return;
}
rowsEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td class="muted">' + whenText(r.action_at) + '</td>' +
'<td class="mono">' + safe(r.entity_type) + '</td>' +
'<td>' +
(r.from_status
? '<span class="' + badgeClass(r.from_status) +
'">' + safe(r.from_status) + '</span>'
: '<span class="muted">—</span>') +
'</td>' +
'<td><span class="' + badgeClass(r.to_status) + '">' +
safe(r.to_status) +
'</span></td>' +
'<td class="muted">' + safe(r.remarks || '—') + '</td>' +
'<td>' + safe(nameOf(r.action_by)) + '</td>' +
'</tr>';
}).join('');
}

// LOAD

function readFilters() {
return {
table: tableFilterEl.value,
action: actionFilterEl.value,
entityType: tableFilterEl.value,
from: fromFilterEl.value,
to: toFilterEl.value
};
}
async function load() {
rowsEl.innerHTML =
'<tr><td colspan="7">' +
'<span class="skeleton" style="width:240px"></span>' +
'</td></tr>';
try {
if (mode === 'data') {
headData();
const rows = await getAuditLogs(readFilters());
countEl.textContent = rows.length + ' changes';
renderData(rows);
} else {
headFlow();
const rows = await getApprovalHistory(readFilters());
countEl.textContent = rows.length + ' moves';
renderFlow(rows);
}
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

// FILTER OPTIONS

function fillFilters() {
const tables = mode === 'data'
? ['employees', 'employee_salary', 'attendance',
'leave_requests', 'leave_balances', 'payroll',
'payslips', 'departments', 'designations', 'leave_types']
: ['employee', 'leave_request', 'payroll'];
tableFilterEl.innerHTML =
'<option value="">' +
(mode === 'data' ? 'All tables' : 'All record types') +
'</option>';
tables.forEach(function (t) {
const option = document.createElement('option');
option.value = t;
option.textContent = t;
tableFilterEl.appendChild(option);
});
// Actions only exist on the data side.
actionFilterEl.hidden = mode !== 'data';
}
async function loadUsers() {
try {
const users = await getUsers();
users.forEach(function (u) {
userMap[u.id] = u.full_name;
});
} catch (err) {
showAlert('Could not load users: ' + err.message);
}
}
function loadActions() {
['Create', 'Update', 'Delete', 'Status change']
.forEach(function (a) {
const option = document.createElement('option');
option.value = a;
option.textContent = a;
actionFilterEl.appendChild(option);
});
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

document.querySelectorAll('[data-mode]').forEach(function (btn) {
btn.addEventListener('click', function () {
mode = btn.getAttribute('data-mode');
document.querySelectorAll('[data-mode]')
.forEach(function (other) {
other.classList.remove('is-active');
});
btn.classList.add('is-active');
fillFilters();
load();
});
});
tableFilterEl.addEventListener('change', load);
actionFilterEl.addEventListener('change', load);
fromFilterEl.addEventListener('change', load);
toFilterEl.addEventListener('change', load);
clearBtn.addEventListener('click', function () {
tableFilterEl.value = '';
actionFilterEl.value = '';
fromFilterEl.value = '';
toFilterEl.value = '';
load();
});

// START

async function start() {
loadUserSwitcher();
loadActions();
fillFilters();
await loadUsers();
load();
}
start();
