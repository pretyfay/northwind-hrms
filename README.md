# Northwind HRMS
All company and personal data in this project is invented.
A web based Human Resource Management System covering the full
employee lifecycle: onboarding, employee master, attendance,
leave, payroll, approval, processing, payslip and history.
Two kinds of user sign in. HR runs the company's records.
Employees file their own leave and read their own history.
Built as a trainee project at SISCO, Dammam.
**Live:** northwind-hrms.vercel.app
---
## What it does
### HR
| Module | Screens | What it covers |
|---|---|---|
| Employee master | Employees, Add employee, Profile | Create, list, filter, 360° view |
| Onboarding | Add employee + approval workflow | Draft → Pending → Approved → Active |
| Attendance | Attendance | Check in / out, hours, daily status |
| Leave | Requests, Approval, Balances | Apply, approve, reject, balance tracking |
| Payroll | Processing | Calculate, approve, process, pay |
| Payslip | Payslip | Printable payslip per run |
| Separation | Profile | Separation date and reason |
| Masters | Setup lists | Departments, designations, leave types |
| History | Audit log | Field changes and status moves |
| Reporting | Reports | Four reports, CSV export |
### Employee
| Screen | What it covers |
|---|---|
| Home | Status, leave left, what is pending |
| My profile | Own record and current salary, read only |
| My leave | File a request, submit it, withdraw a draft |
| My attendance | Own month, read only |
| My payslips | Own payslips only |
The round trip the system is built around: **an employee files
leave, HR approves it, the balance moves.**
---
## Architecture
Three layers, no hand written backend.
```
Browser Supabase Vercel
--------- ----------- --------
HTML / CSS PostgreSQL Static
Vanilla JS <-------> Auto REST API hosting
ES modules Auth + RLS
Views, triggers
Constraints
```
The frontend talks to PostgreSQL through the REST API that
Supabase generates from the schema. There is no Express server,
no ORM and no build step — the files that are written are the
files that run.
**Why no framework.** The requirement is CRUD over a well
designed schema. A framework would add a build pipeline without
changing what the screens do. Keeping it to ES modules means the
project runs from any static host and the logic stays readable.
---
## Project structure
```
hrms/
├── login.html Sign in
├── register.html Employees create their own account
│
├── index.html Employee list HR
├── dashboard.html Counts and charts HR
├── employee-form.html Onboarding HR
├── employee-profile.html 360° view, approvals HR
├── attendance.html HR
├── leave-requests.html HR
├── leave-approval.html HR
├── leave-balances.html HR
├── payroll.html HR
├── masters.html HR
├── audit-log.html HR
├── reports.html HR
├── payslip.html Printable payslip both
│
├── home.html Landing page Employee
├── my-profile.html Employee
├── my-leave.html Employee
├── my-attendance.html Employee
├── my-payslips.html Employee
│
├── hrms-schema.sql Tables, views, triggers
├── day1-auth.sql Auth columns, link trigger, helpers
├── day3-actor.sql Audit trail follows employees
├── day6-rls.sql Row Level Security
├── day6b-accounts.sql Demo accounts (not for production)
│
├── css/
│ └── style.css
└── js/
├── config.js Connection and app settings
├── auth.js Session, current employee, the guard
├── db.js Every database call
├── nav.js Guard + role menu + user chip
├── <one file per screen>
└── logic/
├── status.js The workflow engine
├── employee.js
├── attendance.js
├── leave.js
└── payroll.js
```
`js/logic/` contains pure functions only — no DOM, no database.
That is what makes the rules readable and testable on their own.
**No screen writes a query.** Every database call lives in
`db.js`. That decision is why adding login touched three files
instead of eighteen: the screens never needed to learn who was
signed in.
---
## Authentication
Supabase Auth, email and password.
**The account does not decide the role.** `employees.app_role`
does — one of `HR Manager`, `HR User`, `Employee`, held to those
three values by a CHECK constraint. So a person cannot register
and choose to be HR.
**How an account is linked.** The browser only ever holds the
publishable key, which is not allowed to create accounts for
other people. So the flow is inverted: HR adds the employee with
their work email, the employee registers with that same email,
and a `security definer` trigger on `auth.users` links the two.
An account whose email is not in `employees` is linked to nobody
and, under RLS, sees nothing at all.
**Who may open what.** `js/nav.js` loads on every screen. It runs
the guard first, then builds the menu from the role, then the
user chip. An employee who types an HR address is sent back to
`home.html`; anyone signed out goes to `login.html`; anyone whose
status is not `Active` is signed out again.
---
## Security
Enforced in two places, and the difference matters.
**The interface** hides what a person may not use. `nav.js`
refuses HR pages to an employee, and `db.js` only ever asks for
the signed-in person's own rows. Both run on the visitor's own
machine.
**The database** decides what a person is allowed to have. Row
Level Security is on for all fifteen tables, with thirty-three
policies, and all four views run with `security_invoker = on` so
reading a view cannot bypass them.
The guard is for the person. The policies are for the data.
### Shape of the policies
| Table | HR | Employee |
|---|---|---|
| `departments`, `designations`, `leave_types` | all | read |
| `employees` | all | read own row |
| `employee_salary`, `attendance`, `leave_balances`, `payroll` | all | read own |
| `payroll_earnings`, `payroll_deductions`, `payslips` | all | read own, matched through `payroll` |
| `leave_requests` | all | read own; insert own as `Draft`/`Pending Approval`; update and delete own
only while `Draft` |
| `approval_history` | all | read and insert for own requests |
| `audit_logs` | read | **insert only, never read** |
| `users` (legacy) | read | none |
`audit_logs` has no update policy and no delete policy for
anyone, HR included. Once a line is written nobody can change or
remove it through the app.
The helper functions `current_employee_id()`, `is_hr()` and
`is_hr_manager()` are `security definer`, so a policy on
`employees` can call them without recursing through the policy on
the same table.
### Keys
The key in `js/config.js` is Supabase's **publishable** key. It
is designed to be shipped in client code, and with RLS live it
grants nothing on its own. The database password and the
`service_role` key are not in this repository and never should
be.
### Proving it
Signed in, open the console on any page:
```js
const { supabase } = await import('./js/db.js');
const { data } = await supabase.from('employee_salary').select('*');
console.log(data.length);
```
As an employee: `1`. As HR: every row. Same code, same page,
same database — the only difference is who is signed in.
---
## Database
15 tables, 4 views, 3 triggers, 2 sequences, 33 RLS policies.
**Tables:** `users`, `departments`, `designations`, `leave_types`,
`employees`, `employee_salary`, `attendance`, `leave_requests`,
`leave_balances`, `payroll`, `payroll_earnings`,
`payroll_deductions`, `payslips`, `approval_history`,
`audit_logs`
**Views:** `v_employee_full`, `v_leave_balance`,
`v_dashboard_counts`, `v_payroll_summary`
Four design decisions worth naming:
**Salary is a table, not a column.** `employee_salary` keeps the
history. A raise adds a row rather than overwriting one, so
reprinting an old payslip still produces the correct figure. A
partial unique index guarantees exactly one current row per
employee.
**Earnings and deductions are rows, not columns.** The number of
allowances varies per employee, so a new allowance type needs a
new row, not a schema change.
**Managers are employees.** `employees.manager_id` is a self
referencing foreign key, which builds the whole org hierarchy
from one nullable column.
**The audit trail follows employees, not accounts.** `action_by`,
`performed_by` and `approved_by` point at `employees`, with
`on delete set null`. Removing a person never deletes the record
of what they did — which is the whole point of having one.
---
## Where the rules live
A rule is enforced in the database when breaking it would corrupt
the data, and in JavaScript when the user needs a readable
explanation.
| Rule | Enforced by |
|---|---|
| One payroll per employee per month | Partial unique index |
| One attendance record per employee per day | Unique constraint |
| One current salary row per employee | Partial unique index |
| Working hours match check in / check out | Trigger |
| Leave days match the date range | Trigger |
| A rejection must carry a reason | CHECK constraint |
| `app_role` is one of three values | CHECK constraint |
| A person reads only their own rows | RLS policy |
| Leave is filed in the filer's own name | RLS `with check` |
| Status may only move along allowed paths | `js/logic/status.js` |
| Leave balance must cover the request | `js/logic/leave.js` |
| Payroll arithmetic | `js/logic/payroll.js` |
Action buttons are generated from the status map rather than
written by hand, so a screen cannot offer a move the workflow
forbids.
Self-service functions in `db.js` take `employee_id` from the
session rather than the form, so a screen cannot file leave in
someone else's name. The RLS `with check` on `leave_requests` is
the same rule written where it cannot be edited.
---
## Payroll calculation
```
Gross = Basic + Housing + Transport + Other + Overtime
Daily rate = Gross ÷ 30
Unpaid = Daily rate × unpaid leave days
Net = Gross − (Unpaid + Other deductions)
```
Worked example from the brief:
```
Basic 8,000
Housing 2,000
Transport 500
Other 300
-----------------
Gross 10,800
Daily rate 360 (10,800 ÷ 30)
2 unpaid days 720
-----------------
Net 10,080
```
---
## Running it locally
1. Clone or download this repository.
2. Open the folder in VS Code.
3. Install the **Live Server** extension.
4. Right click `login.html` → **Open with Live Server**.
Opening the files directly with `file://` will not work — ES
modules require `http://`.
To point it at your own Supabase project, run the SQL files in
this order and replace the two values at the top of
`js/config.js`:
```
1. hrms-schema.sql tables, views, triggers
2. day1-auth.sql auth columns, link trigger, helper functions
3. day3-actor.sql repoint the audit trail at employees
4. day6-rls.sql row level security
```
Then create accounts in **Authentication → Users**, using emails
that already exist in the `employees` table.
---
## Demo accounts
Password for all three: `Sisco2026!`
| Email | Role | Shows |
|---|---|---|
| `Fatima.Almuallim@northwind.com.sa` | HR User | The whole console |
| `Razique.Raza@northwind.com.sa` | HR Manager | Same, plus manager-only actions |
| `Reem.Alshehri@northwind.com.sa` | Employee | Self-service only |
Two accounts in the demo data are deliberately not `Active` —
one `Pending Approval`, one `Draft`. They have accounts and
cannot sign in. That is the rule that an employee who has not
been approved yet does not get into the system.
`day6b-accounts.sql` creates accounts for every employee at once.
It writes directly into the `auth` schema, which is fine for a
demo database and is **not** how accounts should be created in
production — there, people register themselves and choose their
own password.
---
## Known limitations
- The payroll daily rate uses **gross** salary. Whether the
policy should use basic salary instead is one line in
`js/logic/payroll.js`. This is a question for HR, not a bug.
- No file uploads, so no employee documents or photos.
- Reports export to CSV, not to PDF.
- Passwords are the only factor. No reset flow, no MFA.
- `payslip.html` is shared by HR and employees. RLS makes it
safe — the database returns nothing for a payslip that is not
yours — but it is one page doing two jobs.
---
## Author
Fatima Almuallim — trainee, SISCO, Dammam.
