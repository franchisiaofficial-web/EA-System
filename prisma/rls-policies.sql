-- rls-policies.sql
-- Run this AFTER `npx prisma migrate dev` has created the tables.
-- Prisma does not manage RLS policies — apply this separately via
-- Supabase SQL editor or a migration hook.
--
-- Enforcement model (Path B — Prisma + SET LOCAL):
--   - current_user_id() reads `app.current_user_id` session variable,
--     set by Prisma middleware via SET LOCAL inside $transaction
--   - A user can act on a school's data only if they hold an ACTIVE membership there
--   - service_role (used by Prisma for admin/cron/webhook work) bypasses RLS entirely
--     by default in Supabase — that is intentional, keep that key server-side only

-- ============================================
-- Helper: read current user from session variable
-- ============================================
create or replace function current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '');
$$;

-- ============================================
-- Helper: check active membership
-- ============================================
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

-- ============================================
-- schools
-- ============================================
alter table schools enable row level security;

create policy "select own school"
on schools for select
using (has_active_membership(id));

-- Only service_role creates/suspends/deletes schools (Super Admin flows
-- go through a server route using the service key, not the anon client)
-- No insert/update/delete policy for regular users = denied by default.

-- ============================================
-- memberships
-- ============================================
alter table memberships enable row level security;

create policy "select memberships in own school"
on memberships for select
using (has_active_membership(school_id));

-- Membership creation/edits happen via service_role (invite acceptance flow,
-- School Admin actions routed through a server-side check), not direct client writes.

-- ============================================
-- school_settings
-- ============================================
alter table school_settings enable row level security;

create policy "select settings for own school"
on school_settings for select
using (has_active_membership(school_id));

create policy "update settings for own school admins"
on school_settings for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = school_settings.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN')
  )
);

-- ============================================
-- features (read-only for all authenticated users)
-- ============================================
alter table features enable row level security;

create policy "select features for own school"
on features for select
using (
  exists (
    select 1 from school_features sf
    where sf.feature_id = features.id
      and has_active_membership(sf.school_id)
  )
);

-- Writes: service_role only (Super Admin manages feature catalog)

-- ============================================
-- school_features
-- ============================================
alter table school_features enable row level security;

create policy "select school features for own school"
on school_features for select
using (has_active_membership(school_id));

-- Writes: service_role only (Super Admin toggles these)

-- ============================================
-- subscriptions
-- ============================================
alter table subscriptions enable row level security;

create policy "select own subscription"
on subscriptions for select
using (has_active_membership(school_id));

-- Writes: service_role only (billing logic, never client-writable)

-- ============================================
-- plans (read-only for all authenticated users)
-- ============================================
alter table plans enable row level security;

create policy "select plans"
on plans for select
using (current_user_id() is not null);

-- Writes: service_role only

-- ============================================
-- invites
-- ============================================
alter table invites enable row level security;

create policy "select invites for own school admins"
on invites for select
using (
  exists (
    select 1 from memberships m
    where m.school_id = invites.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

create policy "create invites for own school admins"
on invites for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = invites.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

-- ============================================
-- audit_logs
-- ============================================
alter table audit_logs enable row level security;

create policy "select audit logs for own school admins"
on audit_logs for select
using (
  school_id is not null
  and exists (
    select 1 from memberships m
    where m.school_id = audit_logs.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

-- Inserts: always via service_role (server-side audit writer), never client-direct.
-- This prevents users from writing fake audit entries.

-- ============================================
-- users
-- ============================================
alter table users enable row level security;

create policy "select own user row"
on users for select
using (id = current_user_id());

create policy "select users in shared schools"
on users for select
using (
  exists (
    select 1 from memberships m1
    join memberships m2 on m1.school_id = m2.school_id
    where m1.user_id = current_user_id()
      and m1.status = 'ACTIVE'
      and m2.user_id = users.id
      and m2.status = 'ACTIVE'
  )
);

create policy "update own user row"
on users for update
using (id = current_user_id());

-- ============================================
-- sessions (managed by BetterAuth, read-only for users)
-- ============================================
alter table sessions enable row level security;

create policy "select own sessions"
on sessions for select
using (user_id = current_user_id());

-- Writes: BetterAuth server-side only

-- ============================================
-- accounts (managed by BetterAuth)
-- ============================================
alter table accounts enable row level security;

create policy "select own accounts"
on accounts for select
using (user_id = current_user_id());

-- Writes: BetterAuth server-side only

-- ============================================
-- verifications (managed by BetterAuth)
-- ============================================
alter table verifications enable row level security;

-- No client access — BetterAuth manages these server-side

-- ============================================
-- permissions (read-only reference data)
-- ============================================
alter table permissions enable row level security;

create policy "select permissions"
on permissions for select
using (current_user_id() is not null);

-- Writes: service_role only

-- ============================================
-- TEST QUERIES — run these manually after applying policies
-- ============================================
-- 1. As User A (School X member), try: select * from schools where id = '<School Y id>';
--    Expect: 0 rows returned.
-- 2. As User A, try: select * from memberships where school_id = '<School Y id>';
--    Expect: 0 rows returned.
-- 3. Suspend User A's membership (status = 'SUSPENDED'), retry query on own school.
--    Expect: 0 rows returned — suspended members lose access immediately.
-- 4. Using service_role key, confirm all rows across all schools are visible
--    (this key must only ever be used server-side, never shipped to client).
