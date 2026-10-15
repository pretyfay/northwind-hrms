
// ATTENDANCE BUSINESS LOGIC
// Pure functions. No screen, no database.

export const STATUSES = [
'Present',
'Absent',
'Late',
'Half Day',
'Leave',
'Holiday',
'Weekend'
];
// Statuses where the person was not at work, so times do not apply.
export const NON_WORKING = ['Absent', 'Leave', 'Holiday', 'Weekend'];
// The working day starts at 08:30. Anything later is Late.
export const DAY_START = '08:30';
// Under this many hours counts as a half day.
export const HALF_DAY_LIMIT = 5;
// Working hours = check out minus check in, in hours, to 2 decimals.
// The database trigger does this too. We repeat it here so the
// number appears on screen before the record is saved.
export function calculateHours(checkIn, checkOut) {
if (!checkIn || !checkOut) return 0;
const start = toMinutes(checkIn);
const end = toMinutes(checkOut);
if (end <= start) return 0;
return Math.round(((end - start) / 60) * 100) / 100;
}
// Suggests a status from the times. The user can always override it.
export function suggestStatus(checkIn, checkOut) {
if (!checkIn) return 'Absent';
const hours = calculateHours(checkIn, checkOut);
if (checkOut && hours > 0 && hours < HALF_DAY_LIMIT) {
return 'Half Day';
}
if (toMinutes(checkIn) > toMinutes(DAY_START)) {
return 'Late';
}
return 'Present';
}
// Friday and Saturday are the weekend here.
// Confirm this with the mentor before the demo.
export function isWeekend(dateString) {
if (!dateString) return false;
const day = new Date(dateString + 'T00:00:00').getDay();
return day === 5 || day === 6;
}
export function validateAttendance(record) {
const errors = {};
if (!record.employeeId) {
errors.employeeId = 'Select an employee';
}
if (!record.date) {
errors.date = 'Date is required';
}
if (record.date && record.date > today()) {
errors.date = 'Attendance cannot be recorded for a future date';
}
if (!record.status) {
errors.status = 'Select a status';
}
const needsTimes = !NON_WORKING.includes(record.status);
if (needsTimes && !record.checkIn) {
errors.checkIn = 'Check in is required for this status';
}
if (record.checkIn && record.checkOut) {
if (toMinutes(record.checkOut) <= toMinutes(record.checkIn)) {
errors.checkOut = 'Check out must be after check in';
}
}
return errors;
}
export function hasErrors(errors) {
return Object.keys(errors).length > 0;
}
export function today() {
return new Date().toISOString().slice(0, 10);
}
// "08:30" becomes 510
function toMinutes(time) {
const parts = String(time).split(':');
const hours = Number(parts[0]) || 0;
const minutes = Number(parts[1]) || 0;
return hours * 60 + minutes;
}