-- Sprint 1: Partial unique indexes for academic foundation

-- Only one active academic year per school
CREATE UNIQUE INDEX IF NOT EXISTS academic_years_school_id_is_active_key
ON academic_years (school_id) WHERE is_active = true;

-- No duplicate active teacher assignments per class+role
CREATE UNIQUE INDEX IF NOT EXISTS class_assignments_class_id_teacher_role_key
ON class_assignments (class_id, teacher_membership_id, role) WHERE status = 'ACTIVE';

-- No duplicate active student enrollments per class
CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_class_id_student_key
ON class_enrollments (class_id, student_membership_id) WHERE status = 'ACTIVE';
