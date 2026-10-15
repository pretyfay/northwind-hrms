// CONFIG
// Connection details, the acting user, and app-wide settings.
export const SUPABASE_URL =
 'https://abbxruwitdwhhjegutwl.supabase.co';
export const SUPABASE_KEY =
 'sb_publishable_JsRAgWiRwdilvFiWdLT4cw_5lb9HxW5';

 // CURRENT USER
// This app has no login. We keep the acting user here so the audit
// trail can record who did what. The header switcher changes it.
export const USERS = [
 { name: 'Fatima Almuallim', role: 'HR User' },
 { name: 'Razique Raza', role: 'HR Manager' }
];
let currentUserIndex = 0;
export function getCurrentUser() {
 return USERS[currentUserIndex];
}
export function setCurrentUser(index) {
 currentUserIndex = Number(index);
}
// APP SETTINGS

export const COMPANY_NAME = 'SISCO';
export const CURRENCY = 'SAR';
// Payroll rule: daily rate = monthly gross / DAYS_IN_MONTH
export const DAYS_IN_MONTH = 30;