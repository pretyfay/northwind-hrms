
// DASHBOARD PAGE
// Every number here is counted by the database, never typed in.

import {
getDashboardCounts,
getHeadcountByDepartment,
getRecentEmployees
} from './db.js';
import { USERS, setCurrentUser } from './config.js';

// HELPERS

function setText(id, value) {
const el = document.getElementById(id);
if (el) el.textContent = value;
}
function money(value) {
return Number(value || 0).toLocaleString('en-US', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
}
function badgeClass(status) {
const key = String(status || 'draft')
.toLowerCase()
.split(' ')[0];
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
function showAlert(message) {
const el = document.getElementById('alert');
el.className = 'alert alert--error';
el.textContent = message;
el.hidden = false;
}

// THE NINE COUNTS

async function loadCounts() {
try {
const c = await getDashboardCounts();
setText('totalEmployees', c.total_employees);
setText('activeEmployees', c.active_employees);
setText('inactiveEmployees', c.inactive_employees);
setText('onLeaveToday', c.on_leave_today);
setText('presentToday', c.present_today);
setText('absentToday', c.absent_today);
setText('pendingLeave', c.pending_leave_requests);
setText('pendingPayroll', c.pending_payroll);
setText('monthPayroll', money(c.current_month_payroll));
} catch (err) {
showAlert('Could not load the dashboard: ' + err.message);
}
}

// DEPARTMENT BARS
// The widest bar is the biggest department, so the rest are drawn
// relative to it.

async function loadDepartments() {
const wrap = document.getElementById('deptBars');
try {
const rows = await getHeadcountByDepartment();
if (rows.length === 0) {
wrap.innerHTML =
'<div class="state">' +
'<div class="state__title">No employees yet</div>' +
'</div>';
return;
}
const biggest = rows[0].count;
wrap.innerHTML = rows.map(function (row) {
const width = Math.round((row.count / biggest) * 100);
return '<div class="bar">' +
'<span class="bar__name">' + safe(row.name) + '</span>' +
'<span class="bar__track">' +
'<span class="bar__fill" style="width:' + width + '%">' +
'</span>' +
'</span>' +
'<span class="bar__count">' + row.count + '</span>' +
'</div>';
}).join('');
} catch (err) {
wrap.innerHTML =
'<div class="state state--error">' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div>';
}
}

// RECENT EMPLOYEES

async function loadRecent() {
const wrap = document.getElementById('recentList');
try {
const rows = await getRecentEmployees(5);
if (rows.length === 0) {
wrap.innerHTML =
'<div class="state">' +
'<div class="state__title">Nothing yet</div>' +
'</div>';
return;
}
wrap.innerHTML = rows.map(function (e) {
return '<div class="list__row">' +
'<span class="avatar">' +
safe(initials(e.full_name)) +
'</span>' +
'<span class="list__main">' +
'<span class="list__name">' +
safe(e.full_name) +
'</span>' +
'<span class="mono list__code">' +
safe(e.employee_code) +
'</span>' +
'</span>' +
'<span class="' + badgeClass(e.status) + '">' +
safe(e.status) +
'</span>' +
'</div>';
}).join('');
} catch (err) {
wrap.innerHTML =
'<div class="state state--error">' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div>';
}
}

// DATES

function showDates() {
const now = new Date();
setText('asOf', 'As of ' + now.toLocaleDateString('en-GB', {
day: 'numeric',
month: 'long',
year: 'numeric'
}));
setText('monthName', now.toLocaleDateString('en-GB', {
month: 'long',
year: 'numeric'
}));
}

// USER SWITCHER

function loadUserSwitcher() {
const userEl = document.getElementById('userSwitcher');
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

// START

function start() {
loadUserSwitcher();
showDates();
loadCounts();
loadDepartments();
loadRecent ();
}

start();