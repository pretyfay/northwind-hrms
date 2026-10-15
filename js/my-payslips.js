// ===================================================================
// MY PAYSLIPS
// The employee's own payslips, newest first.
// ===================================================================
import { myPayslips } from './db.js';
import { CURRENCY } from './config.js';
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function badgeClass(status) {
const key = String(status || 'pending')
.toLowerCase()
.split(' ')[0];
return 'badge badge--' + key;
}
function money(value) {
return Number(value || 0).toLocaleString('en-US', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
}
// "2026-09-01" becomes "September 2026"
function niceMonth(value) {
if (!value) return '—';
const only = String(value).slice(0, 10);
return new Date(only + 'T00:00:00').toLocaleDateString('en-GB', {
month: 'long',
year: 'numeric'
});
}
function showAlert(message) {
alertEl.className = 'alert alert--error';
alertEl.textContent = message;
alertEl.hidden = false;
}
function renderRows(slips) {
const n = slips.length;
countEl.textContent = n === 1 ? '1 payslip' : n + ' payslips';
if (n === 0) {
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<div class="state">' +
'<div class="state__title">No payslips yet</div>' +
'<div class="state__text">' +
'A payslip appears here once payroll for the month ' +
'has been processed.' +
'</div>' +
'</div>' +
'</td></tr>';
return;
}
rowsEl.innerHTML = slips.map(function (s) {
const run = s.payroll || {};
return '<tr>' +
'<td class="strong">' +
niceMonth(run.payroll_month) +
'</td>' +
'<td class="mono">' +
safe(s.payslip_number) +
'</td>' +
'<td class="num mono">' +
money(run.gross_salary) +
'</td>' +
'<td class="num mono strong">' +
money(run.net_salary) + ' ' + CURRENCY +
'</td>' +
'<td><span class="' +
badgeClass(s.payment_status) + '">' +
safe(s.payment_status) +
'</span></td>' +
'<td>' +
'<a class="btn btn--sm" ' +
'href="payslip.html?id=' + s.payroll_id + '">' +
'View' +
'</a>' +
'</td>' +
'</tr>';
}).join('');
}
async function load() {
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<span class="skeleton" style="width:220px"></span>' +
'</td></tr>';
try {
const slips = await myPayslips();
renderRows(slips);
} catch (err) {
showAlert(err.message);
rowsEl.innerHTML = '';
}
}
function start() {
load();
}
start();