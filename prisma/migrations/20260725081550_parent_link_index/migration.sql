-- Sprint 1.5 — Parent-student link partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS parent_student_links_parent_student_key
ON parent_student_links (parent_membership_id, student_membership_id) WHERE status = 'ACTIVE';
