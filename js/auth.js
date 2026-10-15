
// AUTH
// The one place that answers three questions: is anyone signed
// in, who are they, and what role do they have.
//
// No screen talks to supabase.auth directly. They all come here.

import { supabase } from './db.js';
// Where people go, depending on who they are.
const LOGIN_PAGE = 'login.html';
const HR_HOME = 'dashboard.html';
const EMPLOYEE_HOME = 'home.html';
// A page may ask who is signed in more than once, so the answer
// is fetched once and kept for the life of the page.
let cached = null;

// THE SIGNED-IN ACCOUNT

// Returns the Supabase session, or null when nobody is signed in.
//
// The session lives in the browser's storage and is put back
// automatically when the page reloads, so this keeps working
// after a refresh without asking for the password again.
export async function getSession() {
const result = await supabase.auth.getSession();
if (result.error) return null;
return result.data.session || null;
}

// THE EMPLOYEE BEHIND THE ACCOUNT

// An account and an employee are two different things. The
// account is how you sign in; the employee is who you are in
// this company. The trigger from Day 1 links them.
export async function getCurrentEmployee() {
if (cached) return cached;
const session = await getSession();
if (!session) return null;
const result = await supabase
.from('employees')
.select('*, departments(name), designations(name)')
.eq('auth_user_id', session.user.id)
.maybeSingle();
if (result.error) return null;
cached = result.data;
return cached;
}
export function isHR(employee) {
if (!employee) return false;
return employee.app_role === 'HR Manager'
|| employee.app_role === 'HR User';
}
// Where this person belongs after signing in.
export function homeFor(employee) {
return isHR(employee) ? HR_HOME : EMPLOYEE_HOME;
}

// THE GUARD
//
// Every protected page calls this first and waits for it.
//
// It either returns the employee, or it sends the visitor away
// and returns null. So any code written after it can simply
// trust that somebody valid is signed in.

export async function requireAuth(options) {
const opts = options || {};
const session = await getSession();
// Nobody is signed in.
if (!session) {
window.location.replace(LOGIN_PAGE);
return null;
}
const employee = await getCurrentEmployee();
// Signed in, but this email is not in the employees table.
// An account with no employee behind it is of no use here.
if (!employee) {
await signOut();
window.location.replace(LOGIN_PAGE + '?error=unlinked');
return null;
}
// The employee exists but has left, or was never activated.
if (employee.status !== 'Active') {
await signOut();
window.location.replace(LOGIN_PAGE + '?error=inactive');
return null;
}
// An employee who reaches an HR page goes to their own home.
if (opts.hrOnly && !isHR(employee)) {
window.location.replace(EMPLOYEE_HOME);
return null;
}
return employee;
}

// SIGN OUT

export async function signOut() {
cached = null;
await supabase.auth.signOut();
}