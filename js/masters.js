import {
getMasterRows,
createMasterRow,
updateMasterRow,
findUserIdByName
} from './db.js';
import { USERS, getCurrentUser, setCurrentUser } from './config.js';

// WHAT EACH LIST LOOKS LIKE
//
// If Supabase ever says a column "cannot be null" when you add a
// row, add that column here as one more field and it will appear
// in the form by itself.

const LISTS = {
departments: {
label: 'Departments',
fields: [
{ key: 'name', label: 'Name', type: 'text' }
]
},
designations: {
label: 'Designations',
fields: [
{ key: 'name', label: 'Name', type: 'text' }
]
},
leave_types: {
label: 'Leave types',
fields: [
{ key: 'name', label: 'Name', type: 'text' },
{ key: 'is_paid', label: 'Paid', type: 'bool' },
{ key: 'has_balance', label: 'Has balance', type: 'bool' }
]
}
};
const TABLES = Object.keys(LISTS);
let currentTable = TABLES[0];
let currentRows = [];

// ELEMENTS

const tabsEl = document.getElementById('tabs');
const addTitleEl = document.getElementById('addTitle');
const addRowEl = document.getElementById('addRow');
const headEl = document.getElementById('head');
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('rowCount');
const alertEl = document.getElementById('alert');
const userEl = document.getElementById('userSwitcher');

// HELPERS

