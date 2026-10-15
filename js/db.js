// ===================================================================
// DATABASE
// The only file that talks to Supabase. Every screen comes here.
// ===================================================================
import { createClient } from
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// ===================================================================
// WHO IS ACTING
//
// Before the login existed, the acting person came from a
// dropdown in the header. Now it comes from the session, which
// means the audit trail records who was really signed in — not
// who was selected.
// ===================================================================
let actorCache = null;
// The employee behind the signed-in account, or null.
export async function getCurrentActor() {
if (actorCache) return actorCache;
const session = await supabase.auth.getSession();
if (session.error || !session.data.session) return null;
const result = await supabase
.from('employees')
.select('id, full_name, app_role')
.eq('auth_user_id', session.data.session.user.id)
.maybeSingle();
if (result.error || !result.data) return null;
actorCache = result.data;
return actorCache;
}
// Just the id, which is what the audit functions need.
export async function currentActorId() {
const actor = await getCurrentActor();
return actor ? actor.id : null;
}
// -------------------------------------------------------------------
// THE PEOPLE WHO CAN ACT
//
// This used to read the `users` table — a plain list of names
// with no login behind it. The audit trail now points at
// employees, so this reads employees too. The name is kept so no
// screen has to change.
// -------------------------------------------------------------------
let userCache = null;
export async function getUsers() {
if (userCache) return userCache;
const result = await supabase
.from('employees')
.select('id, full_name, app_role')
.order('full_name');
if (result.error) throw new Error(result.error.message);
userCache = result.data;
return userCache;
}
export async function findUserIdByName(fullName) {
const users = await getUsers();
const match = users.find(function (u) {
return u.full_name === fullName;
});
return match ? match.id : null;
}
// ===================================================================
// AUDIT TRAIL
// Every state-changing action goes through here.
// ===================================================================
export async function logAudit(entry) {
// The caller still passes a userId, but we ignore it. The
// actor is whoever is signed in, and nothing a screen sends
// can change that.
const actor = await currentActorId();
const row = {
table_name: entry.table,
record_id: entry.recordId || null,
action: entry.action,
field_name: entry.field || null,
old_value: entry.oldValue == null
? null : String(entry.oldValue),
new_value: entry.newValue == null
? null : String(entry.newValue),
performed_by: actor,
remarks: entry.remarks || null
};
const result = await supabase.from('audit_logs').insert(row);
// An audit failure must not break the action the user asked
// for.
if (result.error) {
console.error('Audit log failed:', result.error.message);
}
}
export async function logApproval(entry) {
const actor = await currentActorId();
const row = {
entity_type: entry.entityType,
entity_id: entry.entityId,
from_status: entry.fromStatus || null,
to_status: entry.toStatus,
action_by: actor,
remarks: entry.remarks || null
};
const result = await supabase
.from('approval_history')
.insert(row);
if (result.error) {
console.error('Approval history failed:', result.error.message);
}
}
// ===================================================================
// EMPLOYEES — read
// ===================================================================
export async function getEmployees(filters) {
const f = filters || {};
let query = supabase
.from('v_employee_full')
.select('*')
.order('employee_code');
if (f.search) {
query = query.or(
'full_name.ilike.%' + f.search + '%,' +
'employee_code.ilike.%' + f.search + '%'
);
}
if (f.departmentId) {
query = query.eq('department_id', f.departmentId);
}
if (f.designationId) {
query = query.eq('designation_id', f.designationId);
}
if (f.status) {
query = query.eq('status', f.status);
}
const result = await query;
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function getEmployeeById(id) {
const result = await supabase
.from('v_employee_full')
.select('*')
.eq('id', id)
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Only Active employees can be someone's manager.
export async function getManagerOptions() {
const result = await supabase
.from('employees')
.select('id, employee_code, full_name')
.eq('status', 'Active')
.order('full_name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// EMPLOYEES — write
//
// Creating an employee touches three tables. The browser cannot
// open a transaction, so if the salary insert fails we delete
// the employee row we just made. That keeps the database from
// holding an employee with no salary attached.
// ===================================================================
export async function createEmployee(form, userId) {
// 1 · the employee record
const employeeRow = {
full_name: form.fullName,
email: form.email || null,
mobile: form.mobile || null,
date_of_birth: form.dateOfBirth || null,
gender: form.gender || null,
nationality: form.nationality || null,
joining_date: form.joiningDate,
department_id: form.departmentId || null,
designation_id: form.designationId || null,
location: form.location || null,
manager_id: form.managerId || null,
employment_type: form.employmentType || null,
status: form.status
};
const created = await supabase
.from('employees')
.insert(employeeRow)
.select()
.single();
if (created.error) throw new Error(created.error.message);
const employee = created.data;
// 2 · the salary record
const salaryRow = {
employee_id: employee.id,
basic_salary: form.basicSalary,
housing_allowance: form.housingAllowance,
transportation_allowance: form.transportationAllowance,
other_allowance: form.otherAllowance,
effective_date: form.salaryEffectiveDate,
is_current: true
};
const salary = await supabase
.from('employee_salary')
.insert(salaryRow);
if (salary.error) {
// Undo step 1 so we never leave a half-made employee behind.
await supabase.from('employees').delete().eq('id', employee.id);
throw new Error('Salary could not be saved: ' +
salary.error.message);
}
// 3 · the audit trail
await logAudit({
table: 'employees',
recordId: employee.id,
action: 'INSERT',
userId: userId,
remarks: 'Employee created: ' + employee.employee_code
});
if (form.status === 'Pending Approval') {
await logApproval({
entityType: 'employee',
entityId: employee.id,
fromStatus: 'Draft',
toStatus: 'Pending Approval',
userId: userId,
remarks: 'Submitted on creation'
});
}
return employee;
}
// ===================================================================
// MASTER DATA
// ===================================================================
export async function getDepartments() {
const result = await supabase
.from('departments')
.select('*')
.eq('is_active', true)
.order('name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function getDesignations() {
const result = await supabase
.from('designations')
.select('*')
.eq('is_active', true)
.order('name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function getLeaveTypes() {
const result = await supabase
.from('leave_types')
.select('*')
.eq('is_active', true)
.order('name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// DASHBOARD
// ===================================================================
export async function getDashboardCounts() {
const result = await supabase
.from('v_dashboard_counts')
.select('*')
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// The view gives us one row per employee with the department
// name already joined, so we only need to count them here.
export async function getHeadcountByDepartment() {
const result = await supabase
.from('v_employee_full')
.select('department_name, status');
if (result.error) throw new Error(result.error.message);
const counts = {};
result.data.forEach(function (row) {
const name = row.department_name || 'Unassigned';
counts[name] = (counts[name] || 0) + 1;
});
// Turn the object into a sorted list, biggest first.
return Object.keys(counts)
.map(function (name) {
return { name: name, count: counts[name] };
})
.sort(function (a, b) {
return b.count - a.count;
});
}
// The five most recently created records, for the dashboard.
export async function getRecentEmployees(limit) {
const result = await supabase
.from('employees')
.select('id, employee_code, full_name, status, created_at')
.order('created_at', { ascending: false })
.limit(limit || 5);
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// ATTENDANCE
// ===================================================================
export async function getAttendance(filters) {
const f = filters || {};
let query = supabase
.from('attendance')
.select('*, employees(employee_code, full_name)')
.order('attendance_date', { ascending: false })
.order('created_at', { ascending: false });
if (f.employeeId) {
query = query.eq('employee_id', f.employeeId);
}
if (f.date) {
query = query.eq('attendance_date', f.date);
}
if (f.fromDate) {
query = query.gte('attendance_date', f.fromDate);
}
if (f.toDate) {
query = query.lte('attendance_date', f.toDate);
}
if (f.status) {
query = query.eq('status', f.status);
}
const result = await query.limit(200);
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function createAttendance(record, userId) {
const row = {
employee_id: record.employeeId,
attendance_date: record.date,
check_in: record.checkIn || null,
check_out: record.checkOut || null,
status: record.status,
remarks: record.remarks || null
};
const created = await supabase
.from('attendance')
.insert(row)
.select('*, employees(employee_code, full_name)')
.single();
if (created.error) {
// 23505 is Postgres for "a unique rule was broken".
if (created.error.code === '23505') {
throw new Error(
'Attendance for this employee on this date already exists.'
);
}
throw new Error(created.error.message);
}
await logAudit({
table: 'attendance',
recordId: created.data.id,
action: 'INSERT',
userId: userId,
remarks: 'Attendance recorded for ' + record.date
});
return created.data;
}
export async function deleteAttendance(id, userId) {
const result = await supabase
.from('attendance')
.delete()
.eq('id', id);
if (result.error) throw new Error(result.error.message);
await logAudit({
table: 'attendance',
recordId: id,
action: 'DELETE',
userId: userId,
remarks: 'Attendance record removed'
});
}
// Only Active employees can have attendance recorded.
export async function getActiveEmployees() {
const result = await supabase
.from('employees')
.select('id, employee_code, full_name')
.eq('status', 'Active')
.order('full_name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// LEAVE TYPES, with their rules
// ===================================================================
export async function getLeaveTypeById(id) {
const result = await supabase
.from('leave_types')
.select('*')
.eq('id', id)
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// LEAVE BALANCES
// ===================================================================
export async function getLeaveBalances(filters) {
const f = filters || {};
let query = supabase
.from('v_leave_balance')
.select('*')
.order('employee_code')
.order('leave_type_name');
if (f.employeeId) {
query = query.eq('employee_id', f.employeeId);
}
if (f.year) {
query = query.eq('year', f.year);
}
const result = await query;
if (result.error) throw new Error(result.error.message);
return result.data;
}
// One balance row, for the rule check before submitting.
export async function getBalance(employeeId, leaveTypeId, year) {
const result = await supabase
.from('leave_balances')
.select('*')
.eq('employee_id', employeeId)
.eq('leave_type_id', leaveTypeId)
.eq('year', year)
.maybeSingle();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// LEAVE REQUESTS — read
// ===================================================================
export async function getLeaveRequests(filters) {
const f = filters || {};
let query = supabase
.from('leave_requests')
.select(
'*, employees(employee_code, full_name), ' +
'leave_types(name, has_balance, is_paid)'
)
.order('created_at', { ascending: false });
if (f.employeeId) {
query = query.eq('employee_id', f.employeeId);
}
if (f.leaveTypeId) {
query = query.eq('leave_type_id', f.leaveTypeId);
}
if (f.status) {
query = query.eq('status', f.status);
}
if (f.statusIn) {
query = query.in('status', f.statusIn);
}
const result = await query.limit(200);
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function getLeaveRequestById(id) {
const result = await supabase
.from('leave_requests')
.select(
'*, employees(employee_code, full_name), ' +
'leave_types(name, has_balance, is_paid)'
)
.eq('id', id)
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// LEAVE REQUESTS — write
// ===================================================================
export async function createLeaveRequest(form, userId) {
const row = {
employee_id: form.employeeId,
leave_type_id: form.leaveTypeId,
from_date: form.fromDate,
to_date: form.toDate,
reason: form.reason,
status: form.status
};
// number_of_days is left out on purpose.
// The database trigger fills it.
const created = await supabase
.from('leave_requests')
.insert(row)
.select('*, employees(employee_code, full_name)')
.single();
if (created.error) throw new Error(created.error.message);
await logAudit({
table: 'leave_requests',
recordId: created.data.id,
action: 'INSERT',
userId: userId,
remarks: 'Leave request created, ' +
created.data.number_of_days + ' days'
});
if (form.status === 'Pending Approval') {
await logApproval({
entityType: 'leave_request',
entityId: created.data.id,
fromStatus: 'Draft',
toStatus: 'Pending Approval',
userId: userId,
remarks: 'Submitted on creation'
});
}
return created.data;
}
// Approving does three things that must stay in step:
// 1. the request becomes Approved
// 2. the balance goes up by the number of days
// 3. both the approval history and the audit log record it
export async function approveLeaveRequest(request, userId) {
const updated = await supabase
.from('leave_requests')
.update({
status: 'Approved',
updated_at: new Date().toISOString()
})
.eq('id', request.id)
.eq('status', 'Pending Approval')
.select()
.single();
if (updated.error) {
throw new Error(
'Could not approve. It may have already been handled. ' +
updated.error.message
);
}
// Unpaid leave has no balance, so nothing to deduct.
const type = request.leave_types || {};
if (type.has_balance) {
const year = Number(String(request.from_date).slice(0, 4));
const balance = await getBalance(
request.employee_id,
request.leave_type_id,
year
);
if (balance) {
const newTaken =
Number(balance.taken_days) + Number(request.number_of_days);
const bal = await supabase
.from('leave_balances')
.update({ taken_days: newTaken })
.eq('id', balance.id);
if (bal.error) {
// Put the request back so the two never disagree.
await supabase
.from('leave_requests')
.update({ status: 'Pending Approval' })
.eq('id', request.id);
throw new Error(
'Balance could not be updated: ' + bal.error.message
);
}
}
}
await logApproval({
entityType: 'leave_request',
entityId: request.id,
fromStatus: 'Pending Approval',
toStatus: 'Approved',
userId: userId,
remarks: request.number_of_days + ' days approved'
});
await logAudit({
table: 'leave_requests',
recordId: request.id,
action: 'STATUS_CHANGE',
field: 'status',
oldValue: 'Pending Approval',
newValue: 'Approved',
userId: userId
});
return updated.data;
}
export async function rejectLeaveRequest(request, reason, userId) {
const updated = await supabase
.from('leave_requests')
.update({
status: 'Rejected',
rejection_reason: reason,
updated_at: new Date().toISOString()
})
.eq('id', request.id)
.eq('status', 'Pending Approval')
.select()
.single();
if (updated.error) {
throw new Error(
'Could not reject. It may have already been handled. ' +
updated.error.message
);
}
await logApproval({
entityType: 'leave_request',
entityId: request.id,
fromStatus: 'Pending Approval',
toStatus: 'Rejected',
userId: userId,
remarks: reason
});
await logAudit({
table: 'leave_requests',
recordId: request.id,
action: 'STATUS_CHANGE',
field: 'status',
oldValue: 'Pending Approval',
newValue: 'Rejected',
userId: userId,
remarks: reason
});
return updated.data;
}
// ===================================================================
// PAYROLL — read
// ===================================================================
export async function getPayrolls(filters) {
const f = filters || {};
let query = supabase
.from('v_payroll_summary')
.select('*')
.order('payroll_month', { ascending: false })
.order('employee_code');
if (f.employeeId) {
query = query.eq('employee_id', f.employeeId);
}
if (f.month) {
query = query.eq('payroll_month', f.month);
}
if (f.status) {
query = query.eq('status', f.status);
}
const result = await query.limit(200);
if (result.error) throw new Error(result.error.message);
return result.data;
}
// The full record, with its line items, for the payslip.
export async function getPayrollDetail(id) {
const head = await supabase
.from('v_payroll_summary')
.select('*')
.eq('id', id)
.single();
if (head.error) throw new Error(head.error.message);
const earnings = await supabase
.from('payroll_earnings')
.select('*')
.eq('payroll_id', id)
.order('created_at');
if (earnings.error) throw new Error(earnings.error.message);
const deductions = await supabase
.from('payroll_deductions')
.select('*')
.eq('payroll_id', id)
.order('created_at');
if (deductions.error) throw new Error(deductions.error.message);
const payslip = await supabase
.from('payslips')
.select('*')
.eq('payroll_id', id)
.maybeSingle();
return {
payroll: head.data,
earnings: earnings.data,
deductions: deductions.data,
payslip: payslip.data || null
};
}
// The employee's current salary, for the calculation.
export async function getCurrentSalary(employeeId) {
const result = await supabase
.from('employee_salary')
.select('*')
.eq('employee_id', employeeId)
.eq('is_current', true)
.maybeSingle();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Approved unpaid leave that touches this month.
// The overlap is worked out in logic/payroll.js.
export async function getApprovedUnpaidLeave(employeeId, start, end) {
const result = await supabase
.from('leave_requests')
.select('from_date, to_date, leave_types!inner(is_paid)')
.eq('employee_id', employeeId)
.eq('status', 'Approved')
.eq('leave_types.is_paid', false)
.lte('from_date', end)
.gte('to_date', start);
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function getEmployeeBasic(employeeId) {
const result = await supabase
.from('employees')
.select('id, employee_code, full_name, status')
.eq('id', employeeId)
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// PAYROLL — write
//
// Creating is separate from calculating, so the record exists in
// Draft before any figures are produced.
// ===================================================================
export async function createPayroll(employeeId, monthStart, userId) {
const created = await supabase
.from('payroll')
.insert({
employee_id: employeeId,
payroll_month: monthStart,
status: 'Draft'
})
.select()
.single();
if (created.error) {
// 23505 means the unique index refused a second active
// payroll for this employee and month. That is Rule 1.
if (created.error.code === '23505') {
throw new Error(
'A payroll already exists for this employee and month.'
);
}
throw new Error(created.error.message);
}
await logAudit({
table: 'payroll',
recordId: created.data.id,
action: 'INSERT',
userId: userId,
remarks: 'Payroll created for ' + monthStart
});
return created.data;
}
// Stores the figures and the line items, then moves to
// Calculated.
export async function savePayrollCalculation(payrollId, result,
userId) {
// Remove any previous line items — the user may recalculate.
await supabase
.from('payroll_earnings')
.delete()
.eq('payroll_id', payrollId);
await supabase
.from('payroll_deductions')
.delete()
.eq('payroll_id', payrollId);
if (result.earnings.length > 0) {
const rows = result.earnings.map(function (e) {
return {
payroll_id: payrollId,
component_name: e.name,
amount: e.amount
};
});
const ins = await supabase.from('payroll_earnings').insert(rows);
if (ins.error) throw new Error(ins.error.message);
}
if (result.deductions.length > 0) {
const rows = result.deductions.map(function (d) {
return {
payroll_id: payrollId,
component_name: d.name,
amount: d.amount
};
});
const ins = await supabase
.from('payroll_deductions')
.insert(rows);
if (ins.error) throw new Error(ins.error.message);
}
const updated = await supabase
.from('payroll')
.update({
gross_salary: result.gross,
total_deductions: result.totalDeductions,
net_salary: result.net,
unpaid_leave_days: result.unpaidDays,
daily_rate: result.dailyRate,
status: 'Calculated',
calculated_at: new Date().toISOString(),
updated_at: new Date().toISOString()
})
.eq('id', payrollId)
.select()
.single();
if (updated.error) throw new Error(updated.error.message);
await logAudit({
table: 'payroll',
recordId: payrollId,
action: 'STATUS_CHANGE',
field: 'status',
newValue: 'Calculated',
userId: userId,
remarks: 'Net ' + result.net + ', deductions ' +
result.totalDeductions
});
return updated.data;
}
// One function for every status move after Calculated.
// The caller has already asked the status engine whether the
// move is legal; this adds the timestamps and the trail.
export async function changePayrollStatus(payroll, toStatus,
userId, remarks) {
const patch = {
status: toStatus,
updated_at: new Date().toISOString()
};
if (toStatus === 'Approved') {
patch.approved_at = new Date().toISOString();
// The approver is the signed-in employee, not a name the
// screen handed us.
patch.approved_by = await currentActorId();
}
if (toStatus === 'Processed') {
patch.processed_at = new Date().toISOString();
}
if (toStatus === 'Paid') {
patch.paid_at = new Date().toISOString();
}
// Matching on the old status too means two people cannot both
// move the same record at the same moment.
const updated = await supabase
.from('payroll')
.update(patch)
.eq('id', payroll.id)
.eq('status', payroll.status)
.select()
.single();
if (updated.error) {
throw new Error(
'Could not update. It may have been changed already. ' +
updated.error.message
);
}
await logApproval({
entityType: 'payroll',
entityId: payroll.id,
fromStatus: payroll.status,
toStatus: toStatus,
userId: userId,
remarks: remarks || null
});
await logAudit({
table: 'payroll',
recordId: payroll.id,
action: 'STATUS_CHANGE',
field: 'status',
oldValue: payroll.status,
newValue: toStatus,
userId: userId,
remarks: remarks || null
});
return updated.data;
}
// ===================================================================
// PAYSLIP
// A payslip only exists for a processed payroll.
// ===================================================================
export async function generatePayslip(payrollId, userId) {
const existing = await supabase
.from('payslips')
.select('*')
.eq('payroll_id', payrollId)
.maybeSingle();
if (existing.data) return existing.data;
const created = await supabase
.from('payslips')
.insert({ payroll_id: payrollId })
.select()
.single();
if (created.error) throw new Error(created.error.message);
await logAudit({
table: 'payslips',
recordId: created.data.id,
action: 'INSERT',
userId: userId,
remarks: 'Payslip ' + created.data.payslip_number + ' generated'
});
return created.data;
}
export async function markPayslipPaid(payslipId, userId) {
const updated = await supabase
.from('payslips')
.update({
payment_status: 'Paid',
payment_date: new Date().toISOString().slice(0, 10)
})
.eq('id', payslipId)
.select()
.single();
if (updated.error) throw new Error(updated.error.message);
await logAudit({
table: 'payslips',
recordId: payslipId,
action: 'UPDATE',
field: 'payment_status',
oldValue: 'Pending',
newValue: 'Paid',
userId: userId
});
return updated.data;
}
// ===================================================================
// EMPLOYEE PROFILE AND LIFECYCLE
// ===================================================================
// Different tables name their timestamp column differently.
// This picks whichever one exists so the timeline always sorts.
function stamp(row) {
return row.action_at || row.performed_at ||
row.created_at || '';
}
// One employee, read from the table itself rather than a view,
// so columns added later show up without rebuilding the view.
export async function getEmployeeFull(id) {
const result = await supabase
.from('employees')
.select('*, departments(name), designations(name)')
.eq('id', id)
.single();
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Every employee in code order, for the profile picker.
export async function getEmployeeOptions() {
const result = await supabase
.from('employees')
.select('id, employee_code, full_name, status')
.order('employee_code');
if (result.error) throw new Error(result.error.message);
return result.data;
}
// The manager's name, or null when there is no manager.
export async function getManagerName(managerId) {
if (!managerId) return null;
const result = await supabase
.from('employees')
.select('full_name, employee_code')
.eq('id', managerId)
.maybeSingle();
if (result.error || !result.data) return null;
return result.data.full_name + ' · ' +
result.data.employee_code;
}
// Move an employee to a new status.
//
// The second .eq() is the safety line. It says "only update this
// row if the status is still what I saw". If somebody changed it
// in another tab, nothing matches and nothing is overwritten.
export async function changeEmployeeStatus(employee, toStatus,
userId, extra) {
const patch = { status: toStatus };
const more = extra || {};
if (more.separationDate) {
patch.separation_date = more.separationDate;
}
if (more.separationReason) {
patch.separation_reason = more.separationReason;
}
const result = await supabase
.from('employees')
.update(patch)
.eq('id', employee.id)
.eq('status', employee.status)
.select()
.maybeSingle();
if (result.error) throw new Error(result.error.message);
if (!result.data) {
throw new Error(
'Someone else changed this employee. Reload the page.'
);
}
await logApproval({
entityType: 'employee',
entityId: employee.id,
fromStatus: employee.status,
toStatus: toStatus,
userId: userId,
remarks: more.remarks || null
});
await logAudit({
table: 'employees',
recordId: employee.id,
action: 'Status change',
field: 'status',
oldValue: employee.status,
newValue: toStatus,
userId: userId,
remarks: more.remarks || null
});
return result.data;
}
// Every salary row this employee has ever had, newest first.
export async function getSalaryHistory(employeeId) {
const result = await supabase
.from('employee_salary')
.select('*')
.eq('employee_id', employeeId)
.order('effective_date', { ascending: false });
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Recent attendance rows for one employee.
export async function getEmployeeAttendance(employeeId, limit) {
const result = await supabase
.from('attendance')
.select('*')
.eq('employee_id', employeeId)
.order('attendance_date', { ascending: false })
.limit(limit || 10);
if (result.error) throw new Error(result.error.message);
return result.data;
}
// How many days of each attendance status, all time.
export async function getAttendanceSummary(employeeId) {
const result = await supabase
.from('attendance')
.select('status')
.eq('employee_id', employeeId);
if (result.error) throw new Error(result.error.message);
const counts = {};
result.data.forEach(function (row) {
counts[row.status] = (counts[row.status] || 0) + 1;
});
return counts;
}
// Recent leave requests for one employee.
export async function getEmployeeLeave(employeeId, limit) {
const result = await supabase
.from('leave_requests')
.select('*, leave_types(name, is_paid)')
.eq('employee_id', employeeId)
.order('from_date', { ascending: false })
.limit(limit || 10);
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Every payroll run for one employee, newest month first.
export async function getEmployeePayrolls(employeeId) {
const result = await supabase
.from('payroll')
.select('*')
.eq('employee_id', employeeId)
.order('payroll_month', { ascending: false });
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Everything that ever happened to this employee, in one list:
// the status moves from approval_history and the field edits
// from audit_logs, merged and sorted newest first.
export async function getEmployeeTimeline(employeeId) {
const users = await getUsers();
const nameOf = function (id) {
const found = users.filter(function (u) {
return u.id === id;
})[0];
return found ? found.full_name : '—';
};
const approvals = await supabase
.from('approval_history')
.select('*')
.eq('entity_type', 'employee')
.eq('entity_id', employeeId);
const audits = await supabase
.from('audit_logs')
.select('*')
.eq('table_name', 'employees')
.eq('record_id', employeeId);
const events = [];
if (!approvals.error && approvals.data) {
approvals.data.forEach(function (row) {
events.push({
at: stamp(row),
kind: 'status',
title: (row.from_status || 'Created') +
' → ' + row.to_status,
note: row.remarks || '',
who: nameOf(row.action_by)
});
});
}
if (!audits.error && audits.data) {
audits.data.forEach(function (row) {
const from = row.old_value || '—';
const to = row.new_value || '—';
const changed = row.old_value || row.new_value;
events.push({
at: stamp(row),
kind: 'data',
title: row.action +
(row.field_name ? ' · ' + row.field_name : ''),
note: changed ? from + ' → ' + to : (row.remarks || ''),
who: nameOf(row.performed_by)
});
});
}
events.sort(function (a, b) {
return String(b.at).localeCompare(String(a.at));
});
return events;
}
// ===================================================================
// MASTERS, AUDIT LOG AND REPORTS
// ===================================================================
// Only these three tables may be edited from the Masters screen.
// Checking against a fixed list means a bad value can never be
// turned into a table name.
const MASTER_TABLES = ['departments', 'designations',
'leave_types'];
function assertMaster(table) {
if (MASTER_TABLES.indexOf(table) === -1) {
throw new Error('Not an editable list: ' + table);
}
}
// Every row of one master table, inactive ones included.
export async function getMasterRows(table) {
assertMaster(table);
const result = await supabase
.from(table)
.select('*')
.order('name');
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function createMasterRow(table, row, userId) {
assertMaster(table);
const result = await supabase
.from(table)
.insert(row)
.select()
.single();
if (result.error) {
if (result.error.code === '23505') {
throw new Error('"' + row.name + '" already exists.');
}
throw new Error(result.error.message);
}
await logAudit({
table: table,
recordId: null,
action: 'Create',
field: 'name',
oldValue: null,
newValue: row.name,
userId: userId
});
return result.data;
}
export async function updateMasterRow(table, id, patch, userId) {
assertMaster(table);
const result = await supabase
.from(table)
.update(patch)
.eq('id', id)
.select()
.single();
if (result.error) {
if (result.error.code === '23505') {
throw new Error('That name is already used.');
}
throw new Error(result.error.message);
}
const field = Object.keys(patch)[0];
await logAudit({
table: table,
recordId: null,
action: 'Update',
field: field,
oldValue: null,
newValue: String(patch[field]),
userId: userId
});
return result.data;
}
// -------------------------------------------------------------------
// AUDIT LOG
// Field level changes. Filters are optional; an empty one is
// simply not applied.
// -------------------------------------------------------------------
export async function getAuditLogs(filters) {
const f = filters || {};
let query = supabase
.from('audit_logs')
.select('*')
.order('performed_at', { ascending: false })
.limit(300);
if (f.table) query = query.eq('table_name', f.table);
if (f.action) query = query.eq('action', f.action);
if (f.from) query = query.gte('performed_at', f.from);
if (f.to) query = query.lte('performed_at', f.to + 'T23:59:59');
const result = await query;
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Status moves: the workflow half of the trail.
export async function getApprovalHistory(filters) {
const f = filters || {};
let query = supabase
.from('approval_history')
.select('*')
.order('action_at', { ascending: false })
.limit(300);
if (f.entityType) query = query.eq('entity_type', f.entityType);
if (f.from) query = query.gte('action_at', f.from);
if (f.to) query = query.lte('action_at', f.to + 'T23:59:59');
const result = await query;
if (result.error) throw new Error(result.error.message);
return result.data;
}
// -------------------------------------------------------------------
// REPORTS
// -------------------------------------------------------------------
// Payroll totals per month, newest month first.
export async function reportPayrollByMonth() {
const result = await supabase
.from('payroll')
.select('payroll_month, gross_salary, total_deductions, ' +
'net_salary, status');
if (result.error) throw new Error(result.error.message);
const months = {};
result.data.forEach(function (row) {
const key = String(row.payroll_month).slice(0, 7);
if (!months[key]) {
months[key] = {
month: key,
runs: 0,
gross: 0,
deductions: 0,
net: 0,
paid: 0
};
}
const m = months[key];
m.runs += 1;
m.gross += Number(row.gross_salary || 0);
m.deductions += Number(row.total_deductions || 0);
m.net += Number(row.net_salary || 0);
if (row.status === 'Paid') m.paid += 1;
});
return Object.keys(months)
.sort()
.reverse()
.map(function (key) {
return months[key];
});
}
// Attendance for one month, one line per employee.
// monthValue looks like "2026-09".
export async function reportAttendanceMonth(monthValue) {
const start = monthValue + '-01';
const year = Number(monthValue.slice(0, 4));
const month = Number(monthValue.slice(5, 7));
const lastDay = new Date(year, month, 0).getDate();
const end = monthValue + '-' + String(lastDay);
const result = await supabase
.from('attendance')
.select('status, working_hours, ' +
'employees(employee_code, full_name)')
.gte('attendance_date', start)
.lte('attendance_date', end);
if (result.error) throw new Error(result.error.message);
const people = {};
result.data.forEach(function (row) {
const emp = row.employees || {};
const key = emp.employee_code || '—';
if (!people[key]) {
people[key] = {
code: key,
name: emp.full_name || '—',
days: 0,
hours: 0,
Present: 0,
Absent: 0,
Late: 0,
'Half Day': 0,
Leave: 0
};
}
const p = people[key];
p.days += 1;
p.hours += Number(row.working_hours || 0);
if (p[row.status] !== undefined) {
p[row.status] += 1;
}
});
return Object.keys(people).sort().map(function (key) {
return people[key];
});
}
// Headcount per department, biggest first.
export async function reportHeadcount() {
const result = await supabase
.from('employees')
.select('status, departments(name)');
if (result.error) throw new Error(result.error.message);
const counts = {};
result.data.forEach(function (row) {
const name = row.departments ? row.departments.name
: 'Unassigned';
if (!counts[name]) {
counts[name] = { department: name, total: 0, active: 0 };
}
counts[name].total += 1;
if (row.status === 'Active') counts[name].active += 1;
});
return Object.keys(counts)
.map(function (key) { return counts[key]; })
.sort(function (a, b) { return b.total - a.total; });
}
// Every employee's leave balance, read from the view that
// already does the arithmetic.
export async function reportLeaveBalances() {
const result = await supabase
.from('v_leave_balance')
.select('*');
if (result.error) throw new Error(result.error.message);
return result.data;
}
// ===================================================================
// THE EMPLOYEE'S OWN RECORDS
//
// Every function here scopes itself to the signed-in employee.
// The id comes from the session, never from the screen, so a
// page cannot ask for somebody else's records even by mistake.
// ===================================================================
// The year we keep balances under.
function thisYear() {
return new Date().getFullYear();
}
export async function myProfile() {
const me = await currentActorId();
if (!me) return null;
const result = await supabase
.from('employees')
.select('*, departments(name), designations(name)')
.eq('id', me)
.maybeSingle();
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function mySalary() {
const me = await currentActorId();
if (!me) return null;
const result = await supabase
.from('employee_salary')
.select('*')
.eq('employee_id', me)
.eq('is_current', true)
.maybeSingle();
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function myLeaveBalances() {
const me = await currentActorId();
if (!me) return [];
const result = await supabase
.from('v_leave_balance')
.select('*')
.eq('employee_id', me)
.eq('year', thisYear());
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function myLeaveRequests() {
const me = await currentActorId();
if (!me) return [];
const result = await supabase
.from('leave_requests')
.select('*, leave_types(name, has_balance, is_paid)')
.eq('employee_id', me)
.order('created_at', { ascending: false })
.limit(100);
if (result.error) throw new Error(result.error.message);
return result.data;
}
// Filing leave for myself.
//
// employee_id is not taken from the form. It is taken from the
// session, so this function cannot file leave in anyone else's
// name no matter what the screen sends.
export async function createMyLeaveRequest(form) {
const me = await currentActorId();
if (!me) throw new Error('You are not signed in.');
const row = {
employee_id: me,
leave_type_id: form.leaveTypeId,
from_date: form.fromDate,
to_date: form.toDate,
reason: form.reason,
status: form.status
};
// number_of_days is left out on purpose; the trigger fills it.
const created = await supabase
.from('leave_requests')
.insert(row)
.select('*, leave_types(name, has_balance, is_paid)')
.single();
if (created.error) throw new Error(created.error.message);
await logAudit({
table: 'leave_requests',
recordId: created.data.id,
action: 'INSERT',
remarks: 'Self-service leave request, ' +
created.data.number_of_days + ' days'
});
if (form.status === 'Pending Approval') {
await logApproval({
entityType: 'leave_request',
entityId: created.data.id,
fromStatus: 'Draft',
toStatus: 'Pending Approval',
remarks: 'Submitted by the employee'
});
}
return created.data;
}
// Sending a draft on to HR.
export async function submitMyLeaveRequest(request) {
const me = await currentActorId();
const updated = await supabase
.from('leave_requests')
.update({
status: 'Pending Approval',
updated_at: new Date().toISOString()
})
.eq('id', request.id)
.eq('employee_id', me)
.eq('status', 'Draft')
.select()
.maybeSingle();
if (updated.error) throw new Error(updated.error.message);
if (!updated.data) {
throw new Error('That request can no longer be submitted.');
}
await logApproval({
entityType: 'leave_request',
entityId: request.id,
fromStatus: 'Draft',
toStatus: 'Pending Approval',
remarks: 'Submitted by the employee'
});
return updated.data;
}
// Taking a request back. Only a draft can be removed; once HR
// has seen it, the record stays and the history with it.
export async function withdrawMyLeaveRequest(request) {
const me = await currentActorId();
const result = await supabase
.from('leave_requests')
.delete()
.eq('id', request.id)
.eq('employee_id', me)
.eq('status', 'Draft');
if (result.error) throw new Error(result.error.message);
await logAudit({
table: 'leave_requests',
recordId: request.id,
action: 'DELETE',
remarks: 'Draft withdrawn by the employee'
});
}
export async function myAttendance(monthValue) {
const me = await currentActorId();
if (!me) return [];
const year = Number(monthValue.slice(0, 4));
const month = Number(monthValue.slice(5, 7));
const lastDay = new Date(year, month, 0).getDate();
const result = await supabase
.from('attendance')
.select('*')
.eq('employee_id', me)
.gte('attendance_date', monthValue + '-01')
.lte('attendance_date', monthValue + '-' + String(lastDay))
.order('attendance_date', { ascending: false });
if (result.error) throw new Error(result.error.message);
return result.data;
}
export async function myPayslips() {
const me = await currentActorId();
if (!me) return [];
// !inner means a payslip with no matching payroll is dropped
// rather than returned with an empty join.
const result = await supabase
.from('payslips')
.select(
'*, payroll!inner(payroll_month, net_salary, ' +
'gross_salary, status, employee_id)'
)
.eq('payroll.employee_id', me)
.order('generated_at', { ascending: false });
if (result.error) throw new Error(result.error.message);
return result.data;
}