# ADR: Enrollment Relation Naming (Corrected Architecture)

- **Status:** Accepted
- **Date:** 2026-08-01
- **Deciders:** EA System engineering
- **Supersedes:** implicit assumption that `enrollments` is a single concept
- **Related:** Sprint A §0 (enrollment consolidation — deferred), Sprint A §1 (RLS Security Gate — Option B deferral documented), Sprint A closure Phase 1 evidence

## Context

The schema contains **three distinct models** that all carry the word "enrollment" in their names or relation fields. Their names collide across models in ways that resolve differently per parent model:

| Model | Relation field | Resolves to | Table | schema.prisma |
|---|---|---|---|---|
| `Student` | `enrollments` | **`StudentEnrollment`** | `student_enrollments` | :852 |
| `Student` | `enrollmentRecords` | **`Enrollment`** | `enrollments` | :853 |
| `Class` | `enrollments` | **`ClassEnrollment`** | `class_enrollments` | :377 |
| `Class` | `studentEnrollments` | **`StudentEnrollment`** | `student_enrollments` | :378 |
| `Class` | `enrollmentRecords` | **`Enrollment`** | `enrollments` | :379 |
| `Section` | `studentEnrollments` | **`StudentEnrollment`** | `student_enrollments` | :338 |
| `Section` | `enrollmentRecords` | **`Enrollment`** | `enrollments` | :345 |
| `AcademicYear` | `studentEnrollments` | **`StudentEnrollment`** | `student_enrollments` | :315 |
| `AcademicYear` | `enrollments` | **`Enrollment`** | `enrollments` | :316 |
| `Membership` | `studentEnrollments` | **`ClassEnrollment`** | `class_enrollments` | :108 |
| `School` | `classEnrollments` | **`ClassEnrollment`** | `class_enrollments` | :31 |
| `School` | `enrollmentRecords` | **`Enrollment`** | `enrollments` | :64 |

Two observed failure modes motivated this record:

1. **Stale-read trap.** Verification scripts read `Student.enrollments` expecting the operational enrollment and received the legacy `student_enrollments` rows — which the promotion service never writes. The data "looked wrong" (a student shown as still ACTIVE in 2025-2026 after promotion) until raw SQL proved the operational state was correct. Any future reader of `Student.enrollments` or `Class.enrollments` will hit the same trap.
2. **Model-name-vs-resolution mismatch.** `_count.enrollments` on `Class` resolves to `ClassEnrollment`; the same field name on `AcademicYear` resolves to `Enrollment`. Pattern-matching on the word "enrollments" without resolving the parent model produces misclassification.

## Decision

Retain the current naming (consolidation is deferred per Sprint A §0) but establish a canonical classification and hard usage rules:

- **Category A — `Enrollment` model (`enrollments` table).** The single operational enrollment record. Owned by the promotion service and all academic write paths. Keyed by school+student with a partial unique index (`enrollments_school_student_active_key`) permitting exactly one ACTIVE row per student (DB-enforced; verified 2026-08-01, 0 violations).
- **Category B — `StudentEnrollment` model (`student_enrollments` table).** Legacy join table. Seeded historically; **not written by any operational service** (verified 2026-08-01: `studentEnrollment.(create|update|upsert|delete|createMany|updateMany|deleteMany)` — 0 matches under `src/`; only `prisma/seed.ts:206,580` (wipe `deleteMany`, seed `createMany`) touch it; unchanged across the promotion run — still 1560 ACTIVE rows dated pre-promotion). Its `enrollments` relation is a footgun.
- **Category C — `ClassEnrollment` model (`class_enrollments` table).** Membership-linked class roster. The attendance roster source (`getEnrollments`). Currently has **0 rows** in the seeded database. Producer exists but is **unreachable**: `enrollStudent` (`academic-service.ts:429`), `transferStudent` (:466), `archiveEnrollment` (:519) are exported with audit logging and RLS but have **zero call sites** in `src/`; the seed does not populate the table; the promotion service writes Category A only — so 0 rows is consistent with the current wiring (verified 2026-08-01). RLS policies exist for it in `rls-academic.sql` / `rls-parent.sql`.

### Usage rules

1. **Never** read `Student.enrollments` or `Class.enrollments` for operational enrollment data. Use `enrollmentRecords` (Category A).
2. `Class.enrollments` and `Membership.studentEnrollments` resolve to Category C — treat them as roster, never as enrollment.
3. Attendance rosters must come from Category C (`getEnrollments` → `classEnrollment`).
4. Any new read of an "enrollments"-named relation must resolve the parent model against the table above before coding or reviewing.
5. Consolidation (single model) is deferred; this ADR is the inventory the consolidation must retire.

## Consolidation Inventory (grep-verified 2026-08-01)

### Category A — `Enrollment` (`enrollments`)

