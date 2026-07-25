-- ============================================
-- Sprint 1 — Academic Foundation RLS Policies
-- ============================================

-- ============================================
-- Helper: check teacher has active class assignment
-- ============================================
create or replace function has_class_assignment(p_class_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from class_assignments ca
    join memberships m on m.id = ca.teacher_membership_id
    where ca.class_id = p_class_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and ca.status = 'ACTIVE'
  );
$$;

-- ============================================
-- academic_years
-- ============================================
alter table academic_years enable row level security;

create policy "select academic years for own school"
on academic_years for select
using (has_active_membership(school_id));

create policy "manage academic years for own school admins"
on academic_years for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = academic_years.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

create policy "update academic years for own school admins"
on academic_years for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = academic_years.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

-- ============================================
-- sections
-- ============================================
alter table sections enable row level security;

create policy "select sections for own school"
on sections for select
using (has_active_membership(school_id));

create policy "manage sections for own school admins"
on sections for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = sections.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

create policy "update sections for own school admins"
on sections for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = sections.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL')
  )
);

-- ============================================
-- classes
-- ============================================
alter table classes enable row level security;

create policy "select classes for own school"
on classes for select
using (has_active_membership(school_id));

create policy "manage classes for own school admins"
on classes for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = classes.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);

create policy "update classes for own school admins"
on classes for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = classes.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);

-- ============================================
-- class_assignments
-- ============================================
alter table class_assignments enable row level security;

create policy "select assignments for own school"
on class_assignments for select
using (has_active_membership(school_id));

create policy "teachers see own assignments"
on class_assignments for select
using (
  exists (
    select 1 from memberships m
    where m.id = class_assignments.teacher_membership_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
  )
);

create policy "manage assignments for own school admins"
on class_assignments for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = class_assignments.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);

create policy "update assignments for own school admins"
on class_assignments for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = class_assignments.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);

-- ============================================
-- class_enrollments
-- ============================================
alter table class_enrollments enable row level security;

create policy "select enrollments for own school"
on class_enrollments for select
using (has_active_membership(school_id));

create policy "students see own enrollments"
on class_enrollments for select
using (
  exists (
    select 1 from memberships m
    where m.id = class_enrollments.student_membership_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
  )
);

create policy "parents see linked child enrollments"
on class_enrollments for select
using (
  exists (
    select 1 from memberships m
    where m.id = class_enrollments.student_membership_id
      and m.status = 'ACTIVE'
      and m.user_id = current_user_id()
  )
  or
  exists (
    select 1 from memberships m
    where m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role = 'PARENT'
      and m.school_id = class_enrollments.school_id
  )
);

create policy "manage enrollments for own school admins"
on class_enrollments for insert
with check (
  exists (
    select 1 from memberships m
    where m.school_id = class_enrollments.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);

create policy "update enrollments for own school admins"
on class_enrollments for update
using (
  exists (
    select 1 from memberships m
    where m.school_id = class_enrollments.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);
