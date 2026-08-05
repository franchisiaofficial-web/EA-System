-- Phase 1.5 D2 fix: roll-number uniqueness constraint

-- One ACTIVE roll number per (school, year, class, section).
-- Partial index (Prisma @@unique does not support WHERE):
-- NULL roll numbers are allowed; only ACTIVE rows participate.
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_target_roll_active_key
ON enrollments (school_id, academic_year_id, class_id, section_id, roll_number)
WHERE roll_number IS NOT NULL AND status = 'ACTIVE';