| Location | Access |
|---|---|
| `src/app/api/students/[id]/route.ts:19` | Student.enrollmentRecords (ACTIVE include) |
| `src/app/api/classes/[id]/route.ts:36` | Class.enrollmentRecords (ACTIVE ids) |
| `src/app/api/classes/route.ts:51` | Class.enrollmentRecords (ACTIVE ids) |
| `src/app/api/students/route.ts:74-76, 86` | Student.enrollmentRecords filters + include |
| `src/app/api/academic-years/route.ts:35` | AcademicYear `_count.enrollments` (→ Enrollment) |
| `src/app/api/attendance/route.ts:94-105` | tx.enrollment (summary path — see Defect note) |
| `src/services/promotion/promotion-service.ts:132-183` | tx.enrollment (operational read/write) |
| `src/app/dashboard/academics/academic-years/AcademicYearList.tsx:22,139` | AcademicYear `_count.enrollments` |
| `src/app/dashboard/academics/classes/ClassList.tsx:17,63` | enrollmentRecords (response mirror) |
| `src/app/dashboard/academics/classes/[id]/page.tsx:23,51,351,379` | enrollmentRecords |
| `src/app/dashboard/academics/promotion/PromotionClient.tsx:20,99,250` | Student.enrollmentRecords |
| `src/app/dashboard/academics/students/StudentList.tsx:15,120,124` | enrollmentRecords |
| `src/app/dashboard/academics/students/[id]/edit/page.tsx:17,23` | enrollmentRecords |
| `src/app/dashboard/academics/students/[id]/page.tsx:17,40` | enrollmentRecords |
| `src/app/dashboard/academics/students/[id]/StudentProfile.tsx:51,353,366,380` | enrollments (fed from enrollmentRecords) |
| `prisma/seed.ts:898` | Student.enrollmentRecords integrity filter |

### Category B — `StudentEnrollment` (`student_enrollments`, legacy)

| Location | Access |
|---|---|
| `src/app/api/classes/route.ts:71,84` | tx.studentEnrollment (section mapping for attendance aggregation) |
| `src/app/api/classes/[id]/route.ts:37,44,91,94` | Class.studentEnrollments + `_count` delete guard |
| `src/app/api/classes/route.ts:52` | Class.studentEnrollments (ACTIVE ids) |
| `src/app/api/sections/route.ts:42` | Section `_count.studentEnrollments` |
| `src/app/api/sections/[id]/route.ts:29,34` | Section.studentEnrollments + `_count` |
| `src/app/dashboard/academics/classes/ClassList.tsx:18,63` | studentEnrollments (response mirror) |
| `src/app/dashboard/academics/classes/[id]/page.tsx:24,42,239,271,379,484` | `_count` + list |
| `src/app/dashboard/academics/sections/SectionList.tsx:14,109` | `_count.studentEnrollments` |
| `src/app/dashboard/academics/sections/[id]/page.tsx:19,32,33,76,159,163` | StudentEnrollment roster UI |

### Category C — `ClassEnrollment` (`class_enrollments`)

| Location | Access |
|---|---|
| `src/services/academic/academic-service.ts:429-542` | enrollStudent / transferStudent / archiveEnrollment — **unreachable** (zero call sites, verified 2026-08-01) |
| `src/services/academic/academic-service.ts:544-555` | getEnrollments — **migrated to Category A on 2026-08-01** (retained as a Category A roster read; no longer touches this table) |
| `src/app/dashboard/teacher/attendance/page.tsx` | **migrated to Category A on 2026-08-01** (single `withRls` block: class list + ACTIVE enrollment roster + attendance) |
| `src/app/dashboard/principal/attendance/page.tsx` | **migrated to Category A on 2026-08-01** (batch month summary) |
| `prisma/rls-academic.sql:170-223` | RLS policies on class_enrollments |
| `prisma/rls-parent.sql:69-83` | RLS policy on class_enrollments |
| `prisma/schema.prisma:31,108` | School.classEnrollments, Membership.studentEnrollments (declared; no src usage) |

Trap spot-checks performed: `Membership.studentEnrollments` → ClassEnrollment (Category **C**, not A); `Class.enrollments` → ClassEnrollment (Category **C**, not A); `AcademicYear.enrollments` → Enrollment (Category **A**). All classified by resolving the parent model, not by field-name matching.

## Defect note (verified 2026-08-01) — RESOLVED by hotfix

`src/app/api/attendance/route.ts:94-105` (attendance `?summary=true` path) read Category A (`enrollment`, `status: 'ACTIVE'` by classId) purely to map membership→section. After the close-year promotion, completed-year classes hold zero ACTIVE enrollments, so the section-bucket summary returned empty for historical classes while the records path (`/api/attendance?classId=...&from&to`, reads `attendanceRecord`) returned full data (verified: 120 records, 104 PRESENT / 12 ABSENT / 4 EXCUSED for `seed_cls_2526_g00` June 2026). The roster path (`getEnrollments` → Category C) is unaffected by promotion.

