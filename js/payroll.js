
// PAYROLL PAGE
//
// Creating, calculating, and moving a payroll record through its
// workflow. Every figure comes from logic/payroll.js and every
// status move is checked against logic/status.js first.

import {
getPayrolls,
createPayroll,
savePayrollCalculation,
changePayrollStatus,
getCurrentSalary,
getApprovedUnpaidLeave,
getEmployeeBasic,
getActiveEmployees,
generatePayslip,
findUserIdByName
} from './db.js';
import {
calculatePayroll,
monthBounds,
countUnpaidDays,
canRunFor,
checkResult,
round2
} from './logic/payroll.js';
import { canTransition, nextStatuses } from './logic/status.js';
import { USERS, getCurrentUser, setCurrentUser, CURRENCY }
from './config.js';

// ELEMENTS

const alertEl = document.getElementById('alert');
const rowsEl = document.getElementById('payrollRows');
const countEl = document.getElementById('rowCount');
const previewEl = document.getElementById('preview');
const employeeEl = document.getElementById('employeeId');
const monthEl = document.getElementById('month');
const overtimeEl = document.getElementById('overtime');
const otherDedEl = document.getElementById('otherDeductions');
const runBtn = document.getElementById('runBtn');
const empFilterEl = document.getElementById('employeeFilter');
const monthFilterEl = document.getElementById('monthFilter');
const statusFilterEl = document.getElementById('statusFilter');
const clearBtn = document.getElementById('clearFilters');
const userEl = document.getElementById('userSwitcher');
let records = [];

// HELPERS

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
const a = parts[0] ? parts[0][0] : '';
const b = parts[1] ? parts[1][0] : '';
return (a + b).toUpperCase();
}
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function niceMonth(value) {
if (!value) return '—';
return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {
month: 'long',
year: 'numeric'
});
}
function showAlert(kind, message) {
alertEl.className = 'alert alert--' + kind;
alertEl.textContent = message;
alertEl.hidden = false;
window.scrollTo({ top: 0, behavior: 'smooth' });
}

// RUN PAYROLL

async function handleRun() {
alertEl.hidden = true;
previewEl.hidden = true;
if (!employeeEl.value) {
showAlert('error', 'Select an employee.');
return;
}
if (!monthEl.value) {
showAlert('error', 'Select a month.');
return;
}
runBtn.disabled = true;
runBtn.textContent = 'Working…';
try {
// Rule 2 — Active employees only.
const employee = await getEmployeeBasic(employeeEl.value);
const blocked = canRunFor(employee);
if (blocked) {
showAlert('error', blocked);
return;
}
const salary = await getCurrentSalary(employee.id);
if (!salary) {
showAlert('error',
'This employee has no current salary record.');
return;
}
// Count the approved unpaid leave days inside this month.
const bounds = monthBounds(monthEl.value);
const leave = await getApprovedUnpaidLeave(
employee.id, bounds.start, bounds.end
);
const unpaidDays = countUnpaidDays(
leave, bounds.start, bounds.end
);
// The calculation itself — all of it in one pure function.
const result = calculatePayroll({
salary: salary,
overtime: overtimeEl.value,
unpaidDays: unpaidDays,
otherDeductions: otherDedEl.value
});
const problem = checkResult(result);
if (problem) {
showAlert('error', problem);
return;
}
// Rule 1 is enforced by the database here.
const userId = await findUserIdByName(getCurrentUser().name);
const payroll = await createPayroll(
employee.id, bounds.start, userId
);
await savePayrollCalculation(payroll.id, result, userId);
showPreview(employee, result);
showAlert('success',
'Payroll calculated. Net ' + CURRENCY + ' ' +
money(result.net) + '.');
loadRecords();
} catch (err) {
showAlert('error', err.message);
}
runBtn.disabled = false;
runBtn.textContent = 'Create and calculate';
}
// A breakdown of what the system just worked out.
function showPreview(employee, r) {
previewEl.hidden = false;
const earnRows = r.earnings.map(function (e) {
return line(e.name, e.amount);
}).join('');
const dedRows = r.deductions.length > 0
? r.deductions.map(function (d) {
return line(d.name, d.amount, true);
}).join('')
: line('None', 0);
previewEl.innerHTML =
'<div class="preview__head">' +
safe(employee.full_name) + ' · ' +
safe(employee.employee_code) +
'</div>' +
'<div class="preview__cols">' +
'<div class="preview__col">' +
'<div class="preview__title">Earnings</div>' +
earnRows +
line('Gross salary', r.gross, false, true) +
'</div>' +
'<div class="preview__col">' +
'<div class="preview__title">Deductions</div>' +
'<div class="preview__note">Daily rate ' + CURRENCY +
' ' + money(r.dailyRate) + ' · ' +
r.unpaidDays + ' unpaid days</div>' +
dedRows +
line('Total deductions', r.totalDeductions, true, true) +
'</div>' +
'</div>' +
'<div class="preview__net">' +
'<span>Net salary</span>' +
'<span class="preview__net-value">' +
'<span class="preview__cur">' + CURRENCY + '</span> ' +
money(r.net) +
'</span>' +
'</div>';
}
function line(label, amount, negative, strong) {
return '<div class="preview__line' +
(strong ? ' preview__line--strong' : '') + '">' +
'<span>' + safe(label) + '</span>' +
'<span class="num">' +
(negative && amount > 0 ? '−' : '') + money(amount) +
'</span>' +
'</div>';
}

