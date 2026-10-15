select con.conname,
 con.conrelid::regclass as on_table,
 con.confrelid::regclass as points_at
 from pg_constraint con
 where con.conname in ('fk_approval_actor',
 'fk_audit_actor',
 'fk_payroll_approver');