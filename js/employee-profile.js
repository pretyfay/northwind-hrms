import {
getEmployeeFull,
getEmployeeOptions,
getManagerName,
changeEmployeeStatus,
getSalaryHistory,
getEmployeeAttendance,
getAttendanceSummary,
getEmployeeLeave,
getEmployeePayrolls,
getEmployeeTimeline,
findUserIdByName
} from './db.js';
import { nextStatuses } from './logic/status.js';
import {
USERS,
getCurrentUser,
setCurrentUser,
CURRENCY
} from './config.js';

// ELEMENTS

const pickerEl = document.getElementById('picker');
const alertEl = document.getElementById('alert');
const bodyEl = document.getElementById('body');
const placeholderEl = document.getElementById('placeholder');
const countEl = document.getElementById('rowCount');
const avatarEl = document.getElementById('avatar');
const nameEl = document.getElementById('name');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('statusBadge');
const actionsEl = document.getElementById('actions');
const sepEl = document.getElementById('separation');
const sepDateEl = document.getElementById('sepDate');
const sepReasonEl = document.getElementById('sepReason');
const sepConfirmEl = document.getElementById('sepConfirm');
const factsEl = document.getElementById('facts');
const salaryEl = document.getElementById('salary');
const attSummaryEl = document.getElementById('attSummary');
const attRowsEl = document.getElementById('attRows');
const leaveRowsEl = document.getElementById('leaveRows');
const payRowsEl = document.getElementById('payRows');
const timelineEl = document.getElementById('timeline');
const userEl = document.getElementById('userSwitcher');
// The employee currently on screen.
let current = null;

// WHAT EACH BUTTON SAYS

const VERBS = {
'Pending Approval': 'Submit for approval',
'Approved': 'Approve',
'Rejected': 'Reject',
'Active': 'Activate',
'Inactive': 'Separate',
'Draft': 'Return to draft'
};
// These two need a reason before they are allowed.
const NEEDS_REASON = ['Rejected'];

// WHICH COLUMNS TO SHOW, AND WHAT TO CALL THEM

const LABELS = {
employee_code: 'Employee code',
email: 'Email',
phone: 'Phone',
mobile: 'Mobile',
gender: 'Gender',
date_of_birth: 'Date of birth',
nationality: 'Nationality',
national_id: 'National ID',
joining_date: 'Joining date',
employment_type: 'Employment type',
work_location: 'Work location',
address: 'Address',
separation_date: 'Separation date',
separation_reason: 'Separation reason',
created_at: 'Created',
updated_at: 'Last updated'
};
// Shown elsewhere on the page, or meaningless to a human.
const SKIP = [
'id', 'full_name', 'status',
'department_id', 'designation_id', 'manager_id',
'departments', 'designations'
];

// HELPERS

function money(value) {
return Number(value || 0).toLocaleString('en-US', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
}
function badgeClass(status) {
const key = String(status || 'draft').toLowerCase().split(' ')[0];
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
function niceDate(value) {
if (!value) return '—';
const onlyDate = String(value).slice(0, 10);
return new Date(onlyDate + 'T00:00:00').toLocaleDateString('en-GB', {
day: '2-digit',
month: 'short',
year: 'numeric'
});
}
function niceTime(value) {
if (!value) return '—';
return String(value).slice(0, 5);
}
// "2026-09-01" becomes "September 2026"
function niceMonth(value) {
if (!value) return '—';
const onlyDate = String(value).slice(0, 10);
return new Date(onlyDate + 'T00:00:00').toLocaleDateString('en-GB', {
month: 'long',
year: 'numeric'
});
}
// "joining_date" becomes "Joining date"
function prettify(key) {
if (LABELS[key]) return LABELS[key];
const words = String(key).replace(/_/g, ' ');
return words.charAt(0).toUpperCase() + words.slice(1);
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
function emptyRow(columns, message) {
return '<tr><td colspan="' + columns + '">' +
'<div class="state">' +
'<div class="state__text">' + message + '</div>' +
'</div>' +
'</td></tr>';
}

// IDENTITY STRIP

function renderHead(employee, managerName) {
avatarEl.textContent = initials(employee.full_name);
nameEl.textContent = employee.full_name;
const dept = employee.departments
? employee.departments.name : '—';
const desg = employee.designations
? employee.designations.name : '—';
let meta = employee.employee_code + ' · ' + desg + ' · ' + dept;
if (managerName) meta += ' · reports to ' + managerName;
metaEl.textContent = meta;
statusEl.className = badgeClass(employee.status);
statusEl.textContent = employee.status;
countEl.textContent = employee.employee_code;
}

// ACTION BUTTONS — GENERATED, NOT WRITTEN

function renderActions(employee) {
const moves = nextStatuses('employee', employee.status);
sepEl.hidden = true;
if (moves.length === 0) {
actionsEl.innerHTML =
'<p class="section__note">' +
'This employee is ' + safe(employee.status) +
'. No further action is possible.' +
'</p>';
return;
}
actionsEl.innerHTML = moves.map(function (to) {
const danger = (to === 'Rejected' || to === 'Inactive')
? ' btn--danger' : '';
const primary = (to === 'Approved' || to === 'Active')
? ' btn--primary' : '';
return '<button class="btn' + primary + danger + '" ' +
'type="button" data-to="' + safe(to) + '">' +
safe(VERBS[to] || to) +
'</button>';
}).join('');
actionsEl.querySelectorAll('[data-to]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleMove(btn.getAttribute('data-to'));
});
});
}
async function handleMove(toStatus) {
hideAlert();
// Separation needs a date and a reason, so it gets its own
// little form instead of a plain button.
if (toStatus === 'Inactive') {
sepEl.hidden = false;
sepDateEl.focus();
return;
}
let remarks = null;
if (NEEDS_REASON.indexOf(toStatus) !== -1) {
remarks = window.prompt('Why is this employee rejected?');
if (remarks === null) return;
if (remarks.trim() === '') {
showAlert('error', 'A reason is required to reject.');
return;
}
}
await applyMove(toStatus, { remarks: remarks });
}
async function applyMove(toStatus, extra) {
actionsEl.querySelectorAll('button').forEach(function (b) {
b.disabled = true;
});
try {
const userId = await findUserIdByName(getCurrentUser().name);
await changeEmployeeStatus(current, toStatus, userId, extra);
showAlert('success', 'Employee is now ' + toStatus + '.');
await load(current.id);
} catch (err) {
showAlert('error', err.message);
renderActions(current);
}
}
sepConfirmEl.addEventListener('click', function () {
const date = sepDateEl.value;
const reason = sepReasonEl.value.trim();
if (!date) {
showAlert('error', 'Separation date is required.');
return;
}
if (!reason) {
showAlert('error', 'Separation reason is required.');
return;
}
applyMove('Inactive', {
separationDate: date,
separationReason: reason,
remarks: reason
});
});

