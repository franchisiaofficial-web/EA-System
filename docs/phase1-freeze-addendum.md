# Phase 1 Stabilization — Security + Freeze Addendum

Status: FINAL — verified 2026-08-01
Companion ADR: `docs/adr/enrollment-relation-naming.md` (decisions unchanged)
This document records the stabilization sprint evidence. It does not rewrite history; prior ADR entries remain authoritative.

---

## SECTION A — Scope Expansion (why each change became necessary)

The approved scope was: *attendance roster source → Category A (Enrollment)*.
The actual implementation grew to four items. Each is explained below with its trigger.

### A.1 Roster source switch (approved scope)
Category C (`class_enrollments`) had zero producers — `enrollStudent`/`transferStudent`/`archiveEnrollment`
were exported but had no call sites, and the seed only populated Categories A + B. Category C total rows: 0.
Roster reads moved to Category A (`enrollment`, status ACTIVE). Verified: Pre-KG 2, Grade 5 120, Grade 10 120
rendered on the live page.

### A.2 Teacher routing correction
`getEnrollments` previously used `enrollments._count` over a join table that could not agree on
"how many students are in this class" (the `_count` convention counted Category C rows = 0).
The count moved to `enrollmentRecords` with `where: { status: 'ACTIVE' }`, and the page now honors
`?classId=` + `?date=` search params. Without this, the teacher page showed an empty roster for every class.

### A.3 Principal optimization
The principal dashboard previously ran 45 classes × 1 summary query per student (≈1440+ sequential
round trips to a remote DB ≈ 301s). Rewritten as two batched queries (enrollments + attendance records
in a date range, merged in JS). Measured: 301.24s → 3.4s.

### A.4 Bulk attendance SQL rewrite
`bulkMarkAttendance` was N×5 sequential queries per student (120 students = 600 round trips ≈ 4.2s).
Rewritten to two raw statements (one validation, one `INSERT ... RETURNING ... WHERE NOT EXISTS`)
with all parameters bound. Measured: 120 students ≈ 2.5s, 40 students ≈ 2.1s.

### A.5 Security scoping (this sprint)
Runtime testing (see Security Gate below) proved the raw SQL write path had **no cross-tenant
isolation**: a School A admin could write attendance rows against School B classes, read them, and
update them. `withRls()` sets `app.current_school_id` but the database has **no RLS enabled**
(`relrowsecurity=false` on all tables — `prisma/rls-attendance.sql` was never applied). Per the sprint
NON-GOALS, the RLS rollout was NOT applied; the isolation fix is application-layer (school-scoped
joins/filters in the validation SQL, duplicate check, INSERT subquery, read paths, and the route).

---

## SECTION B — Behaviour Correction (not new functionality)

### B.1 Cross-tenant write path — attendance-service.ts

Before: validation SQL joined `memberships`/`students`/`enrollments`/`attendance_records` with no
school predicate. A foreign `studentMembershipId` + foreign `classId` passed eligibility and the
`INSERT` wrote `school_id = <attacker school>, class_id = <victim class>`.

After: the same statement is school-scoped (`m.school_id = $6`, `s.school_id = $6`,
`e.school_id = $6`, `ar.school_id = $6`); the INSERT `NOT EXISTS` subquery is school-scoped;
`markAttendance`/`updateAttendanceRecord`/`getClassAttendance`/`getStudentAttendance`/
`getAttendanceSummary` and the route's `summary`/`from-to` branches scope by authenticated school.

### B.2 ID generation — attendance-service.ts

Before: `newCuid()` (hand-rolled cuid-shaped id from `Date.now()` + `randomBytes`).
After: `createId()` from `@paralleldrive/cuid2` (official). Generated ids validate with the same
library's `isCuid()` — no regex, no client-side, no server-side format validation anywhere in `src/`.

### B.3 Duplicate attendance — /api/attendance route

Before: duplicate → HTTP 500 `INTERNAL` (guard threw a plain Error, masked).
After: `AttendanceConflictError` → HTTP 409 `CONFLICT` with the specific message.

---

## SECTION C — Performance (honest)

| Operation | Target | Measured (warm) | Verdict |
|---|---|---|---|
| Teacher attendance page | < 2s | 1.8–2.1s | PASS (cold compile 4.8s excluded) |
| Principal dashboard | < 4s | 3.4s | PASS |
| GET class attendance | < 2s | 1.3–1.5s | PASS |
| Bulk save 120 students | < 2s | 2.5s | **PARTIAL** |
| Bulk save 40 students | < 2s | 2.1s | **PARTIAL** |

