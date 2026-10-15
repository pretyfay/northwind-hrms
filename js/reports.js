import {
reportHeadcount,
reportPayrollByMonth,
reportAttendanceMonth,
reportLeaveBalances
} from './db.js';
import { USERS, setCurrentUser } from './config.js';
const alertEl = document.getElementById('alert');
const userEl = document.getElementById('userSwitcher');
const monthEl = document.getElementById('monthPicker');
const headcountEl = document.getElementById('headcountRows');
const payrollEl = document.getElementById('payrollRows');
const attendanceEl = document.getElementById('attendanceRows');
const balancesHeadEl = document.getElementById('balancesHead');
const balancesEl = document.getElementById('balancesRows');
// Whatever each report last loaded, kept so Export can use it
// without asking the database a second time.
const cache = {
headcount: [],
payroll: [],
attendance: [],
balances: []
};

// HELPERS

function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function money(value) {
return Number(value || 0).toLocaleString('en-US', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
}
function niceMonth(value) {
if (!value) return '—';
return new Date(value + '-01T00:00:00')
.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
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
function emptyRow(span) {
return '<tr><td colspan="' + span + '">' +
'<div class="state">' +
'<div class="state__text">No data yet.</div>' +
'</div>' +
'</td></tr>';
}
// A column name like "half_day" reads better as "Half day".
function prettify(key) {
const words = String(key).replace(/_/g, ' ');
return words.charAt(0).toUpperCase() + words.slice(1);
}

// CSV
//
// A cell is wrapped in quotes and any quote inside it is doubled.
// That is the whole CSV escaping rule, and it is what stops a
// name with a comma from breaking the file.

function toCSV(rows) {
if (rows.length === 0) return '';
const keys = Object.keys(rows[0]);
const cell = function (value) {
const text = value == null ? '' : String(value);
return '"' + text.replace(/"/g, '""') + '"';
};
const lines = [keys.map(cell).join(',')];
rows.forEach(function (row) {
lines.push(keys.map(function (key) {
return cell(row[key]);
}).join(','));
});
return lines.join('\r\n');
}
function download(filename, text) {
// The BOM is what tells Excel the file is UTF-8. Without it,
// Arabic names come out as question marks.
const blob = new Blob(['' + text], {
type: 'text/csv;charset=utf-8;'
});
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
}
function handleExport(which) {
const rows = cache[which];
if (!rows || rows.length === 0) {
showAlert('Nothing to export in that report yet.');
return;
}
const stamp = new Date().toISOString().slice(0, 10);
download('sisco-' + which + '-' + stamp + '.csv', toCSV(rows));
}

// 1. HEADCOUNT

async function loadHeadcount() {
try {
const rows = await reportHeadcount();
cache.headcount = rows;
if (rows.length === 0) {
headcountEl.innerHTML = emptyRow(3);
return;
}
headcountEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td class="strong">' + safe(r.department) + '</td>' +
'<td class="num">' + r.total + '</td>' +
'<td class="num">' + r.active + '</td>' +
'</tr>';
}).join('');
} catch (err) {
showAlert(err.message);
}
}

// 2. PAYROLL BY MONTH

async function loadPayroll() {
try {
const rows = await reportPayrollByMonth();
cache.payroll = rows;
if (rows.length === 0) {
payrollEl.innerHTML = emptyRow(6);
return;
}
payrollEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td class="strong">' + niceMonth(r.month) + '</td>' +
'<td class="num">' + r.runs + '</td>' +
'<td class="num mono">' + money(r.gross) + '</td>' +
'<td class="num mono">' +
money(r.deductions) +
'</td>' +
'<td class="num mono strong">' +
money(r.net) +
'</td>' +
'<td class="num">' + r.paid + '</td>' +
'</tr>';
}).join('');
} catch (err) {
showAlert(err.message);
}
}

// 3. ATTENDANCE

async function loadAttendance() {
const month = monthEl.value || thisMonth();
attendanceEl.innerHTML =
'<tr><td colspan="9">' +
'<span class="skeleton" style="width:220px"></span>' +
'</td></tr>';
try {
const rows = await reportAttendanceMonth(month);
cache.attendance = rows;
if (rows.length === 0) {
attendanceEl.innerHTML = emptyRow(9);
return;
}
attendanceEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td class="mono">' + safe(r.code) + '</td>' +
'<td class="strong">' + safe(r.name) + '</td>' +
'<td class="num">' + r.days + '</td>' +
'<td class="num">' + r.Present + '</td>' +
'<td class="num">' + r.Absent + '</td>' +
'<td class="num">' + r.Late + '</td>' +
'<td class="num">' + r['Half Day'] + '</td>' +
'<td class="num">' + r.Leave + '</td>' +
'<td class="num mono">' +
r.hours.toFixed(2) +
'</td>' +
'</tr>';
}).join('');
} catch (err) {
showAlert(err.message);
}
}

// 4. LEAVE BALANCES
//
// The columns are whatever the view returns, so the table builds
// itself. If the view changes later, this report still works.

async function loadBalances() {
try {
const rows = await reportLeaveBalances();
cache.balances = rows;
if (rows.length === 0) {
balancesHeadEl.innerHTML = '';
balancesEl.innerHTML = emptyRow(1);
return;
}
const keys = Object.keys(rows[0]).filter(function (key) {
return key !== 'id' && key.slice(-3) !== '_id';
});
balancesHeadEl.innerHTML =
'<tr>' +
keys.map(function (key) {
return '<th>' + safe(prettify(key)) + '</th>';
}).join('') +
'</tr>';
balancesEl.innerHTML = rows.map(function (row) {
return '<tr>' +
keys.map(function (key) {
const value = row[key];
const isNumber = typeof value === 'number';
return '<td' + (isNumber ? ' class="num"' : '') +
'>' + safe(value) + '</td>';
}).join('') +
'</tr>';
}).join('');
} catch (err) {
showAlert(err.message);
}
}

// EVENTS

document.querySelectorAll('[data-export]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleExport(btn.getAttribute('data-export'));
});
});
monthEl.addEventListener('change', loadAttendance);
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

// START

function start() {
loadUserSwitcher();
monthEl.value = thisMonth();
loadHeadcount();
loadPayroll();
loadAttendance();
loadBalances();
}
start();