function safe(text) {
const div = document.createElement('div');
div.textContent = text == null ? '' : String(text);
return div.innerHTML;
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
// "Add" in the singular reads better than "Add Departments".
function singular(label) {
return label.replace(/s$/, '').toLowerCase();
}

// TABS

function renderTabs() {
tabsEl.innerHTML = TABLES.map(function (table) {
const on = table === currentTable ? ' is-active' : '';
return '<button class="tab' + on + '" type="button" ' +
'data-tab="' + table + '">' +
LISTS[table].label +
'</button>';
}).join('');
tabsEl.querySelectorAll('[data-tab]').forEach(function (btn) {
btn.addEventListener('click', function () {
currentTable = btn.getAttribute('data-tab');
hideAlert();
renderTabs();
renderAddRow();
load();
});
});
}

// THE ADD FORM

function renderAddRow() {
const list = LISTS[currentTable];
addTitleEl.textContent = 'Add ' + singular(list.label);
let html = '';
list.fields.forEach(function (field) {
if (field.type === 'bool') {
html += '<div class="entry__field">' +
'<label class="lbl">' + safe(field.label) +
'</label>' +
'<label class="check">' +
'<input type="checkbox" id="new_' +
field.key + '" checked>' +
'<span>Yes</span>' +
'</label>' +
'</div>';
} else {
html += '<div class="entry__field entry__field--wide">' +
'<label class="lbl" for="new_' + field.key + '">' +
safe(field.label) +
'</label>' +
'<input class="input select--block" id="new_' +
field.key + '" type="text">' +
'</div>';
}
});
html += '<div class="entry__field entry__field--action">' +
'<button class="btn btn--primary" type="button" ' +
'id="addBtn">Add</button>' +
'</div>';
addRowEl.innerHTML = html;
document.getElementById('addBtn')
.addEventListener('click', handleAdd);
}
function readAddForm() {
const row = {};
LISTS[currentTable].fields.forEach(function (field) {
const el = document.getElementById('new_' + field.key);
if (!el) return;
row[field.key] = field.type === 'bool'
? el.checked
: el.value.trim();
});
row.is_active = true;
return row;
}
async function handleAdd() {
hideAlert();
const row = readAddForm();
if (!row.name) {
showAlert('error', 'Name is required.');
return;
}
const btn = document.getElementById('addBtn');
btn.disabled = true;
btn.textContent = 'Adding…';
try {
const userId = await findUserIdByName(getCurrentUser().name);
await createMasterRow(currentTable, row, userId);
showAlert('success', 'Added "' + row.name + '".');
renderAddRow();
load();
} catch (err) {
showAlert('error', err.message);
btn.disabled = false;
btn.textContent = 'Add';
}
}

// THE TABLE

function renderHead() {
const list = LISTS[currentTable];
let html = '<tr>';
list.fields.forEach(function (field) {
html += '<th>' + safe(field.label) + '</th>';
});
html += '<th class="w-status">Active</th>';
html += '<th style="width:220px">Actions</th>';
html += '</tr>';
headEl.innerHTML = html;
}
function renderRows(rows) {
const list = LISTS[currentTable];
const n = rows.length;
const span = list.fields.length + 2;
countEl.textContent =
n === 1 ? '1 entry' : n + ' entries';
if (n === 0) {
rowsEl.innerHTML =
'<tr><td colspan="' + span + '">' +
'<div class="state">' +
'<div class="state__title">Nothing here yet</div>' +
'<div class="state__text">' +
'Use the form above to add the first one.' +
'</div>' +
'</div>' +
'</td></tr>';
return;
}
rowsEl.innerHTML = rows.map(function (row) {
let html = '<tr>';
list.fields.forEach(function (field) {
const value = row[field.key];
if (field.type === 'bool') {
html += '<td>' + (value ? 'Yes' : 'No') + '</td>';
} else {
html += '<td class="strong">' + safe(value) + '</td>';
}
});
html += '<td>' +
'<span class="badge badge--' +
(row.is_active ? 'active' : 'inactive') + '">' +
(row.is_active ? 'Active' : 'Inactive') +
'</span>' +
'</td>';
html += '<td>' +
'<div class="row-actions">' +
'<button class="btn btn--sm" type="button" ' +
'data-rename="' + row.id + '">Rename</button>' +
'<button class="btn btn--sm" type="button" ' +
'data-toggle="' + row.id + '">' +
(row.is_active ? 'Deactivate' : 'Activate') +
'</button>' +
'</div>' +
'</td>';
html += '</tr>';
return html;
}).join('');
rowsEl.querySelectorAll('[data-rename]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleRename(btn.getAttribute('data-rename'));
});
});
rowsEl.querySelectorAll('[data-toggle]').forEach(function (btn) {
btn.addEventListener('click', function () {
handleToggle(btn.getAttribute('data-toggle'));
});
});
}
function findRow(id) {
return currentRows.filter(function (r) {
return String(r.id) === String(id);
})[0];
}
async function handleRename(id) {
const row = findRow(id);
if (!row) return;
const next = window.prompt('New name:', row.name);
if (next === null) return;
if (next.trim() === '') {
showAlert('error', 'Name cannot be empty.');
return;
}
try {
const userId = await findUserIdByName(getCurrentUser().name);
await updateMasterRow(
currentTable, id, { name: next.trim() }, userId
);
showAlert('success', 'Renamed.');
load();
} catch (err) {
showAlert('error', err.message);
}
}
async function handleToggle(id) {
const row = findRow(id);
if (!row) return;
// Deactivating hides the entry from every dropdown in the app
// but keeps every record that already points at it. This is
// why there is no delete button: deleting would orphan rows.
try {
const userId = await findUserIdByName(getCurrentUser().name);
await updateMasterRow(
currentTable, id, { is_active: !row.is_active }, userId
);
showAlert(
'success',
row.is_active ? 'Deactivated.' : 'Activated.'
);
load();
} catch (err) {
showAlert('error', err.message);
}
}

// LOAD

async function load() {
renderHead();
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<span class="skeleton" style="width:200px"></span>' +
'</td></tr>';
try {
currentRows = await getMasterRows(currentTable);
renderRows(currentRows);
} catch (err) {
rowsEl.innerHTML =
'<tr><td colspan="6">' +
'<div class="state state--error">' +
'<div class="state__title">Could not load</div>' +
'<div class="state__text">' + safe(err.message) + '</div>' +
'</div>' +
'</td></tr>';
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

// START

function start() {
loadUserSwitcher();
renderTabs();
renderAddRow();
load();
}
start();
