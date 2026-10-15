
// EMPLOYEES PAGE
// Reads the filter controls, asks db.js for data, draws the table.
// No SQL here, no business rules here. Screen work only.

import {
 getEmployees,
 getDepartments,
 getDesignations
} from './db.js';
import { USERS, setCurrentUser, CURRENCY } from './config.js';

// ELEMENTS

const rowsEl = document.getElementById('employeeRows');
const countEl = document.getElementById('rowCount');
const searchEl = document.getElementById('searchInput');
const deptEl = document.getElementById('departmentFilter');
const desigEl = document.getElementById('designationFilter');
const statusEl = document.getElementById('statusFilter');
const userEl = document.getElementById('userSwitcher');
const addBtn = document.getElementById('addBtn');

// HELPERS

// "Pending Approval" becomes the css class "badge--pending"
function badgeClass(status) {
 const key = String(status || 'draft')
 .toLowerCase()
 .split(' ')[0];
 return 'badge badge--' + key;
}
// 10800 becomes "10,800.00"
function money(value) {
 return Number(value || 0).toLocaleString('en-US', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2
 });
}
// Two initials for the avatar circle
function initials(name) {
 const parts = String(name || '').trim().split(/\s+/);
 const first = parts[0] ? parts[0][0] : '';
 const last = parts[1] ? parts[1][0] : '';
 return (first + last).toUpperCase();
}
// Escape text before putting it into HTML
function safe(text) {
 const div = document.createElement('div');
 div.textContent = text == null ? '' : String(text);
 return div.innerHTML;
}
function fullRow(html) {
 rowsEl.innerHTML = '<tr><td colspan="6">' + html + '</td></tr>';
}

// STATES

function showSkeleton() {
 let html = '';
 for (let i = 0; i < 4; i++) {
 html += '<tr class="skeleton-row">' +
 '<td><span class="skeleton" style="width:80px"></span></td>' +
 '<td><span class="skeleton" style="width:140px"></span></td>' +
 '<td><span class="skeleton" style="width:70px"></span></td>' +
 '<td><span class="skeleton" style="width:110px"></span></td>' +
 '<td><span class="skeleton" style="width:80px"></span></td>' +
 '<td><span class="skeleton" style="width:60px"></span></td>' +
 '</tr>';
 }
 rowsEl.innerHTML = html;
}
function showEmpty() {
 fullRow(
 '<div class="state">' +
 '<div class="state__title">No employees found</div>' +
 '<div class="state__text">' +
 'Try clearing the filters or adding an employee.' +
 '</div>' +
 '</div>'
 );
}
function showError(message) {
 fullRow(
 '<div class="state state--error">' +
 '<div class="state__title">Could not load employees</div>' +
 '<div class="state__text">' + safe(message) + '</div>' +
 '</div>'
 );
}

// DRAW THE TABLE

function renderRows(employees) {
 const n = employees.length;
 countEl.textContent = n === 1 ? '1 employee' : n + ' employees';
 if (n === 0) {
 showEmpty();
 return;
 }
 rowsEl.innerHTML = employees.map(function (e) {
 return '<tr>' +
 '<td><span class="mono">' +
 safe(e.employee_code) +
 '</span></td>' +
 '<td>' +
 '<div class="person">' +
 '<span class="avatar">' +
 safe(initials(e.full_name)) +
 '</span>' +
 '<span class="person__name">' +
 safe(e.full_name) +
 '</span>' +
 '</div>' +
 '</td>' +
 '<td>' + safe(e.department_name || '—') + '</td>' +
 '<td>' + safe(e.designation_name || '—') + '</td>' +
 '<td class="num">' +
 '<span class="currency">' + CURRENCY + '</span> ' +
 money(e.gross_salary) +
 '</td>' +
 '<td>' +
 '<span class="' + badgeClass(e.status) + '">' +
 safe(e.status) +
 '</span>' +
 '</td>' +
 '</tr>';
 }).join('');
}

// LOAD DATA

async function loadEmployees() {
 showSkeleton();
 try {
 const employees = await getEmployees({
 search: searchEl.value.trim(),
 departmentId: deptEl.value,
 designationId: desigEl.value,
 status: statusEl.value
 });
 renderRows(employees);
 } catch (err) {
 showError(err.message);
 }
}
function fillSelect(selectEl, items) {
 items.forEach(function (item) {
 const option = document.createElement('option');
 option.value = item.id;
 option.textContent = item.name;
 selectEl.appendChild(option);
 });
}
async function loadFilters() {
 try {
 fillSelect(deptEl, await getDepartments());
 fillSelect(desigEl, await getDesignations());
 } catch (err) {
 console.error('Could not load filters:', err.message);
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

let searchTimer;
searchEl.addEventListener('input', function () {
 clearTimeout(searchTimer);
 searchTimer = setTimeout(loadEmployees, 300);
});
deptEl.addEventListener('change', loadEmployees);
desigEl.addEventListener('change', loadEmployees);
statusEl.addEventListener('change', loadEmployees);

// START

function start() {
 loadUserSwitcher();
 loadFilters();
 loadEmployees();
 addBtn.addEventListener('click', function () {
 window.location.href = 'employee-form.html';
 });
}

start();