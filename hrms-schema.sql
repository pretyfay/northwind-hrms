 -- PART 1 · MASTER TABLES


create table users (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  role        text not null check (role in ('HR User', 'HR Manager')),
  created_at  timestamptz not null default now()
);

create table departments (
  id          serial primary key,
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table designations (
  id          serial primary key,
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table leave_types (
  id                       serial primary key,
  name                     text not null unique,
  has_balance              boolean not null default true,
  is_paid                  boolean not null default true,
  default_entitlement_days integer not null default 0
                           check (default_entitlement_days >= 0),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);



-- PART 2 · EMPLOYEES


create table employees (
  id                uuid primary key default gen_random_uuid(),
  employee_code     text not null unique,
  full_name         text not null,
  email             text unique,
  mobile            text,
  date_of_birth     date,
  gender            text check (gender in ('Male', 'Female')),
  nationality       text,
  joining_date      date not null,
  department_id     integer references departments(id),
  designation_id    integer references designations(id),
  location          text,
  manager_id        uuid references employees(id),
  employment_type   text check (employment_type in
                      ('Full-time', 'Part-time', 'Contract')),
  status            text not null default 'Draft'
                      check (status in ('Draft', 'Pending Approval',
                        'Approved', 'Active', 'Inactive', 'Rejected')),
  separation_type   text check (separation_type in
                      ('Resignation', 'Termination',
                       'End of Contract', 'Retirement')),
  separation_date   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_employees_status on employees(status);
create index idx_employees_department on employees(department_id);

-- Auto-generated employee code: EMP-000001
create sequence employee_code_seq start 1;

create or replace function generate_employee_code()
returns text
language sql
as $$
  select 'EMP-' || lpad(nextval('employee_code_seq')::text, 6, '0');
$$;

alter table employees
  alter column employee_code set default generate_employee_code();



-- PART 3 · EMPLOYEE SALARY
-- Salary history is preserved. Changing a salary inserts a new row.


create table employee_salary (
  id                        uuid primary key default gen_random_uuid(),
  employee_id               uuid not null,
  basic_salary              numeric(12,2) not null default 0,
  housing_allowance         numeric(12,2) not null default 0,
  transportation_allowance  numeric(12,2) not null default 0,
  other_allowance           numeric(12,2) not null default 0,
  effective_date            date not null,
  is_current                boolean not null default true,
  created_at                timestamptz not null default now()
);

alter table employee_salary
  add constraint fk_salary_employee
  foreign key (employee_id)
  references employees(id) on delete cascade;

alter table employee_salary
  add constraint ck_basic check (basic_salary >= 0);

alter table employee_salary
  add constraint ck_housing check (housing_allowance >= 0);

alter table employee_salary
  add constraint ck_transport check (transportation_allowance >= 0);

alter table employee_salary
  add constraint ck_other check (other_allowance >= 0);

create index idx_salary_employee
  on employee_salary(employee_id);

-- Only ONE salary row per employee may be marked current.
create unique index idx_one_current_salary
  on employee_salary(employee_id)
  where is_current = true;



-- PART 4 · ATTENDANCE


create table attendance (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null,
  attendance_date  date not null,
  check_in         time,
  check_out        time,
  working_hours    numeric(5,2) not null default 0,
  status           text not null default 'Present',
  remarks          text,
  created_at       timestamptz not null default now()
);

alter table attendance
  add constraint fk_attendance_employee
  foreign key (employee_id)
  references employees(id) on delete cascade;

-- No duplicate attendance for the same employee on the same date.
alter table attendance
  add constraint uq_attendance_day
  unique (employee_id, attendance_date);

alter table attendance
  add constraint ck_attendance_status
  check (status in ('Present', 'Absent', 'Late', 'Half Day',
                    'Leave', 'Holiday', 'Weekend'));

alter table attendance
  add constraint ck_attendance_hours
  check (working_hours >= 0);

alter table attendance
  add constraint ck_attendance_times
  check (check_out is null
      or check_in is null
      or check_out > check_in);

create index idx_attendance_employee on attendance(employee_id);
create index idx_attendance_date on attendance(attendance_date);

-- Working hours are calculated by the database, not by the page.
create or replace function calc_working_hours()
returns trigger
language plpgsql
as $$
begin
  if new.check_in is not null and new.check_out is not null then
    new.working_hours := round(
      extract(epoch from (new.check_out - new.check_in)) / 3600.0,
      2);
  else
    new.working_hours := 0;
  end if;
  return new;
end;
$$;

create trigger trg_calc_working_hours
  before insert or update on attendance
  for each row
  execute function calc_working_hours();


-- PART 5 · LEAVE REQUESTS


create table leave_requests (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null,
  leave_type_id     integer not null,
  from_date         date not null,
  to_date           date not null,
  number_of_days    integer not null default 1,
  reason            text,
  status            text not null default 'Draft',
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table leave_requests
  add constraint fk_leave_employee
  foreign key (employee_id)
  references employees(id) on delete cascade;

alter table leave_requests
  add constraint fk_leave_type
  foreign key (leave_type_id)
  references leave_types(id);

alter table leave_requests
  add constraint ck_leave_status
  check (status in ('Draft', 'Submitted', 'Pending Approval',
                    'Approved', 'Rejected'));

alter table leave_requests
  add constraint ck_leave_dates
  check (to_date >= from_date);

alter table leave_requests
  add constraint ck_leave_days
  check (number_of_days > 0);

-- A rejected request must carry a reason.
alter table leave_requests
  add constraint ck_rejection_reason
  check (status <> 'Rejected'
      or (rejection_reason is not null
          and length(trim(rejection_reason)) > 0));

create index idx_leave_employee on leave_requests(employee_id);
create index idx_leave_status on leave_requests(status);
create index idx_leave_dates on leave_requests(from_date, to_date);

-- Leave days count both the first and the last day.
create or replace function calc_leave_days()
returns trigger
language plpgsql
as $$
begin
  new.number_of_days := (new.to_date - new.from_date) + 1;
  return new;
end;
$$;

create trigger trg_calc_leave_days
  before insert or update on leave_requests
  for each row
  execute function calc_leave_days();



-- PART 5C · LEAVE BALANCES
-- Remaining days are never stored. Always calculated.


create table leave_balances (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null,
  leave_type_id     integer not null,
  year              integer not null,
  entitlement_days  numeric(5,1) not null default 0,
  taken_days        numeric(5,1) not null default 0,
  created_at        timestamptz not null default now()
);

alter table leave_balances
  add constraint fk_balance_employee
  foreign key (employee_id)
  references employees(id) on delete cascade;

alter table leave_balances
  add constraint fk_balance_type
  foreign key (leave_type_id)
  references leave_types(id);

alter table leave_balances
  add constraint uq_balance
  unique (employee_id, leave_type_id, year);

alter table leave_balances
  add constraint ck_entitlement check (entitlement_days >= 0);

alter table leave_balances
  add constraint ck_taken check (taken_days >= 0);

alter table leave_balances
  add constraint ck_balance_not_exceeded
  check (taken_days <= entitlement_days);

create index idx_balance_employee on leave_balances(employee_id);



-- PART 6 · PAYROLL


create table payroll (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null,
  payroll_month      date not null,
  gross_salary       numeric(12,2) not null default 0,
  total_deductions   numeric(12,2) not null default 0,
  net_salary         numeric(12,2) not null default 0,
  unpaid_leave_days  numeric(5,1) not null default 0,
  daily_rate         numeric(12,2) not null default 0,
  status             text not null default 'Draft',
  calculated_at      timestamptz,
  approved_at        timestamptz,
  approved_by        uuid,
  processed_at       timestamptz,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table payroll
  add constraint fk_payroll_employee
  foreign key (employee_id)
  references employees(id) on delete cascade;

alter table payroll
  add constraint fk_payroll_approver
  foreign key (approved_by)
  references users(id);

alter table payroll
  add constraint ck_payroll_status
  check (status in ('Draft', 'Calculated', 'Pending Approval',
                    'Approved', 'Processed', 'Paid', 'Cancelled'));

alter table payroll
  add constraint ck_gross check (gross_salary >= 0);

alter table payroll
  add constraint ck_deductions check (total_deductions >= 0);

alter table payroll
  add constraint ck_unpaid_days check (unpaid_leave_days >= 0);

alter table payroll
  add constraint ck_daily_rate check (daily_rate >= 0);

-- payroll_month must always be the 1st of a month.
alter table payroll
  add constraint ck_month_first_day
  check (extract(day from payroll_month) = 1);

create index idx_payroll_employee on payroll(employee_id);
create index idx_payroll_month on payroll(payroll_month);
create index idx_payroll_status on payroll(status);

-- RULE 1: no two active payrolls for the same employee and month.
-- Cancelled ones are excluded, so they can be replaced.
create unique index uq_payroll_employee_month
  on payroll(employee_id, payroll_month)
  where status <> 'Cancelled';



-- PART 6B · PAYROLL LINE ITEMS
-- Line items, not fixed columns, so the payslip is a query.


create table payroll_earnings (
  id              uuid primary key default gen_random_uuid(),
  payroll_id      uuid not null,
  component_name  text not null,
  amount          numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

alter table payroll_earnings
  add constraint fk_earnings_payroll
  foreign key (payroll_id)
  references payroll(id) on delete cascade;

alter table payroll_earnings
  add constraint ck_earning_amount check (amount >= 0);

create index idx_earnings_payroll on payroll_earnings(payroll_id);


create table payroll_deductions (
  id              uuid primary key default gen_random_uuid(),
  payroll_id      uuid not null,
  component_name  text not null,
  amount          numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

alter table payroll_deductions
  add constraint fk_deductions_payroll
  foreign key (payroll_id)
  references payroll(id) on delete cascade;

alter table payroll_deductions
  add constraint ck_deduction_amount check (amount >= 0);

create index idx_deductions_payroll on payroll_deductions(payroll_id);



-- PART 7 · PAYSLIPS


create table payslips (
  id              uuid primary key default gen_random_uuid(),
  payroll_id      uuid not null,
  payslip_number  text not null,
  generated_at    timestamptz not null default now(),
  payment_status  text not null default 'Pending',
  payment_date    date
);

alter table payslips
  add constraint fk_payslip_payroll
  foreign key (payroll_id)
  references payroll(id) on delete cascade;

alter table payslips
  add constraint uq_payslip_payroll unique (payroll_id);

alter table payslips
  add constraint uq_payslip_number unique (payslip_number);

alter table payslips
  add constraint ck_payment_status
  check (payment_status in ('Pending', 'Paid'));

-- Auto-generated payslip number: PS-2026-09-000001
create sequence payslip_seq start 1;

create or replace function generate_payslip_number()
returns text
language sql
as $$
  select 'PS-'
      || to_char(now(), 'YYYY-MM')
      || '-'
      || lpad(nextval('payslip_seq')::text, 6, '0');
$$;

alter table payslips
  alter column payslip_number
  set default generate_payslip_number();



-- PART 8 · APPROVAL HISTORY
-- One table for all three workflows.


create table approval_history (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  from_status  text,
  to_status    text not null,
  action_by    uuid,
  action_at    timestamptz not null default now(),
  remarks      text
);

alter table approval_history
  add constraint fk_approval_user
  foreign key (action_by)
  references users(id);

alter table approval_history
  add constraint ck_entity_type
  check (entity_type in ('employee', 'leave_request', 'payroll'));

create index idx_approval_entity
  on approval_history(entity_type, entity_id);



-- PART 8B · AUDIT LOG


create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  table_name    text not null,
  record_id     uuid,
  action        text not null,
  field_name    text,
  old_value     text,
  new_value     text,
  performed_by  uuid,
  performed_at  timestamptz not null default now(),
  remarks       text
);

alter table audit_logs
  add constraint fk_audit_user
  foreign key (performed_by)
  references users(id);

alter table audit_logs
  add constraint ck_audit_action
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE'));

create index idx_audit_table on audit_logs(table_name);
create index idx_audit_record on audit_logs(record_id);
create index idx_audit_date on audit_logs(performed_at desc);



-- PART 9 · VIEWS


-- Employee with department, designation, manager and current salary.
create or replace view v_employee_full as
select
  e.id,
  e.employee_code,
  e.full_name,
  e.email,
  e.mobile,
  e.date_of_birth,
  e.gender,
  e.nationality,
  e.joining_date,
  e.location,
  e.employment_type,
  e.status,
  e.department_id,
  d.name as department_name,
  e.designation_id,
  g.name as designation_name,
  e.manager_id,
  m.full_name as manager_name,
  s.basic_salary,
  s.housing_allowance,
  s.transportation_allowance,
  s.other_allowance,
  coalesce(s.basic_salary, 0)
    + coalesce(s.housing_allowance, 0)
    + coalesce(s.transportation_allowance, 0)
    + coalesce(s.other_allowance, 0) as gross_salary,
  s.effective_date as salary_effective_date
from employees e
left join departments d
  on d.id = e.department_id
left join designations g
  on g.id = e.designation_id
left join employees m
  on m.id = e.manager_id
left join employee_salary s
  on s.employee_id = e.id
  and s.is_current = true;


-- Leave balance with remaining days calculated, never stored.
create or replace view v_leave_balance as
select
  b.id,
  b.employee_id,
  e.employee_code,
  e.full_name,
  b.leave_type_id,
  t.name as leave_type_name,
  b.year,
  b.entitlement_days,
  b.taken_days,
  (b.entitlement_days - b.taken_days) as remaining_days
from leave_balances b
join employees e
  on e.id = b.employee_id
join leave_types t
  on t.id = b.leave_type_id;


-- All nine dashboard numbers in one row, one request.
create or replace view v_dashboard_counts as
select
  (select count(*)
     from employees) as total_employees,

  (select count(*)
     from employees
    where status = 'Active') as active_employees,

  (select count(*)
     from employees
    where status = 'Inactive') as inactive_employees,

  (select count(distinct employee_id)
     from leave_requests
    where status = 'Approved'
      and current_date between from_date and to_date)
    as on_leave_today,

  (select count(*)
     from attendance
    where attendance_date = current_date
      and status = 'Present') as present_today,

  (select count(*)
     from attendance
    where attendance_date = current_date
      and status = 'Absent') as absent_today,

  (select count(*)
     from leave_requests
    where status = 'Pending Approval')
    as pending_leave_requests,

  (select count(*)
     from payroll
    where status = 'Pending Approval') as pending_payroll,

  (select coalesce(sum(net_salary), 0)
     from payroll
    where payroll_month = date_trunc('month', current_date)::date
      and status <> 'Cancelled') as current_month_payroll;


-- Payroll joined with employee details, for list screens.
create or replace view v_payroll_summary as
select
  p.id,
  p.payroll_month,
  p.gross_salary,
  p.total_deductions,
  p.net_salary,
  p.unpaid_leave_days,
  p.daily_rate,
  p.status,
  p.calculated_at,
  p.approved_at,
  p.processed_at,
  p.paid_at,
  e.id as employee_id,
  e.employee_code,
  e.full_name,
  d.name as department_name,
  g.name as designation_name
from payroll p
join employees e
  on e.id = p.employee_id
left join departments d
  on d.id = e.department_id
left join designations g
  on g.id = e.designation_id;



-- PART 10 · SEED DATA


insert into users (full_name, role) values
  ('Fatima Almuallim', 'HR User'),
  ('Razique Raza', 'HR Manager');

insert into departments (name) values
  ('IT'), ('Finance'), ('HR'),
  ('Procurement'), ('Operations'), ('Administration');

insert into designations (name) values
  ('Software Developer'), ('HR Executive'),
  ('Accountant'), ('Manager'), ('Senior Manager');

insert into leave_types
  (name, has_balance, is_paid, default_entitlement_days) values
  ('Annual Leave',    true,  true,  21),
  ('Sick Leave',      true,  true,  30),
  ('Emergency Leave', true,  true,  5),
  ('Unpaid Leave',    false, false, 0),
  ('Other Leave',     true,  true,  0);


-- Sample employee
insert into employees (full_name, joining_date, department_id,
                       designation_id, status)
values ('Ahmed Ali', '2026-01-01', 1, 1, 'Active');

insert into employee_salary (
  employee_id, basic_salary, housing_allowance,
  transportation_allowance, other_allowance, effective_date
)
select id, 8000, 2000, 500, 300, '2026-01-01'
from employees
where employee_code = 'EMP-000001';

-- Give every employee a balance for each balance-bearing leave type.
insert into leave_balances (
  employee_id, leave_type_id, year, entitlement_days, taken_days
)
select e.id, t.id, 2026, t.default_entitlement_days, 0
from employees e
cross join leave_types t
where t.has_balance = true
on conflict (employee_id, leave_type_id, year) do nothing;



-- PART 11 · VERIFY


select 'users' as table_name, count(*) from users
union all select 'departments', count(*) from departments
union all select 'designations', count(*) from designations
union all select 'leave_types', count(*) from leave_types
union all select 'employees', count(*) from employees
union all select 'employee_salary', count(*) from employee_salary
union all select 'leave_balances', count(*) from leave_balances
union all select 'attendance', count(*) from attendance
union all select 'leave_requests', count(*) from leave_requests
union all select 'payroll', count(*) from payroll;

-- Gross salary should be 10800.00
select employee_code, full_name, gross_salary, status
from v_employee_full;

-- Dashboard should return one row.
select * from v_dashboard_counts;