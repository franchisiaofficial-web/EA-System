-- Sprint 2 — Attendance RLS Policies

alter table attendance_records enable row level security;

-- Teachers: assigned classes only
create policy "teachers see assigned class attendance"
on attendance_records for select
using (has_class_assignment(class_id));

-- Teachers: mark attendance for assigned classes
create policy "teachers insert assigned class attendance"
on attendance_records for insert
with check (has_class_assignment(class_id));

-- Teachers: update assigned class attendance
create policy "teachers update assigned class attendance"
on attendance_records for update
using (has_class_assignment(class_id));

-- Students: own attendance only
create policy "students see own attendance"
on attendance_records for select
using (
  exists (
    select 1 from memberships m
    where m.id = attendance_records.student_membership_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
  )
);

-- Parents: linked child's attendance only (reuses Sprint 1.5 helper)
create policy "parents see linked child attendance"
on attendance_records for select
using (has_parent_link(student_membership_id));

-- Admins/Principal/Vice Principal: full school access
create policy "admins manage attendance"
on attendance_records for all
using (
  exists (
    select 1 from memberships m
    where m.school_id = attendance_records.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
)
with check (
  exists (
    select 1 from memberships m
    where m.school_id = attendance_records.school_id
      and m.user_id = current_user_id()
      and m.status = 'ACTIVE'
      and m.role in ('SCHOOL_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  )
);
