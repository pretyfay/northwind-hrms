// ===================================================================
// MY ATTENDANCE
// Read only. The employee sees their own month; recording
// attendance stays with HR.
// ===================================================================
import { myAttendance } from './db.js';
const monthEl = document.getElementById('monthPicker');
const summaryEl = document.getElementById('summary');
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
}
function badgeClass(status) {
const key = String(status || 'draft')
.toLowerCase()
.split(' ')[0];
return 'badge badge--' + key;
}
function niceDate(value) {
if (!value) return '—';
const only = String(value).slice(0, 10);
return new Date(only + 'T00:00:00').toLocaleDateString('en-GB', {
weekday: 'short',
day: '2-digit',
month: 'short'
});
}
function niceTime(value) {
if (!value) return '—';
return String(value).slice(0, 5);
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
function renderSummary(rows) {
if (rows.length === 0) {
summaryEl.innerHTML = '';
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
'<div class="balance-bar__label">Total hours</div>' +
'<div class="balance-bar__value">' +
hours.toFixed(1) +
'</div>' +
'</div>';
summaryEl.innerHTML = html;
}
function renderRows(rows) {
const n = rows.length;
countEl.textContent = n === 1 ? '1 day' : n + ' days';
if (n === 0) {
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<div class="state">' +
'<div class="state__title">Nothing this month</div>' +
'<div class="state__text">' +
'No attendance has been recorded for this month.' +
'</div>' +
'</div>' +
'</td></tr>';
return;
}
rowsEl.innerHTML = rows.map(function (r) {
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
'<td class="muted">' + safe(r.remarks || '—') + '</td>' +
'</tr>';
}).join('');
}
async function load() {
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<span class="skeleton" style="width:220px"></span>' +
'</td></tr>';
try {
const rows = await myAttendance(monthEl.value || thisMonth());
renderSummary(rows);
renderRows(rows);
} catch (err) {
showAlert(err.message);
rowsEl.innerHTML = '';
}
}
monthEl.addEventListener('change', load);
function start() {
monthEl.value = thisMonth();
load();
}
start();