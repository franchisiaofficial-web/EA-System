-- ============================================================
-- TASK 0.3 — BASELINE DATABASE STATE (SQL output)
-- Captured: 2026-08-03T16:08:14.490Z
-- Status: OBSERVED — VERIFIED
-- ============================================================

-- Students per academic year
SELECT e.academic_year_id, ay.name AS year_name, e.status, COUNT(*)::int AS c
FROM enrollments e JOIN academic_years ay ON ay.id = e.academic_year_id
WHERE e.school_id = 'seed_school_ea'
GROUP BY e.academic_year_id, ay.name, e.status ORDER BY ay.name, e.status;

-- output:
--   2024-2025  PROMOTED  520
--   2025-2026  ACTIVE    1457
--   2026-2027  ACTIVE    103

-- Enrollment totals by status (school-wide)
SELECT status, COUNT(*)::int AS c
FROM enrollments WHERE school_id = 'seed_school_ea'
GROUP BY status ORDER BY status;

-- output:
--   ACTIVE    1560
--   PROMOTED  520

-- Enrollments by year
SELECT academic_year_id, status, COUNT(*)::int AS c
FROM enrollments WHERE school_id = 'seed_school_ea'
GROUP BY academic_year_id, status ORDER BY academic_year_id, status;

-- output:
--   seed_ay_2425  PROMOTED  520
--   seed_ay_2526  ACTIVE    1457
--   seed_ay_2627  ACTIVE    103

-- Non-ACTIVE enrollments in 2025-2026 (should be empty)
SELECT status, COUNT(*)::int AS c
FROM enrollments
WHERE school_id = 'seed_school_ea'
  AND academic_year_id = 'seed_ay_2526'
  AND status <> 'ACTIVE'
GROUP BY status;

-- output: (none)

-- PassedOutRecords
SELECT COUNT(*)::int AS c
FROM passed_out_records WHERE school_id = 'seed_school_ea';

-- output: 0

-- Students by status
SELECT status, COUNT(*)::int AS c
FROM students WHERE school_id = 'seed_school_ea'
GROUP BY status ORDER BY status;

-- output:
--   ACTIVE    1567
--   ARCHIVED  2

-- Audit logs (promotion-relevant)
SELECT action, COUNT(*)::int AS c
FROM audit_logs WHERE school_id = 'seed_school_ea'
  AND action IN ('promote','pass_out','complete_year')
GROUP BY action ORDER BY action;

-- output:
--   complete_year  1
--   pass_out       1099
--   promote        9325

-- Academic year flags
SELECT id, name, status, is_active, is_current
FROM academic_years WHERE school_id = 'seed_school_ea'
ORDER BY start_date;

-- output:
--   2024-2025  status=COMPLETED  is_active=false  is_current=false
--   2025-2026  status=ACTIVE    is_active=true   is_current=true
--   2026-2027  status=INACTIVE  is_active=false  is_current=false

-- RECONCILIATION
--   2025-2026 enrollments total: 1457
--   Students total (all statuses): 1569
--   Student-enrollment delta: 112 (103 in 2627 + 9 non-seed students)
--   PassedOutRecords: 0
--   1457 + 103 = 1560 ACTIVE → matches expected seed total
