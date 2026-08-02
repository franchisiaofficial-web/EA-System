-- RLS for passed_out_records (sprint: enrollment/promotion/attendance integration)
-- Same pattern as existing tables: school-scoped via has_active_membership.

-- Helpers (idempotent — matches rls-policies.sql so this file is self-sufficient)
create or replace function current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '');
$$;

create or replace function has_active_membership(p_school_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from memberships m
    where m.school_id = p_school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
  );
$$;

alter table passed_out_records enable row level security;

create policy "passed_out_records select own school"
on passed_out_records for select
using (has_active_membership(school_id));

create policy "passed_out_records insert own school"
on passed_out_records for insert
with check (has_active_membership(school_id));

create policy "passed_out_records update own school"
on passed_out_records for update
using (has_active_membership(school_id))
with check (has_active_membership(school_id));

create policy "passed_out_records delete own school"
on passed_out_records for delete
using (has_active_membership(school_id));
