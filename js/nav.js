
// SIDEBAR, GUARD AND USER CHIP
//
// This file is loaded by every screen, which makes it the right
// place for the three things every screen needs:
//
// 1. the guard — nobody unsigned gets in
// 2. the menu — built from the role
// 3. the chip — who is signed in, and a way out
//
// It replaces the "Acting as" dropdown in the header, so no
// screen's HTML has to change.

import { requireAuth, signOut, isHR } from './auth.js';

// WHO MAY OPEN WHAT
//
// Everything here is HR only. Employee pages are built on Day 4
// and are added to EMPLOYEE_GROUPS below as they appear.

const HR_ONLY_PAGES = [
'dashboard.html',
'index.html',
'employee-form.html',
'employee-profile.html',
'attendance.html',
'leave-requests.html',
'leave-approval.html',
'leave-balances.html',
'payroll.html',
'masters.html',
'audit-log.html',
'reports.html'
];
const HR_GROUPS = [
{
label: 'Main',
items: [
{ href: 'dashboard.html', text: 'Dashboard' },
{ href: 'index.html', text: 'Employees' },
{ href: 'employee-form.html', text: 'Add employee' },
{ href: 'employee-profile.html', text: 'Profile' },
{ href: 'attendance.html', text: 'Attendance' }
]
},
{
label: 'Leave',
items: [
{ href: 'leave-requests.html', text: 'Requests' },
{ href: 'leave-approval.html', text: 'Approval' },
{ href: 'leave-balances.html', text: 'Balances' }
]
},
{
label: 'Payroll',
items: [
{ href: 'payroll.html', text: 'Processing' }
]
},
{
label: 'Masters',
items: [
{ href: 'masters.html', text: 'Setup lists' }
]
},
{
label: 'System',
items: [
{ href: 'reports.html', text: 'Reports' },
{ href: 'audit-log.html', text: 'Audit log' }
]
}
];
// What an employee sees. Nothing here can show another
// person's data: every screen behind these links asks the
// database only for the signed-in employee's own records.
const EMPLOYEE_GROUPS = [
{
label: 'Me',
items: [
{ href: 'home.html', text: 'Home' },
{ href: 'my-profile.html', text: 'My profile' },
{ href: 'my-attendance.html', text: 'My attendance' }
]
},
{
label: 'Leave',
items: [
{ href: 'my-leave.html', text: 'My leave' }
]
},
{
label: 'Pay',
items: [
{ href: 'my-payslips.html', text: 'My payslips' }
]
}
];

// HELPERS

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
// "/hrms/payroll.html" becomes "payroll.html"
function currentPage() {
const path = window.location.pathname;
const last = path.substring(path.lastIndexOf('/') + 1);
return last === '' ? 'index.html' : last;
}

// THE SIDEBAR

function buildNav(employee) {
const sidebar = document.querySelector('.sidebar');
if (!sidebar) return;
const groups = isHR(employee) ? HR_GROUPS : EMPLOYEE_GROUPS;
const here = currentPage();
let html = '';
html += '<div class="sidebar__brand">' +
'<span class="sidebar__mark">N</span>' +
'<span class="sidebar__name">Northwind HR</span>' +
'</div>';
html += '<nav class="nav">';
groups.forEach(function (group) {
html += '<div class="nav__group">' +
'<div class="nav__label">' +
safe(group.label) +
'</div>';
group.items.forEach(function (item) {
const on = item.href === here ? ' is-active' : '';
html += '<a class="nav__item' + on + '" ' +
'href="' + item.href + '">' +
safe(item.text) +
'</a>';
});
html += '</div>';
});
html += '</nav>';
html += '<div class="sidebar__foot">Trainee build &middot; 2026</div>';
sidebar.innerHTML = html;
}

// THE USER CHIP
//
// The header already has a <label class="acting"> holding the
// old dropdown. We replace what is inside it, so not one line of
// HTML has to change in thirteen files.

function buildChip(employee) {
const acting = document.querySelector('.acting');
if (!acting) return;
acting.className = 'who';
acting.innerHTML =
'<span class="avatar who__avatar">' +
safe(initials(employee.full_name)) +
'</span>' +
'<span class="who__text">' +
'<span class="who__name">' +
safe(employee.full_name) +
'</span>' +
'<span class="who__role">' +
safe(employee.app_role) +
'</span>' +
'</span>' +
'<button class="btn btn--sm" type="button" id="signOutBtn">' +
'Sign out' +
'</button>';
document.getElementById('signOutBtn')
.addEventListener('click', async function () {
await signOut();
window.location.replace('login.html');
});
}

// START
//
// The guard runs first and everything waits for it. If nobody is
// signed in, this page never gets a menu and the visitor is
// already on their way to the login screen.

async function start() {
const hrOnly = HR_ONLY_PAGES.indexOf(currentPage()) !== -1;
const employee = await requireAuth({ hrOnly: hrOnly });
if (!employee) return;
buildNav(employee);
buildChip(employee);
}
start();