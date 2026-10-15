// ===================================================================
// MY PROFILE
// Read only. An employee sees their own record and their own
// salary, and nothing else.
// ===================================================================
import { myProfile, mySalary, getManagerName } from './db.js';
import { CURRENCY } from './config.js';
const avatarEl = document.getElementById('avatar');
const nameEl = document.getElementById('name');
const metaEl = document.getElementById('meta');
const statusEl = document.getElementById('statusBadge');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
const factsEl = document.getElementById('facts');
const salaryEl = document.getElementById('salary');
// What each column is called, in words.
const LABELS = {
employee_code: 'Employee code',
email: 'Email',
mobile: 'Mobile',
gender: 'Gender',
date_of_birth: 'Date of birth',
nationality: 'Nationality',
joining_date: 'Joining date',
employment_type: 'Employment type',
location: 'Location',
separation_date: 'Separation date',
separation_reason: 'Separation reason'
};
// Shown elsewhere, or of no use to the person reading.
const SKIP = [
'id', 'full_name', 'status', 'app_role', 'auth_user_id',
'department_id', 'designation_id', 'manager_id',
'departments', 'designations', 'created_at', 'updated_at'
];
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
function money(value) {
return Number(value || 0).toLocaleString('en-US', {
minimumFractionDigits: 2,
maximumFractionDigits: 2
});
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
function prettify(key) {
if (LABELS[key]) return LABELS[key];
const words = String(key).replace(/_/g, ' ');
return words.charAt(0).toUpperCase() + words.slice(1);
}
function showAlert(message) {
alertEl.className = 'alert alert--error';
alertEl.textContent = message;
alertEl.hidden = false;
}
function renderHead(me, managerName) {
avatarEl.textContent = initials(me.full_name);
nameEl.textContent = me.full_name;
const dept = me.departments ? me.departments.name : '—';
const desg = me.designations ? me.designations.name : '—';
let meta = me.employee_code + ' · ' + desg + ' · ' + dept;
if (managerName) meta += ' · reports to ' + managerName;
metaEl.textContent = meta;
statusEl.className = badgeClass(me.status);
statusEl.textContent = me.status;
countEl.textContent = me.employee_code;
}
// The grid builds itself from whatever columns came back, so a
// column added later appears here with no code change.
function renderFacts(me) {
const keys = Object.keys(me).filter(function (key) {
if (SKIP.indexOf(key) !== -1) return false;
const value = me[key];
if (value === null || value === '') return false;
return typeof value !== 'object';
});
if (keys.length === 0) {
factsEl.innerHTML =
'<p class="section__note">No further details recorded.</p>';
return;
}
factsEl.innerHTML = keys.map(function (key) {
let value = me[key];
if (key.indexOf('date') !== -1) {
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
function renderSalary(salary) {
if (!salary) {
salaryEl.innerHTML =
'<div class="state">' +
'<div class="state__text">No salary recorded.</div>' +
'</div>';
return;
}
const basic = Number(salary.basic_salary || 0);
const housing = Number(salary.housing_allowance || 0);
const transport = Number(salary.transportation_allowance || 0);
const other = Number(salary.other_allowance || 0);
const gross = basic + housing + transport + other;
const line = function (label, amount) {
return '<div class="preview__line">' +
'<span>' + label + '</span>' +
'<span class="num mono">' + money(amount) + '</span>' +
'</div>';
};
salaryEl.innerHTML =
line('Basic', basic) +
line('Housing', housing) +
line('Transport', transport) +
line('Other', other) +
'<div class="preview__line preview__line--strong">' +
'<span>Gross</span>' +
'<span class="num mono">' +
money(gross) + ' ' + CURRENCY +
'</span>' +
'</div>' +
'<p class="hint" style="margin-top:10px">' +
'Effective from ' + niceDate(salary.effective_date) +
'</p>';
}
async function start() {
try {
const me = await myProfile();
if (!me) return;
const managerName = await getManagerName(me.manager_id);
renderHead(me, managerName);
renderFacts(me);
const salary = await mySalary();
renderSalary(salary);
} catch (err) {
showAlert(err.message);
}
}
start();