// WORKFLOW BUTTONS
//
// The buttons on each row come from the status engine, so the
// screen can never offer a move the rules forbid.

const LABELS = {
'Calculated': 'Recalculate',
'Pending Approval': 'Submit',
'Approved': 'Approve',
'Processed': 'Process',
'Paid': 'Mark paid',
'Cancelled': 'Cancel',
'Draft': 'Back to draft'
};
const PRIMARY = ['Approved', 'Processed', 'Paid', 'Pending Approval'];
function actionButtons(record) {
const moves = nextStatuses('payroll', record.status);
if (moves.length === 0) {
return '<span class="muted">No further action</span>';
}
let html = moves.map(function (to) {
// Recalculating is handled by the form above, not here.
if (to === 'Calculated' || to === 'Draft') return '';
const kind = to === 'Cancelled'
? 'btn--danger'
: (PRIMARY.indexOf(to) !== -1 ? 'btn--primary' : '');
return '<button class="btn btn--sm ' + kind + '" type="button"' +
' data-to="' + to + '" data-id="' + record.id + '">' +
(LABELS[to] || to) +
'</button>';
}).join('');
if (record.status === 'Processed' || record.status === 'Paid') {
html += '<a class="btn btn--sm" href="payslip.html?id=' +
record.id + '">Payslip</a>';
}
return html || '<span class="muted">—</span>';
}
function wireActions() {
rowsEl.querySelectorAll('[data-to]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleMove(
btn.getAttribute('data-id'),
btn.getAttribute('data-to')
);
});
});
}
async function handleMove(id, toStatus) {
const record = records.find(function (r) {
return String(r.id) === String(id);
});
if (!record) return;
// Rules 4, 5, 6 and 8 all live in this one call.
if (!canTransition('payroll', record.status, toStatus)) {
showAlert('error',
'Cannot move from ' + record.status + ' to ' + toStatus + '.');
return;
}
if (toStatus === 'Cancelled') {
const ok = window.confirm('Cancel this payroll record?');
if (!ok) return;
}
try {
const userId = await findUserIdByName(getCurrentUser().name);
await changePayrollStatus(record, toStatus, userId);
// A processed payroll gets its payslip straight away.
if (toStatus === 'Processed') {
await generatePayslip(record.id, userId);
}
showAlert('success', 'Payroll is now ' + toStatus + '.');
loadRecords();
} catch (err) {
showAlert('error', err.message);
}
}

// TABLE

function showSkeleton() {
let html = '';
for (let i = 0; i < 3; i++) {
html += '<tr>' +
'<td><span class="skeleton" style="width:130px"></span></td>' +
'<td><span class="skeleton" style="width:90px"></span></td>' +
'<td><span class="skeleton" style="width:70px"></span></td>' +
'<td><span class="skeleton" style="width:60px"></span></td>' +
'<td><span class="skeleton" style="width:70px"></span></td>' +
'<td><span class="skeleton" style="width:70px"></span></td>' +
'<td><span class="skeleton" style="width:150px"></span></td>' +
'</tr>';
}
rowsEl.innerHTML = html;
}
function renderRows() {
countEl.textContent = records.length === 1
? '1 payroll record'
: records.length + ' payroll records';
if (records.length === 0) {
rowsEl.innerHTML =
'<tr><td colspan="7"><div class="state">' +
'<div class="state__title">No payroll records</div>' +
'<div class="state__text">' +
'Use the panel above to run one.' +
'</div>' +
'</div></td></tr>';
return;
}
rowsEl.innerHTML = records.map(function (r) {
return '<tr>' +
'<td><div class="person">' +
'<span class="avatar">' +
safe(initials(r.full_name)) + '</span>' +
'<span class="person__name">' +
safe(r.full_name) + '</span>' +
'</div></td>' +
'<td>' + niceMonth(r.payroll_month) + '</td>' +
'<td class="num">' + money(r.gross_salary) + '</td>' +
'<td class="num">' + money(r.total_deductions) + '</td>' +
'<td class="num strong">' + money(r.net_salary) + '</td>' +
'<td><span class="' + badgeClass(r.status) + '">' +
safe(r.status) + '</span></td>' +
'<td><div class="row-actions">' +
actionButtons(r) +
'</div></td>' +
'</tr>';
}).join('');
wireActions();
}
async function loadRecords() {
showSkeleton();
try {
const month = monthFilterEl.value
? monthBounds(monthFilterEl.value).start
: '';
records = await getPayrolls({
employeeId: empFilterEl.value,
month: month,
status: statusFilterEl.value
});
renderRows();
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="7"><div class="state state--error">' +
'<div class="state__title">Could not load payroll</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div></td></tr>';
}
}

// DROPDOWNS

async function loadEmployees() {
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

runBtn.addEventListener('click', handleRun);
empFilterEl.addEventListener('change', loadRecords);
monthFilterEl.addEventListener('change', loadRecords);
statusFilterEl.addEventListener('change', loadRecords);
clearBtn.addEventListener('click', function () {
empFilterEl.value = '';
monthFilterEl.value = '';
statusFilterEl.value = '';
loadRecords();
});

// START

function start() {
loadUserSwitcher();
loadEmployees();
const now = new Date();
monthEl.value = now.toISOString().slice(0, 7);
loadRecords();
}
start();