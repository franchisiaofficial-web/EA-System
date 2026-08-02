-- RLS for staff_profiles and subject_assignments (sprint: staff management / subject assignment)
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

alter table staff_profiles enable row level security;

create policy "staff_profiles select own school"
on staff_profiles for select
using (has_active_membership(school_id));

create policy "staff_profiles insert own school"
on staff_profiles for insert
with check (has_active_membership(school_id));

create policy "staff_profiles update own school"
on staff_profiles for update
using (has_active_membership(school_id))
with check (has_active_membership(school_id));

create policy "staff_profiles delete own school"
on staff_profiles for delete
using (has_active_membership(school_id));

alter table subject_assignments enable row level security;

create policy "subject_assignments select own school"
on subject_assignments for select
using (has_active_membership(school_id));

create policy "subject_assignments insert own school"
on subject_assignments for insert
with check (has_active_membership(school_id));

create policy "subject_assignments update own school"
on subject_assignments for update
using (has_active_membership(school_id))
with check (has_active_membership(school_id));

create policy "subject_assignments delete own school"
on subject_assignments for delete
using (has_active_membership(school_id));
