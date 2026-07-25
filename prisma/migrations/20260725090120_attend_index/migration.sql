-- Sprint 2 — Attendance partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_student_date_key
ON attendance_records (student_membership_id, date) WHERE is_deleted = false;
