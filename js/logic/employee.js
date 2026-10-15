
// EMPLOYEE BUSINESS LOGIC
// Pure functions. No screen, no database.
// Gross salary is the sum of all earning components.
export function calculateGross(salary) {
 const basic = Number(salary.basicSalary) || 0;
 const housing = Number(salary.housingAllowance) || 0;
 const transport = Number(salary.transportationAllowance) || 0;
 const other = Number(salary.otherAllowance) || 0;
 return round2(basic + housing + transport + other);
}
// Money is rounded at the point of calculation, never at display.
export function round2(value) {
 return Math.round((Number(value) || 0) * 100) / 100;
}
// Which statuses a new employee may be created with.
export const CREATABLE_STATUSES = ['Draft', 'Pending Approval'];
// Returns an object of field -> message. Empty means valid.
export function validateEmployee(form) {
 const errors = {};
 if (!form.fullName || form.fullName.trim().length < 3) {
 errors.fullName = 'Enter the full name, at least 3 characters';
 }
 if (form.email && !isEmail(form.email)) {
 errors.email = 'Enter a valid email address';
 }
 if (!form.joiningDate) {
 errors.joiningDate = 'Joining date is required';
 }
 if (!form.departmentId) {
 errors.departmentId = 'Select a department';
 }
 if (!form.designationId) {
 errors.designationId = 'Select a designation';
 }
 if (form.dateOfBirth && form.joiningDate) {
 if (form.dateOfBirth >= form.joiningDate) {
 errors.dateOfBirth =
 'Date of birth must be before the joining date';
 }
 }
 // Rule 3 — salary cannot be negative.
 const money = [
 ['basicSalary', 'Basic salary'],
 ['housingAllowance', 'Housing allowance'],
 ['transportationAllowance', 'Transportation allowance'],
 ['otherAllowance', 'Other allowance']
 ];
 money.forEach(function (pair) {
 const key = pair[0];
 const label = pair[1];
 const value = Number(form[key]);
 if (form[key] === '' || form[key] == null) return;
 if (isNaN(value)) {
 errors[key] = label + ' must be a number';
 } else if (value < 0) {
 errors[key] = label + ' cannot be negative';
 }
 });
 if (!form.basicSalary || Number(form.basicSalary) <= 0) {
 errors.basicSalary = 'Basic salary must be greater than zero';
 }
 if (!form.salaryEffectiveDate) {
 errors.salaryEffectiveDate = 'Salary effective date is required';
 }
 if (!CREATABLE_STATUSES.includes(form.status)) {
 errors.status = 'A new employee starts as Draft or Pending';
 }
 return errors;
}
export function hasErrors(errors) {
 return Object.keys(errors).length > 0;
}
function isEmail(value) {
 return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
}
