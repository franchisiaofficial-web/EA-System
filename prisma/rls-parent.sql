-- Sprint 1.5 — Parent-Student RLS Helper + Policy Updates

-- ============================================
-- Helper: check parent link to student
-- ============================================
create or replace function has_parent_link(p_student_membership_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from parent_student_links pl
    join memberships m on m.id = pl.parent_membership_id
    where pl.student_membership_id = p_student_membership_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and pl.status = 'ACTIVE'
  );
$$;

-- ============================================
-- parent_student_links
-- ============================================
alter table parent_student_links enable row level security;

create policy "select parent links for own school"
on parent_student_links for select
using (has_active_membership(school_id));

create policy "parents see own links"
on parent_student_links for select
using (
  exists (
    select 1 from memberships m
    where m.id = parent_student_links.parent_membership_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
  )
);

create policy "manage parent links for own school admins"
on parent_student_links for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = parent_student_links.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

create policy "update parent links for own school admins"
on parent_student_links for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = parent_student_links.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

-- ============================================
-- DROP the old overscoped parent enrollment policy
-- ============================================
drop policy if exists "parents see linked child enrollments" on class_enrollments;

-- ============================================
-- REPLACE with properly scoped policy
-- ============================================
create policy "parents see linked child enrollments"
on class_enrollments for select
using (has_parent_link(student_membership_id));

-- ============================================
-- ADD has_parent_link scope to class_enrollments 
-- student view (students see own enrollment)
--============================================
-- Note: The student policy already exists and is correct
-- "students see own enrollments" checks own membership
-- No changes needed for student policy