Reason for PARTIAL: the DB is remote (Supabase pooler, ap-south-1); bare `SELECT 1` ≈ 100ms warm,
and the bulk path still does 3 round trips (school lookup, validation, insert) plus the audit write.
The dominant cost is network RTT per statement, not statement execution.

Future optimization (deferred, non-blocking): fold the school-timezone lookup and wildcard
expansion into the raw validation statement, and issue the audit insert in the same batch —
projected 1.3–1.6s for 120 students.

---

## SECURITY GATE — verified results (2026-08-01)

### Cross-tenant classification
Attempted (School A admin → School B class, live API + service level):

| Path | Pre-fix | Post-fix |
|---|---|---|
| Wildcard `*` + foreign classId | HTTP 200, 0 rows (silent no-op) | HTTP 200, 0 rows |
| Explicit foreign membership + foreign classId | **HTTP 200 — row written** | HTTP 500, **0 rows written** |
| GET foreign class | **rows returned** | 0 rows |
| Update foreign record | **succeeded** | "Attendance record not found" |
| Direct SQL INSERT with foreign `school_id` | succeeded (unique constraint is the only guard) | succeeded (RLS absent — see below) |

Classification: **Case C — application-layer rejection**. Rejection occurs in the service validation
loop before the INSERT executes. The validation statement is school-scoped, so a foreign
membership/class resolves to a NULL/not-eligible row and the app throws
*"No student account is linked to this membership"* (HTTP 500 INTERNAL).

The database does **not** reject anything (Case B does not exist): RLS is disabled on every table
(`relrowsecurity=false`, zero policies in `pg_policies`). `prisma/rls-attendance.sql` and the other
RLS files were never applied to the database. Applying them is deferred (sprint NON-GOAL) and is
the outstanding defense-in-depth item before production.

### SET LOCAL verification
Inside the same transaction, immediately before the INSERT, on the same raw SQL path:
`SELECT current_setting('app.current_school_id', true)` → `seed_school_ea`
(== authenticated user's schoolId, match: YES). The value reverts to NULL after commit
(SET LOCAL semantics). Caveat: with RLS disabled the setting is context metadata only; it enforces
nothing by itself.

### Audit verification
Successful bulk request → exactly ONE `audit_logs` row
(`action=bulk_create entity=attendance_record actor=seed_user_admin school=seed_school_ea
record_id=<first attendance id> after={date, count, classId}` — all fields verified).
Rollback attempt → ZERO attendance rows and ZERO audit rows.

### Rollback verification
Request with 4 valid + 1 invalid student: rejected; SQL counts prove 0 attendance rows and 0 audit
rows were written. No partial writes.

### ID generation verification
IDs from `@paralleldrive/cuid2::createId`; `isCuid()` returns true (e.g. `tcg5fwi5fkk7tyihdomivkjq`,
24 chars). `newCuid`/`randomBytes` removed from `src/` (grep: 0 occurrences).

### 409 verification
Bulk duplicate → HTTP 409 `{"code":"CONFLICT",...}`; single duplicate → HTTP 409.
Before: HTTP 500 (previous sprint evidence).

### Explicit subset verification
3 students of 40 in `seed_cls_2627_g02`: exactly those 3 rows inserted (PRESENT/LATE/ABSENT),
GET returns exactly 3, the other 37 students untouched, duplicate re-POST → HTTP 409, count unchanged.
Audit: one `bulk_create` row with count=3.

---

## Test fixture (cross-tenant evidence)
School B (`fixture_school_b`, "Meridian Public School") with one class/student/enrollment was created
as a data-only fixture (no schema changes). It is intentionally retained so the isolation evidence can
be reproduced. `docs/evidence/gate-fixture.ts` recreates it; `docs/evidence/gate-xten-prefix.ts` /
`docs/evidence/gate-xten-postfix.ts` reproduce the before/after behaviour.

## Evidence scripts
- `docs/evidence/gate-rls-probe.ts` — RLS enforcement status
- `docs/evidence/gate-xten-prefix.ts` — pre-fix cross-tenant behaviour
- `docs/evidence/gate-xten-postfix.ts` — post-fix cross-tenant behaviour
- `docs/evidence/gate-setlocal.ts` — SET LOCAL / current_setting + cuid2 proof
- `docs/evidence/gate-audit-rollback.ts` — audit + rollback + duplicate proof
- `docs/evidence/gate-fixture.ts` — School B fixture
- HTTP evidence: `security-gate-http.txt` (temp, removed after capture), page/API responses captured 2026-08-01
