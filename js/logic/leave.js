
// LEAVE BUSINESS LOGIC
// Pure functions. No screen, no database.

// Leave days count both the first and the last day.
// 10 Sep to 14 Sep is 5 days, not 4.
export function countDays(fromDate, toDate) {
if (!fromDate || !toDate) return 0;
const start = new Date(fromDate + 'T00:00:00');
const end = new Date(toDate + 'T00:00:00');
if (end < start) return 0;
const ms = end.getTime() - start.getTime();
return Math.round(ms / 86400000) + 1;
}
// Remaining is always calculated, never stored.
export function remaining(balance) {
const entitled = Number(balance.entitlement_days) || 0;
const taken = Number(balance.taken_days) || 0;
return Math.round((entitled - taken) * 10) / 10;
}
// The balance rule, on its own so it can be reused at approval time.
// Returns null when the request is fine, or a message when it is not.
export function checkBalance(leaveType, balance, requestedDays) {
// Unpaid leave has no balance to check.
if (!leaveType || !leaveType.has_balance) return null;
if (!balance) {
return 'No leave balance exists for this type and year.';
}
const left = remaining(balance);
if (requestedDays > left) {
return 'Insufficient leave balance. Available: ' + left +
' days, requested: ' + requestedDays + ' days.';
}
return null;
}
export function validateRequest(form) {
const errors = {};
if (!form.employeeId) {
errors.employeeId = 'Select an employee';
}
if (!form.leaveTypeId) {
errors.leaveTypeId = 'Select a leave type';
}
if (!form.fromDate) {
errors.fromDate = 'From date is required';
}
if (!form.toDate) {
errors.toDate = 'To date is required';
}
if (form.fromDate && form.toDate && form.toDate < form.fromDate) {
errors.toDate = 'To date must be on or after the from date';
}
if (form.fromDate && form.toDate) {
if (countDays(form.fromDate, form.toDate) > 90) {
errors.toDate = 'A single request cannot exceed 90 days';
}
}
if (!form.reason || form.reason.trim().length < 3) {
errors.reason = 'Give a short reason';
}
return errors;
}
// Rejecting always needs a reason. The database enforces this too.
export function validateRejection(reason) {
if (!reason || reason.trim().length < 3) {
return 'A rejection reason is required.';
}
return null;
}
export function hasErrors(errors) {
return Object.keys(errors).length > 0;
}
export function today(){
    return new Date().toISOString().slice(0, 10);
}