// DETAILS GRID

function renderFacts(employee) {
const keys = Object.keys(employee).filter(function (key) {
if (SKIP.indexOf(key) !== -1) return false;
const value = employee[key];
if (value === null || value === '') return false;
return typeof value !== 'object';
});
if (keys.length === 0) {
factsEl.innerHTML =
'<p class="section__note">No further details recorded.</p>';
return;
}
factsEl.innerHTML = keys.map(function (key) {
let value = employee[key];
if (key.indexOf('date') !== -1 || key.indexOf('_at') !== -1) {
value = niceDate(value);
}
return '<div class="fact">' +
'<div class="fact__label">' +
safe(prettify(key)) +
'</div>' +
'<div class="fact__value">' + safe(value) + '</div>' +
'</div>';
}).join('');
}

// SALARY

function renderSalary(rows) {
if (rows.length === 0) {
salaryEl.innerHTML =
'<div class="state">' +
'<div class="state__text">No salary recorded.</div>' +
'</div>';
return;
}
const live = rows.filter(function (r) {
return r.is_current;
})[0] || rows[0];
const basic = Number(live.basic_salary || 0);
const housing = Number(live.housing_allowance || 0);
const transport = Number(live.transportation_allowance || 0);
const other = Number(live.other_allowance || 0);
const gross = basic + housing + transport + other;
let html = '';
html += '<div class="preview__line">' +
'<span>Basic</span>' +
'<span class="num mono">' + money(basic) + '</span>' +
'</div>';
html += '<div class="preview__line">' +
'<span>Housing</span>' +
'<span class="num mono">' + money(housing) + '</span>' +
'</div>';
html += '<div class="preview__line">' +
'<span>Transport</span>' +
'<span class="num mono">' + money(transport) + '</span>' +
'</div>';
html += '<div class="preview__line">' +
'<span>Other</span>' +
'<span class="num mono">' + money(other) + '</span>' +
'</div>';
html += '<div class="preview__line preview__line--strong">' +
'<span>Gross</span>' +
'<span class="num mono">' + money(gross) + ' ' +
CURRENCY +
'</span>' +
'</div>';
if (rows.length > 1) {
html += '<div class="section__head" style="margin-top:16px">' +
'<h3 class="section__title">History</h3>' +
'</div>';
html += '<div class="table-wrap"><table class="table">' +
'<thead><tr>' +
'<th>Effective</th>' +
'<th class="num">Basic</th>' +
'<th>Current</th>' +
'</tr></thead><tbody>';
rows.forEach(function (r) {
html += '<tr>' +
'<td>' + niceDate(r.effective_date) + '</td>' +
'<td class="num mono">' +
money(r.basic_salary) +
'</td>' +
'<td>' + (r.is_current ? 'Yes' : '—') + '</td>' +
'</tr>';
});
html += '</tbody></table></div>';
}
salaryEl.innerHTML = html;
}

