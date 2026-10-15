
// PAYROLL BUSINESS LOGIC
//
// Pure functions. Every figure the system reports comes from here,
// so the whole calculation can be read in one place.
//
// The formula, from the brief:
// Gross = Basic + Housing + Transport + Other + Overtime
// Daily rate = Gross / 30
// Unpaid = Daily rate x unpaid leave days
// Net = Gross - (Unpaid + Other deductions)

import { DAYS_IN_MONTH } from '../config.js';
// Money is rounded where it is calculated, never at display time.
export function round2(value) {
return Math.round((Number(value) || 0) * 100) / 100;
}
export function calculateGross(salary, overtime) {
const basic = Number(salary.basic_salary) || 0;
const housing = Number(salary.housing_allowance) || 0;
const transport = Number(salary.transportation_allowance) || 0;
const other = Number(salary.other_allowance) || 0;
const ot = Number(overtime) || 0;
return round2(basic + housing + transport + other + ot);
}
export function dailyRate(gross) {
return round2(gross / DAYS_IN_MONTH);
}
export function unpaidDeduction(rate, days) {
return round2(rate * (Number(days) || 0));
}
// The whole calculation in one call.
// Returns the totals and the line items ready to be stored.
export function calculatePayroll(input) {
const salary = input.salary;
const overtime = Number(input.overtime) || 0;
const unpaidDays = Number(input.unpaidDays) || 0;
const otherDeductions = Number(input.otherDeductions) || 0;
const gross = calculateGross(salary, overtime);
const rate = dailyRate(gross);
const unpaid = unpaidDeduction(rate, unpaidDays);
const totalDeductions = round2(unpaid + otherDeductions);
const net = round2(gross - totalDeductions);
const earnings = [
{ name: 'Basic Salary', amount: round2(salary.basic_salary) },
{ name: 'Housing Allowance',
amount: round2(salary.housing_allowance) },
{ name: 'Transportation Allowance',
amount: round2(salary.transportation_allowance) },
{ name: 'Other Allowance',
amount: round2(salary.other_allowance) }
];
if (overtime > 0) {
earnings.push({ name: 'Overtime', amount: round2(overtime) });
}
const deductions = [];
if (unpaid > 0) {
deductions.push({
name: 'Unpaid Leave (' + unpaidDays + ' days)',
amount: unpaid
});
}
if (otherDeductions > 0) {
deductions.push({
name: 'Other Deductions',
amount: round2(otherDeductions)
});
}
return {
gross: gross,
dailyRate: rate,
unpaidDays: unpaidDays,
unpaidDeduction: unpaid,
totalDeductions: totalDeductions,
net: net,
earnings: earnings.filter(function (e) { return e.amount > 0; }),
deductions: deductions
};
}

// DATES

// '2026-09' becomes { start: '2026-09-01', end: '2026-09-30' }
export function monthBounds(monthValue) {
const parts = String(monthValue).split('-');
const year = Number(parts[0]);
const month = Number(parts[1]);
const last = new Date(year, month, 0).getDate();
return {
start: pad(year, 4) + '-' + pad(month, 2) + '-01',
end: pad(year, 4) + '-' + pad(month, 2) + '-' + pad(last, 2)
};
}
// How many days of a leave range fall inside the payroll month?
// A leave from 28 Sep to 3 Oct contributes 3 days to September.
export function overlapDays(fromDate, toDate, start, end) {
const a = fromDate > start ? fromDate : start;
const b = toDate < end ? toDate : end;
if (a > b) return 0;
const ms = new Date(b + 'T00:00:00').getTime() -
new Date(a + 'T00:00:00').getTime();
return Math.round(ms / 86400000) + 1;
}
// Adds up the unpaid days across every approved unpaid request
// that touches this month.
export function countUnpaidDays(requests, start, end) {
let total = 0;
requests.forEach(function (r) {
total += overlapDays(r.from_date, r.to_date, start, end);
});
return total;
}

// RULES

// Rule 2 — inactive employees are excluded from new payroll.
export function canRunFor(employee) {
if (!employee) return 'Employee not found.';
if (employee.status !== 'Active') {
return 'Payroll can only be run for Active employees. ' +
'This employee is ' + employee.status + '.';
}
return null;
}
// Rule 3 — the result must never be negative.
export function checkResult(result) {
if (result.net < 0) {
return 'The deductions are larger than the gross salary. ' +
'Net salary would be ' + result.net + '.';
}
return null;
}
// Rule 7 — an approved payroll is read-only.
export const EDITABLE_STATUSES = ['Draft', 'Calculated'];
export function isEditable(status) {
return EDITABLE_STATUSES.indexOf(status) !== -1;
}
function pad(value, width) {
    let s = String(value);
    while (s.lengh < width) s = '0' + s;
}