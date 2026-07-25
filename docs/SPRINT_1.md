# Sprint 1 — Academic Foundation ✅ COMPLETE

## Schema (5 new models)

- `academic_years` — school-scoped, one active per school (partial unique index)
- `sections` — school-scoped section catalog
- `classes` — links academic year + section, supports soft delete
- `class_assignments` — teacher ↔ class, status ACTIVED/REMOVED (preserves history)
- `class_enrollments` — student ↔ class, supports ACTIVE/WITHDRAWN/TRANSFERRED

## Key Constraints

- Partial unique index on `academic_years(school_id)` WHERE `is_active = true`
- Partial unique index on `class_assignments(class_id, teacher_membership_id, role)` WHERE `status = 'ACTIVE'`
- Partial unique index on `class_enrollments(class_id, student_membership_id)` WHERE `status = 'ACTIVE'`
- `removeTeacher()` sets status to REMOVED, never hard-deletes — preserves teaching history

## RLS (18 new policies)

- `has_class_assignment(class_id)` helper — SECURITY DEFINER, checks ACTIVE assignment
- Academic years: SELECT for members, manage for admins
- Sections: SELECT for members, manage for admins
- Classes: SELECT for members, manage for admins/principal/vice-principal
- Assignments: SELECT for members + own assignments, manage for admins
- Enrollments: SELECT for members + own enrollments + parents, manage for admins

## RBAC (5 new resources)

- `academic_years`, `sections`, `classes`, `class_assignments`, `class_enrollments`
- SUPER_ADMIN/SCHOOL_ADMIN: full manage on all
- PRINCIPAL/VICE_PRINCIPAL: manage on class/enrollment/assignment
- TEACHER: read classes/assignments/enrollments
- CLASS_TEACHER: read+update classes
- STUDENT: read classes/enrollments
- PARENT: read classes/enrollments

## Service Layer

- `createAcademicYear`, `updateAcademicYear`, `activateAcademicYear` (deactivates prior)
- `createSection`, `updateSection`, `getSections`
- `createClass`, `updateClass`, `archiveClass`, `getClass`, `listClasses`
- `assignTeacher`, `removeTeacher` (status=REMOVED, preserves history)
- `enrollStudent`, `transferStudent` (same school only), `archiveEnrollment`
- All operations audit-logged, transaction-safe, withRls-wrapped

## Tests (16 new)

- RLS: school admin sees academic years, teacher sees assignment, student sees enrollment, cross-school denied
- has_class_assignment(): true for assigned, false for unassigned
- Partial unique indexes: verified existence, duplicate rejection
- RBAC: school admin manage, teacher read, student read, negative cases