// ATTENDANCE

function renderAttendance(summary, rows) {
const keys = Object.keys(summary);
if (keys.length === 0) {
attSummaryEl.innerHTML = '';
} else {
attSummaryEl.innerHTML = keys.map(function (key) {
return '<div class="balance-bar__item">' +
'<div class="balance-bar__label">' +
safe(key) +
'</div>' +
'<div class="balance-bar__value">' +
summary[key] +
'</div>' +
'</div>';
}).join('');
}
if (rows.length === 0) {
attRowsEl.innerHTML = emptyRow(5, 'No attendance recorded.');
return;
}
attRowsEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td>' + niceDate(r.attendance_date) + '</td>' +
'<td>' + niceTime(r.check_in) + '</td>' +
'<td>' + niceTime(r.check_out) + '</td>' +
'<td class="num mono">' +
Number(r.working_hours || 0).toFixed(2) +
'</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span></td>' +
'</tr>';
}).join('');
}

// LEAVE

function renderLeave(rows) {
if (rows.length === 0) {
leaveRowsEl.innerHTML = emptyRow(5, 'No leave requests.');
return;
}
leaveRowsEl.innerHTML = rows.map(function (r) {
const type = r.leave_types ? r.leave_types.name : '—';
return '<tr>' +
'<td>' + safe(type) + '</td>' +
'<td>' + niceDate(r.from_date) + '</td>' +
'<td>' + niceDate(r.to_date) + '</td>' +
'<td class="num">' + (r.number_of_days || 0) + '</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span></td>' +
'</tr>';
}).join('');
}

// PAYROLL

function renderPayroll(rows) {
if (rows.length === 0) {
payRowsEl.innerHTML = emptyRow(4, 'No payroll runs.');
return;
}
payRowsEl.innerHTML = rows.map(function (r) {
return '<tr>' +
'<td>' + niceMonth(r.payroll_month) + '</td>' +
'<td class="num mono">' +
money(r.gross_salary) +
'</td>' +
'<td class="num mono strong">' +
money(r.net_salary) +
'</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) +
'</span></td>' +
'</tr>';
}).join('');
}

// TIMELINE

function renderTimeline(events) {
if (events.length === 0) {
timelineEl.innerHTML =
'<div class="state">' +
'<div class="state__text">Nothing recorded yet.</div>' +
'</div>';
return;
}
timelineEl.innerHTML = events.map(function (e) {
const when = e.at
? new Date(e.at).toLocaleString('en-GB', {
day: '2-digit', month: 'short', year: 'numeric',
hour: '2-digit', minute: '2-digit'
})
: '—';
return '<div class="tl">' +
'<span class="tl__dot tl__dot--' + e.kind + '"></span>' +
'<div class="tl__body">' +
'<div class="tl__title">' + safe(e.title) + '</div>' +
(e.note
? '<div class="tl__note">' + safe(e.note) + '</div>'
: '') +
'<div class="tl__when">' +
when + ' · ' + safe(e.who) +
'</div>' +
'</div>' +
'</div>';
}).join('');
}

// LOAD ONE EMPLOYEE

async function load(id) {
if (!id) {
bodyEl.hidden = true;
placeholderEl.hidden = false;
countEl.innerHTML = '&nbsp;';
current = null;
return;
}
placeholderEl.hidden = true;
bodyEl.hidden = false;
try {
const employee = await getEmployeeFull(id);
current = employee;
const managerName = await getManagerName(employee.manager_id);
renderHead(employee, managerName);
renderActions(employee);
renderFacts(employee);
// These four do not depend on each other, so they are
// fetched together instead of one after another.
const data = await Promise.all([
getSalaryHistory(id),
getAttendanceSummary(id),
getEmployeeAttendance(id, 10),
getEmployeeLeave(id, 10),
getEmployeePayrolls(id),
getEmployeeTimeline(id)
]);
renderSalary(data[0]);
renderAttendance(data[1], data[2]);
renderLeave(data[3]);
renderPayroll(data[4]);
renderTimeline(data[5]);
} catch (err) {
showAlert('error', err.message);
bodyEl.hidden = true;
}
}

// THE PICKER

async function loadPicker() {
try {
const employees = await getEmployeeOptions();
employees.forEach(function (e) {
const option = document.createElement('option');
option.value = e.id;
option.textContent =
e.full_name + ' · ' + e.employee_code + ' · ' + e.status;
pickerEl.appendChild(option);
});
// employee-profile.html?id=... opens straight on that person.
const params = new URLSearchParams(window.location.search);
const wanted = params.get('id');
if (wanted) {
pickerEl.value = wanted;
load(wanted);
}
} catch (err) {
showAlert('error', 'Could not load employees: ' + err.message);
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

pickerEl.addEventListener('change', function () {
hideAlert();
load(pickerEl.value);
});

// START

function start() {
loadUserSwitcher();
loadPicker();
}
start();
