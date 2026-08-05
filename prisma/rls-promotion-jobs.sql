-- RLS for promotion_jobs + promotion_job_batches (Phase 2 — PromotionJob architecture)
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

alter table promotion_jobs enable row level security;

create policy "promotion_jobs select own school"
on promotion_jobs for select
using (has_active_membership(school_id));

create policy "promotion_jobs insert own school"
on promotion_jobs for insert
with check (has_active_membership(school_id));

create policy "promotion_jobs update own school"
on promotion_jobs for update
using (has_active_membership(school_id))
with check (has_active_membership(school_id));

create policy "promotion_jobs delete own school"
on promotion_jobs for delete
using (has_active_membership(school_id));

alter table promotion_job_batches enable row level security;

-- Batches are reached through their job: school_id is resolved via the parent job.
create policy "promotion_job_batches select own school"
on promotion_job_batches for select
using (has_active_membership((select school_id from promotion_jobs where id = promotion_job_id)));

create policy "promotion_job_batches insert own school"
on promotion_job_batches for insert
with check (has_active_membership((select school_id from promotion_jobs where id = promotion_job_id)));

create policy "promotion_job_batches update own school"
on promotion_job_batches for update
using (has_active_membership((select school_id from promotion_jobs where id = promotion_job_id)))
with check (has_active_membership((select school_id from promotion_jobs where id = promotion_job_id)));

create policy "promotion_job_batches delete own school"
on promotion_job_batches for delete
using (has_active_membership((select school_id from promotion_jobs where id = promotion_job_id)));