**Resolution (2026-08-01):** Option A hotfix, **Approach 2** — the summary mapping now reads any-status Category A rows (the `status: 'ACTIVE'` filter was removed; `joinedAt`/`leftAt` window filters retained). Rationale: promotion preserves `classId`/`sectionId` on PROMOTED/PASSED_OUT rows, so completed-year mappings remain complete; Approach 1 (Category C roster) was rejected because its producer is unreachable (0 rows) and would have returned empty buckets for every class. Trade-off: buckets may include rows for students who transferred/withdrew within the queried window (bounded by the date filters). Verified: `seed_cls_2526_g00` June 2026 summary now returns 3 buckets (`seed_sec_2526_g00_a/b/c`) totalling 120 marks — exactly matching the records path. Current-year (2627) summary returns empty by data absence (the seed generates attendance records only for 2025-2026; new-year records are operational input).

## Attendance roster gate finding (verified 2026-08-01, Phase 1A) — RESOLVED (Option A approved)

The **teacher/principal attendance UI roster was sourced from Category C**: `TeacherAttendancePage` and `PrincipalAttendancePage` called `getEnrollments` (`academic-service.ts:544-555` → `tx.classEnrollment.findMany({ classId, isDeleted:false, status:'ACTIVE' })`), and `listClasses` reported `_count.enrollments` (also Category C) in the class dropdown. Live verification: `class_enrollments` had **0 rows** (seed, promotion, and all write paths never produce them), so **every class rendered 0 students** — teacher page displayed "No students enrolled in this class." (HTTP 200, verified for `seed_cls_2627_g07`), principal dashboard showed empty class summaries and totalStudents 0. The save path was unaffected: `markAttendance`/`bulkMarkAttendance` validate eligibility from **Category A** (`enrollment` ACTIVE by classId) and duplicate-guard on `attendanceRecord` (partial unique `attendance_records_student_date_key` on (studentMembershipId, date) WHERE is_deleted = false, DB-enforced).

**Resolution (2026-08-01, approved as Option A — roster reads Category A, no backfill, no dual-write):**
- `getEnrollments` now reads `enrollment` (`status: 'ACTIVE'`, classId) mapping membership via `user.memberships` (STUDENT, ACTIVE, take 1) — same pattern the summary path and bulk wildcard already used.
- `listClasses`/`getClass` `_count` moved off the `enrollments` trap field onto `enrollmentRecords` filtered `status: 'ACTIVE'` (Category A counts).
- `TeacherAttendancePage` rewritten to one `withRls` block: class list + `enrollment.groupBy` ACTIVE counts + roster + attendance for the `?classId=`/`?date=` params (previously the page ignored `?classId=` and always rendered the first alphabetically-listed class — class switching showed the wrong roster; fixed).
- `PrincipalAttendancePage` rewritten: month summary in 2 batch queries instead of 45-class × per-student `getAttendanceSummary` (was 1440+ sequential round trips ≈ 301s; now ~4s).
- `bulkMarkAttendance` rewritten: one validation query (membership→student→eligibility→existing via `unnest`) + one `INSERT … RETURNING` (ids generated in service; `updated_at` supplied) + audit — previously 5 sequential queries **per student** (120-student save ≈ 4.2s warm; now ≈ 2.1-2.6s; 40-student ≈ 2.1s). Eligibility window uses end-of-day (`timestamptz`) so same-day joins (promotion ran 2026-08-01 06:06Z) qualify.
- Verified live 2026-08-01: Pre-KG renders 2 students, Grade 5 renders 120, Grade 10 renders 120 (Category A ACTIVE counts: 2 / 120 / 120); attendance marked and persisted for Pre-KG (2), Grade 5 (120), Grade 10 (120), Grade 1 (40), Grade 4 (120) on 2026-08-01; duplicate attempts rejected with counts unchanged; summary buckets for current + completed years correct; per-student duplicate rows: 0; students with >1 ACTIVE enrollment: 0; passed-out students: 0 ACTIVE enrollments, 120 `passed_out_records` preserved.
- Remaining note: the teacher class dropdown lists all 45 classes across years (completed-year classes legitimately show 0 students — their ACTIVE roster is empty). Category C retains RLS policies but now has **no src consumers** outside its unreachable producers.

## Consequences

- Category A is the single source of truth for enrollment state; the one-ACTIVE-per-student invariant is DB-enforced and was re-verified 0 violations on 2026-08-01.
- Category B rows are frozen history; UI counts sourced from B (class/section student counts) are stale by design until consolidation.
- Category C was the intended roster of record for attendance, but had no working producer; **the attendance roster now reads Category A** (2026-08-01, Option A). Category C retains RLS policies and its unreachable producers (`enrollStudent`/`transferStudent`/`archiveEnrollment`) but has **no src consumers** — it is now a candidate for retirement in Sprint B consolidation.
- Consolidation work must retire B and C or unify them; this inventory is its input.
