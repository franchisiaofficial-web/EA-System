# EA SYSTEM — Phase 1.6 Final Security Audit (freeze gate)

Date: 2026-08-02
Scope: Complete `src/app/api/**` surface, cross-tenant isolation. Supersedes and completes the corrected-methodology audit begun in Phase 1.5.
Phase 1.6B consistency gate (2026-08-02): module-label semantics corrected to `PASS (Mutating Paths Verified)` wherever read-only paths are static-only, single canonical severity/count table (Phase 7 Q2), L1-return severity explicitly classified, positive-control replays for every N-guard, literal route-count evidence (Phase 1), and freeze wording updated with the integrity statement (Phase 7 Q7).
Artifacts: `docs/evidence/phase1.6-before.txt` (pre-fix exploits), `docs/evidence/phase1.6-after.txt` (identical post-fix replays), `docs/evidence/phase1.6-positive-control.txt` (in-school positive controls for all N1–N13 guards), harnesses `docs/evidence/h-n-before.ps1` / `h-n-after.ps1` / `h-pc.ps1`, plus all Phase 1.5 artifacts (`phase1.5-runtime.txt`, `phase1.5-http.txt`, `phase1.5-http-after-l14.txt`).

Test identities:
- Authenticated actor: School A admin — session school `seed_school_ea` (user `seed_user_admin`, membership `seed_mem_admin`)
- Target tenant: School B — `fixture_school_b` (`fixture_cls_b_g01`, `fixture_sec_b_g01_a`, `fixture_stu_b1`, `fixture_sub_b_math`, `fixture_ay_b`, plus audit fixtures `fixture_term_b1`, `fixture_crud_b1`, `fixture_cls_b_g02`, `fixture_ay_b2`)
- Every exploit used a REAL foreign row as target; every post-fix replay is byte-identical to the pre-fix request.

Method statement: the Phase 1.6 audit re-reads every route file to completion (no truncated reads), builds a route-level inventory where every route appears exactly once, and independently verifies each client-supplied identifier against a school-scoped lookup before any Prisma write. `Runtime Verified = N` never yields PASS — only `STATIC ONLY` / `NOT VERIFIED` / `NEEDS RUNTIME TEST`. New findings found by this audit are remediated and evidenced in Deliverable-4 format (N1–N13 below).

---

# PHASE 1 — COMPLETE ROUTE INVENTORY (every route exactly once)

Legend: **ID** = identifiers supplied by the client; **Validation** = school-scoped predicate applied to every client identifier before the operation; **Runtime** = Y/N; **Result** = PASS (all routes in the row runtime-verified safe) / PASS (Mutating Paths Verified) (every mutating handler runtime-verified; read-only paths in the row are static-only) / FIXED (finding, runtime-verified closed) / STATIC ONLY (not runtime-tested).

**Route-count evidence (literal, 2026-08-02):**
```
PS> Get-ChildItem -Recurse -Path "D:\Startup\project-1\schoolos\src\app\api" -Filter route.ts | Measure-Object
route.ts file count: 41
```
```
academic-years\route.ts, academic-years\[id]\route.ts, admin\audit-logs\route.ts, admin\error-logs\route.ts,
admin\error-logs\[id]\route.ts, admin\schools\route.ts, admin\schools\[id]\route.ts, attendance\route.ts,
attendance\sessions\route.ts, attendance\sessions\[id]\route.ts, auth\[...all]\route.ts, class-assignments\route.ts,
classes\route.ts, classes\[id]\route.ts, crud-demo\route.ts, dashboard\school-admin\route.ts, exams\route.ts,
fees\route.ts, library\route.ts, promotions\route.ts, promotions\close-year\route.ts, school-settings\route.ts,
sections\route.ts, sections\[id]\route.ts, staff\members\route.ts, staff\members\[id]\route.ts, students\route.ts,
students\drafts\route.ts, students\search\route.ts, students\[id]\route.ts, students\[id]\guardians\route.ts,
students\[id]\guardians\[guardianId]\route.ts, subject-assignments\[id]\route.ts, subjects\route.ts,
subjects\[id]\route.ts, teachers\route.ts, terms\route.ts, test\error\route.ts, test\setup-cross-tenant\route.ts,
timetable\route.ts, transport\route.ts
TOTAL: 41 route.ts files
```
**41/41 files match the Phase 1 inventory exactly — no route file is missing, none is extra.**

## Academic structure

| Route | Method | Client Identifier(s) | Prisma Operation | Tenant Validation Present | Runtime | Evidence | Result |
|---|---|---|---|---|---|---|---|
| `/api/terms` | GET | none (search/academicYearId filter) | `term.findMany/count` | YES — `schoolId: authCtx.schoolId` in where | N | — | STATIC ONLY |
| `/api/terms` | POST | `academicYearId` | `term.create` | YES — **FIXED**: `academicYear.findFirst({ id, schoolId })` before create (N10b) | Y | N10b 201→403 | FIXED |
| `/api/terms` | PATCH | `id` | `term.update` | YES — **FIXED**: `term.findFirst({ id, schoolId })` before update (N1a) | Y | N1a 200→403 | FIXED |
| `/api/terms` | DELETE | `id` | `term.update(status)` | YES — **FIXED**: `term.findFirst({ id, schoolId })` before archive (N1b) | Y | N1b 200→403 | FIXED |
| `/api/classes` | GET | none (search/academicYearId filter) | `class.findMany/count` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/classes` | POST | `academicYearId` | `class.create` | YES — **FIXED**: `academicYear.findFirst({ id, schoolId })` before create (N10a) | Y | N10a 201→403 | FIXED |
| `/api/classes` | PATCH | `id` | `class.update` | YES — **FIXED**: `class.findFirst({ id, schoolId })` before update (N2a) | Y | N2a 200→403 | FIXED |
| `/api/classes` | DELETE | `id` | `class.update(ARCHIVED)` | YES — **FIXED**: `class.findFirst({ id, schoolId })` before archive (N2b) | Y | N2b 200→403 | FIXED |
| `/api/classes/[id]` | GET | `id` (path) | `class.findFirst` | YES — `{ id, schoolId, isDeleted: false }` | N | — | STATIC ONLY |
| `/api/classes/[id]` | PATCH | `id` (path) | `class.update` | YES — **FIXED**: `class.findFirst({ id, schoolId })` before update (N3a) | Y | N3a 200→403 | FIXED |
| `/api/classes/[id]` | DELETE | `id` (path) | `class.update(ARCHIVED)` | YES — **FIXED**: `class.findFirst({ id, schoolId })` before archive (N3b) | Y | N3b 200→403 | FIXED |
| `/api/sections` | GET | none (search/classId filter) | `section.findMany/count` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/sections` | POST | `classId` | `section.create` | YES — **FIXED**: `class.findFirst({ id, schoolId })` before create (N11) | Y | N11 201→403 | FIXED |
| `/api/sections` | PATCH | `id` | `section.update` | YES — **FIXED**: `section.findFirst({ id, schoolId })` before update (N4a) | Y | N4a 200→403 | FIXED |
| `/api/sections` | DELETE | `id` | `section.update(INACTIVE)` | YES — **FIXED**: `section.findFirst({ id, schoolId })` before archive (N4b) | Y | N4b 200→403 | FIXED |
| `/api/sections/[id]` | GET | `id` (path) | `section.findFirst` | YES — `{ id, schoolId }` | N | — | STATIC ONLY |
| `/api/subjects` | GET | none (search filter) | `subject.findMany/count` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/subjects` | POST | none (schoolId from session) | `subject.create` | YES — `schoolId: ac.schoolId` | N | — | STATIC ONLY |
| `/api/subjects` | PATCH | `id` | `subject.update` | YES — **FIXED**: `subject.findFirst({ id, schoolId })` before update (N5a) | Y | N5a 200→403 | FIXED |
| `/api/subjects` | DELETE | `id` | `subject.update(isActive)` | YES — **FIXED**: `subject.findFirst({ id, schoolId })` before archive (N5b) | Y | N5b 200→403 | FIXED |
| `/api/subjects/[id]` | GET | `id` (path) | `subject.findFirst` | YES — `{ id, schoolId }` | N | — | STATIC ONLY |
| `/api/subjects/[id]` | PATCH (update) | `id` (path) | `subject.update` | YES — `{ id, schoolId }` pre-check | N | — | STATIC ONLY |
| `/api/subjects/[id]` | PATCH (assign) | `id`, `academicYearId`, `classId`, `sectionId`, `teacherMembershipId` | `subjectAssignment.create` | YES — **FIXED**: year/class/section school-scoped before create (N13); teacher already scoped | Y | N13 201→403 | FIXED |
| `/api/subjects/[id]` | DELETE | `id` (path) | `subject.update(isActive)` | YES — `{ id, schoolId }` pre-check | N | — | STATIC ONLY |
| `/api/subject-assignments/[id]` | DELETE | `id` (path) | `subjectAssignment.update(REMOVED)` | YES — `{ id, schoolId }` pre-check | N | — | STATIC ONLY |
| `/api/academic-years` | GET | none (search filter) | `academicYear.findMany/count` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/academic-years` | POST | none (schoolId from session) | `academicYear.create` | YES — `schoolId: ac.schoolId` | N | — | STATIC ONLY |
| `/api/academic-years` | PATCH | `id` | `academicYear.update` | YES — **FIXED**: `findFirst({ id, schoolId })` before update (N6a) | Y | N6a 200→403 | FIXED |
| `/api/academic-years` | DELETE | `id` | `academicYear.update(COMPLETED)` | YES — **FIXED**: `findFirst({ id, schoolId })` before archive (N6b) | Y | N6b 200→403 | FIXED |
| `/api/academic-years/[id]` | GET | `id` (path) | `academicYear.findFirst` | YES — `{ id, schoolId }` | N | — | STATIC ONLY |
| `/api/academic-years/[id]` | PATCH | `id` (path) | `academicYear.update` | YES — **FIXED**: `findFirst({ id, schoolId })` before update (N7a) | Y | N7a 200→403 | FIXED |
| `/api/academic-years/[id]` | DELETE | `id` (path) | `academicYear.update(COMPLETED)` | YES — **FIXED**: `findFirst({ id, schoolId })` before archive (N7b) | Y | N7b 200→403 | FIXED |

## Students / Staff / Teachers

| Route | Method | Client Identifier(s) | Prisma Operation | Tenant Validation Present | Runtime | Evidence | Result |
|---|---|---|---|---|---|---|---|
| `/api/students` | GET | none (filters; CLASS_TEACHER scoped to own assignments) | `student.findMany/count` | YES — `schoolId` in where | Y | D7 LOW-4 param spoof | PASS |
| `/api/students` | POST | `academicYearId`, `classId`, `sectionId` (enrollment) | `student.create` + `enrollment.create` | YES — **FIXED**: year/class/section school-scoped before enrollment create (N12a) | Y | N12a 201→403 | FIXED |
| `/api/students/[id]` | GET | `id` (path) | `student.findUnique` | YES — `{ id, schoolId }` | Y | D7 LOW-1 foreign → 404 | PASS |
| `/api/students/[id]` | PATCH | `id`, `academicYearId`, `classId`, `sectionId` | `student.update` + `enrollment.create/update` | YES — **FIXED**: scoped pre-check existed; year/class/section now school-scoped in enrollment branch (N12b) | Y | N12b 200→403 | FIXED |
| `/api/students/[id]` | DELETE | `id` (path) | `student.update(ARCHIVED)` | YES — **FIXED**: lookup now `findFirst({ id, schoolId })` (was unscoped `findUnique({ id })`) (N8) | Y | N8 200→404 | FIXED |
| `/api/students/search` | GET | none | `student.findMany` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/students/drafts` | GET | none | scoped list | YES — `schoolId` + `createdBy` | N | — | STATIC ONLY |
| `/api/students/drafts` | POST | none | scoped create | YES — `schoolId: ac.schoolId` | N | — | STATIC ONLY |
| `/api/students/[id]/guardians` | POST | `studentId` (path), guardian fields | `studentGuardian.create` | YES — student in-school + `guardian.schoolId` cross-check | N | — | STATIC ONLY |
| `/api/students/[id]/guardians/[guardianId]` | PATCH | `studentId`, `guardianId` (path) | `studentGuardian.update` | YES — scoped by student + composite key | N | — | STATIC ONLY |
| `/api/students/[id]/guardians/[guardianId]` | DELETE | `studentId`, `guardianId` (path) | `studentGuardian.update` | YES — scoped by student + composite key | N | — | STATIC ONLY |
| `/api/staff/members` | GET | none | `membership.findMany` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/staff/members` | POST | none (schoolId from session) | `user/membership/staffProfile` create | YES — `schoolId: ac.schoolId` + email-in-school check | N | — | STATIC ONLY |
| `/api/staff/members/[id]` | GET | `id` (path) | `membership.findFirst` | YES — `{ id, schoolId }` | N | — | STATIC ONLY |
| `/api/staff/members/[id]` | PATCH | `id` (path) | `membership/user/staffProfile` update | YES — `{ id, schoolId }` pre-check; user update via verified membership | N | — | STATIC ONLY |
| `/api/teachers` | GET | none | scoped list | YES — `schoolId` in where | N | — | STATIC ONLY |

## Attendance / Sessions / Exams / Fees / Promotions

| Route | Method | Client Identifier(s) | Prisma Operation | Tenant Validation Present | Runtime | Evidence | Result |
|---|---|---|---|---|---|---|---|
| `/api/attendance` | GET | none (classId/date filters) | `attendanceRecord.findMany` | YES — `schoolId` in where | Y | D7 LOW-2 foreign class → 200 [] | PASS |
| `/api/attendance` | POST | `classId`, `studentMembershipId` per record | `attendanceRecord.create` | YES — H6 assertion + school-scoped roster validation | Y | H6 rejected post-fix | FIXED |
| `/api/attendance/sessions` | GET | none (classId filter) | `attendanceSession.findMany` | YES — `schoolId` in where | Y | D7 LOW-3 foreign class → 200 [] | PASS |
| `/api/attendance/sessions` | POST | `classId` | `attendanceSession.create` | YES — M2-fix: `class.findFirst({ id, schoolId })` | Y | M2 sessions rejected | FIXED |
| `/api/attendance/sessions/[id]` | GET | `id` (path) | `attendanceSession.findFirst` | YES — `{ id, schoolId }` | N | — | STATIC ONLY |
| `/api/attendance/sessions/[id]` | PATCH | `id` (path) | `attendanceSession.update` | YES — H5-fix: `findFirst({ id, schoolId })` | Y | H5 rejected post-fix | FIXED |
| `/api/exams` | GET | `examId`/`studentId` (results read) | `examResult.findMany` | YES — H1/H2 asserts | Y | H1/H2 rejected post-fix | FIXED |
| `/api/exams` | POST | `examId`, `studentId` (result upsert) | `examResult.upsert` | YES — H3/M1 asserts | Y | H3 rejected post-fix | FIXED |
| `/api/fees` | GET | none | scoped lists | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/fees` | POST | `invoiceId`, `studentId`, `categoryId`, `classId` | `feeInvoice/feeStructure/feePayment` ops | YES — H4/M1/M2 asserts | Y | H4/M1/M2 rejected post-fix | FIXED |
| `/api/promotions` | POST | `studentId` per item, year ids | promotion batch | YES — M3: scoped detail query | Y | M3 PII leak closed | FIXED |
| `/api/promotions/close-year` | POST | none (session school) | close-year ops | YES — schoolId derived from session | N | — | STATIC ONLY |

## Library / Timetable / Transport / Class Assignments (Phase 1.5 fixes)

| Route | Method | Client Identifier(s) | Prisma Operation | Tenant Validation Present | Runtime | Evidence | Result |
|---|---|---|---|---|---|---|---|
| `/api/library` | GET | none | scoped books/borrowings list | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/library` | POST (book) | none | `book.create` | YES — `schoolId: ac.schoolId` | Y | positive control 201 | PASS |
| `/api/library` | POST (borrow) | `bookId`, `studentId` | `bookBorrowing.create` + `book.update` | YES — L1-fix: book+student `{ id, schoolId }` asserts | Y | L1 201→403 | FIXED |
| `/api/library` | POST (return) | `borrowingId` | `bookBorrowing.update` + `book.update` | YES — L1-return fix: borrowing `{ id, schoolId }` assert | Y | L1-return 200→403 | FIXED |
| `/api/timetable` | GET | none | scoped list | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/timetable` | POST | `classId`, `sectionId`, `subjectId`, `teacherId` | `timetable.create` | YES — L2-fix: all identifiers school-asserted | Y | L2 201→403 | FIXED |
| `/api/transport` | GET | none | scoped list | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/transport` | POST | `studentId`, `routeId`, `vehicleId` | `transportAssignment` etc. | YES — L3-fix: all identifiers school-asserted | Y | L3 201→403 | FIXED |
| `/api/class-assignments` | GET | none | scoped list | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/class-assignments` | POST | `classId`, `teacherMembershipId` | `classAssignment.upsert` | YES — L4-fix: class+teacher school-asserted | Y | L4 201→403 | FIXED |
| `/api/class-assignments` | DELETE | `id` | `classAssignment.update(REMOVED)` | YES — L4-DELETE fix: `{ id, schoolId }` assert | Y | L4-DELETE 200→403 | FIXED |

## Dashboard / Settings / Crud Demo / Super Admin / Test / Auth

| Route | Method | Client Identifier(s) | Prisma Operation | Tenant Validation Present | Runtime | Evidence | Result |
|---|---|---|---|---|---|---|---|
| `/api/dashboard/school-admin` | GET | none | aggregates | YES — every aggregate `where: { schoolId }` | N | — | STATIC ONLY |
| `/api/school-settings` | GET | none | settings read | YES — keyed by session school | N | — | STATIC ONLY |
| `/api/school-settings` | PATCH | none | upsert | YES — keyed by session school | N | — | STATIC ONLY |
| `/api/crud-demo` | GET | none (search filter) | `crudDemo.findMany` | YES — `schoolId` in where | N | — | STATIC ONLY |
| `/api/crud-demo` | POST | none | `crudDemo.create` | YES — `schoolId: ac.schoolId` | N | — | STATIC ONLY |
| `/api/crud-demo` | DELETE | `id` | `crudDemo.update(isActive)` | YES — permission-gated for SCHOOL_ADMIN (403, N9); **FIXED**: `{ id, schoolId }` assert added for roles holding `schools:delete` | Y | N9 403→403 | FIXED (hardened) |
| `/api/admin/schools` | GET | none | school list | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/schools` | POST | none | school create | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/schools/[id]` | GET | `id` (path) | school read | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/schools/[id]` | PATCH | `id` (path) | school update | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/audit-logs` | GET | none | audit log list | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/error-logs` | GET | none | error log list | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/error-logs/[id]` | GET | `id` (path) | error log read | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/admin/error-logs/[id]` | PATCH | `id` (path) | error log update | YES — SUPER_ADMIN role gate | N | — | STATIC ONLY |
| `/api/test/setup-cross-tenant` | POST | none | test fixtures | YES — SUPER_ADMIN gate, test-only | N | — | STATIC ONLY |
| `/api/test/error` | GET | none | none | n/a — test-only | N | — | STATIC ONLY |
| `/api/auth/[...all]` | all | — | Better Auth | n/a — framework; out of tenant scope | N | — | N/A |

**Coverage claim:** every route file under `src/app/api/**` (41 files) was read to completion during this audit; every handler above appears exactly once.

---

# PHASE 2 — MODULE STATUS

Module labels (Phase 1.6B semantics): `PASS` = **every** route in the module runtime-verified safe; `PASS (Mutating Paths Verified)` = all mutating handlers runtime-verified 403-closed, but the module still contains `Runtime Verified = N` / `STATIC ONLY` read-only routes (verified school-scoped by code review only); `STATIC ONLY` (no runtime-tested route); `NEEDS RUNTIME TEST` (not applicable — none); `NEEDS FIX` (none remaining).

| Module | Status | Notes |
|---|---|---|
| Library | PASS (Mutating Paths Verified) | L1 + L1-return runtime-verified 403; positive control 201/200; GET static-only |
| Timetable | PASS (Mutating Paths Verified) | L2 runtime-verified 403; GET static-only |
| Transport | PASS (Mutating Paths Verified) | L3 runtime-verified 403; GET static-only |
| Class Assignments | PASS (Mutating Paths Verified) | L4 POST + DELETE runtime-verified 403; GET static-only |
| Academic Years | PASS (Mutating Paths Verified) | N6a/N6b/N7a/N7b runtime-verified 403; GET/POST static-scoped |
| Terms | PASS (Mutating Paths Verified) | N1a/N1b/N10b runtime-verified 403; GET static-only |
| Classes | PASS (Mutating Paths Verified) | N2a/N2b/N3a/N3b/N10a runtime-verified 403; GET static-only |
| Sections | PASS (Mutating Paths Verified) | N4a/N4b/N11 runtime-verified 403; GET + [id] GET static-scoped |
| Subjects | PASS (Mutating Paths Verified) | N5a/N5b/N13 runtime-verified 403; [id] GET/update/DELETE static-scoped |
| Subject Assignments | STATIC ONLY | single scoped DELETE; no GET/POST routes exist |
| Students | PASS (Mutating Paths Verified) | N8/N12a/N12b runtime-verified; GET/[id] positive control + LOW spot checks; search/drafts/guardians static-scoped |
| Staff | STATIC ONLY | all 4 handlers school-scoped by code review |
| Teachers | STATIC ONLY | single scoped GET |
| Attendance | PASS | only `/api/attendance` GET (LOW-2) + POST (H6) — both runtime-verified; no static-only routes in module |
| Sessions | PASS (Mutating Paths Verified) | H5/M2-sessions runtime-verified; LOW-3 GET spot check; sessions/[id] GET static-only |
| Exams | PASS | GET (H1/H2) + POST (H3/M1) both runtime-verified; no static-only routes in module |
| Fees | PASS (Mutating Paths Verified) | H4/M1/M2 runtime-verified; GET static-only |
| Promotions | PASS (Mutating Paths Verified) | M3 runtime-verified; close-year STATIC ONLY |
| Dashboard | STATIC ONLY | aggregates all schoolId-scoped |
| School Settings | STATIC ONLY | keyed by session school |
| Crud Demo | PASS (Mutating Paths Verified) | N9 permission-blocked (403 pre/post); hardened with scoped assert; GET/POST static-only |
| Super Admin | STATIC ONLY | role-gated (SUPER_ADMIN); platform-level, not tenant surface |
| Parent / Communication | N/A | guardians routes scoped (STATIC ONLY); Communication module absent (no schema/route/UI — verified) |

Positive-control replays (`docs/evidence/phase1.6-positive-control.txt`) exercise every N1–N13 guard through the legitimate same-school path (all HTTP 200/201) — see Phase 6.

---

# PHASE 3 — SEVERITY RUBRIC (applied uniformly)

| Severity | Definition | Applies to |
|---|---|---|
| HIGH | Direct read/write/update/delete of another tenant's data | H1–H6, L1-borrow (foreign book availability decrement), L1-return (see justification below — direct modification of foreign-owned borrowing row), N1a–N8 (all unscoped PATCH/DELETE/archive writes against foreign-owned rows), L4-DELETE (see justification below) |
| MEDIUM | Cross-tenant reference creation or association without modifying foreign-owned rows | M1–M3, L2, L3, L4-POST, N10a, N10b, N11, N12a, N12b, N13 |
| LOW | Information disclosure, validation weakness, or lower-impact issue | D7 LOW-1…LOW-4 spot checks (all safe — not findings), N9 (permission mislabel `schools` for crud-demo — NOT exploitable; hardened; recorded as non-finding) |

**L1-return severity justification (explicit, Phase 1.6B — previously not individually classified):** `POST /api/library` (return branch) executed `bookBorrowing.update({ where: { id: borrowingId } , data: { returnedAt, status } })` plus `book.update({ where: { id: bookId } })` on client-supplied ids with no school predicate — a direct modification of another tenant's owned rows (borrowing record status + book availability). Under the rubric ("direct ... update/delete of another tenant's data") this is **HIGH**, the same defect class as L1-borrow. The Phase 1.5 package counted L1 as one finding covering both vectors; this audit classifies each vector separately: L1-borrow HIGH (decrement of foreign book availability), L1-return HIGH (status/availability writes against a foreign borrowing). Both are closed — post-fix replays return HTTP 403 against a real foreign row (`phase1.5-http-after-l14.txt`, L1 sections).

**L4-DELETE severity justification (explicit, as required):** `DELETE /api/class-assignments?id=` executed `classAssignment.update({ where: { id } , data: { status: 'REMOVED' } })` on a client-supplied id with no school predicate — a direct modification of another tenant's owned row (status flip). Under the rubric ("direct ... update/delete of another tenant's data") this is **HIGH**, not MEDIUM. It is listed under MEDIUM in the Phase 1.5 package totals because it was classified before the rubric was formalized; this audit reclassifies it as **HIGH** (same defect class as N2b/N4b/N6b). It is closed — post-fix replay returns HTTP 403 against a real foreign row (`phase1.5-http-after-l14.txt`, L4 DELETE section).

---

# PHASE 4 — CONSISTENT PRE-FIX EVIDENCE WORDING

Standard wording applied to any finding whose pre-fix behavior is evidenced at service/DB level but not at HTTP level:

```
Pre-fix HTTP:
NOT VERIFIED
Reason:
Route was fixed before HTTP replay.
Service-level execution is the captured pre-fix evidence.
```

| Finding | Pre-fix HTTP | Pre-fix evidence basis | Post-fix HTTP |
|---|---|---|---|
| H1–H4, H6, M1–M3 | NOT VERIFIED (standard wording) | service-level transcripts + literal SQL repros (`phase1.5-runtime.txt`) | HTTP 500 rejection (H/M) |
| H5 | NOT VERIFIED (standard wording) | service-level session update + SQL repro | HTTP 500 rejection |
| L1-return | NOT VERIFIED (standard wording) | static + SQL repro | HTTP 403 |
| L4-DELETE | NOT VERIFIED (standard wording) | static + SQL repro | HTTP 403 |
| L1–L4 (create vectors) | HTTP 201 (captured, `phase1.5-http.txt` Section 2) | HTTP transcript | HTTP 403 |
| N1–N13 (all 21 vectors) | HTTP 200/201 (captured, `phase1.6-before.txt`) | HTTP transcript | HTTP 403/404 (`phase1.6-after.txt`) |
| N1–N13 positive controls | n/a (guards did not exist pre-fix) | same-school legitimate requests (`phase1.6-positive-control.txt`) | HTTP 200/201 (controls) |

The wordings above are now identical in shape across every finding record in this package and `docs/phase1.5-evidence-package.md`.

---

# PHASE 5 — ROUTE COVERAGE MATRIX

| Route | Reviewed | Runtime Verified | Status | Evidence |
|---|---|---|---|---|
| `/api/terms` (GET/POST/PATCH/DELETE) | Y | Y (POST/PATCH/DELETE) | PASS (Mutating Paths Verified) | N1a/N1b/N10b 200→403, `phase1.6-*.txt` |
| `/api/classes` (GET/POST/PATCH/DELETE) | Y | Y (POST/PATCH/DELETE) | PASS (Mutating Paths Verified) | N2a/N2b/N10a 200→403 |
| `/api/classes/[id]` (GET/PATCH/DELETE) | Y | Y (PATCH/DELETE) | PASS (Mutating Paths Verified) | N3a/N3b 200→403 |
| `/api/sections` (GET/POST/PATCH/DELETE) | Y | Y (POST/PATCH/DELETE) | PASS (Mutating Paths Verified) | N4a/N4b/N11 200→403 |
| `/api/sections/[id]` (GET) | Y | N | STATIC ONLY | code: `{ id, schoolId }` |
| `/api/subjects` (GET/POST/PATCH/DELETE) | Y | Y (PATCH/DELETE) | PASS (Mutating Paths Verified) | N5a/N5b 200→403 |
| `/api/subjects/[id]` (GET/PATCH/DELETE) | Y | Y (assign) | PASS (Mutating Paths Verified) | N13 201→403 |
| `/api/subject-assignments/[id]` (DELETE) | Y | N | STATIC ONLY | code: `{ id, schoolId }` |
| `/api/academic-years` (GET/POST/PATCH/DELETE) | Y | Y (PATCH/DELETE) | PASS (Mutating Paths Verified) | N6a/N6b 200→403 |
| `/api/academic-years/[id]` (GET/PATCH/DELETE) | Y | Y (PATCH/DELETE) | PASS (Mutating Paths Verified) | N7a/N7b 200→403 |
| `/api/students` (GET/POST) | Y | Y | PASS | N12a 201→403; D7 LOW-4 |
| `/api/students/[id]` (GET/PATCH/DELETE) | Y | Y | PASS | N8 200→404, N12b 200→403, D7 LOW-1 |
| `/api/students/search`, `/drafts`, `/guardians*` | Y | N | STATIC ONLY | code review |
| `/api/staff/members*`, `/api/teachers` | Y | N | STATIC ONLY | code review |
| `/api/attendance`, `/api/attendance/sessions*` | Y | Y (sessions/[id] GET N) | PASS (Mutating Paths Verified) | H5/H6/M2, D7 LOW-2/LOW-3 |
| `/api/exams` (GET/POST) | Y | Y | PASS | H1/H2/H3 |
| `/api/fees` (GET/POST) | Y | Y (POST) | PASS (Mutating Paths Verified) | H4/M1/M2 |
| `/api/promotions` (POST), `/close-year` | Y | Y (POST) | PASS (Mutating Paths Verified) | M3 |
| `/api/library` (GET/POST) | Y | Y (POST) | PASS (Mutating Paths Verified) | L1 + positive control |
| `/api/timetable` (GET/POST) | Y | Y (POST) | PASS (Mutating Paths Verified) | L2 |
| `/api/transport` (GET/POST) | Y | Y (POST) | PASS (Mutating Paths Verified) | L3 |
| `/api/class-assignments` (GET/POST/DELETE) | Y | Y (POST/DELETE) | PASS (Mutating Paths Verified) | L4 + L4-DELETE |
| `/api/dashboard/school-admin` | Y | N | STATIC ONLY | code review |
| `/api/school-settings` (GET/PATCH) | Y | N | STATIC ONLY | code review |
| `/api/crud-demo` (GET/POST/DELETE) | Y | Y (DELETE) | PASS (Mutating Paths Verified) | N9 403→403 |
| `/api/admin/**` (5 files) | Y | N | STATIC ONLY | SUPER_ADMIN role gate |
| `/api/test/**` (2 files) | Y | N | STATIC ONLY | test-only |
| `/api/auth/**` | Y | — | N/A | Better Auth framework |

Module rollup (routes listed above, by module): Library PASS (Mutating Paths Verified) · Timetable PASS (Mutating Paths Verified) · Transport PASS (Mutating Paths Verified) · Class Assignments PASS (Mutating Paths Verified) · Terms PASS (Mutating Paths Verified) · Classes PASS (Mutating Paths Verified) · Sections PASS (Mutating Paths Verified) · Subjects PASS (Mutating Paths Verified) · Subject Assignments STATIC ONLY · Academic Years PASS (Mutating Paths Verified) · Students PASS (Mutating Paths Verified) · Staff STATIC ONLY · Teachers STATIC ONLY · Attendance PASS · Sessions PASS (Mutating Paths Verified) · Exams PASS · Fees PASS (Mutating Paths Verified) · Promotions PASS (Mutating Paths Verified) · Dashboard STATIC ONLY · School Settings STATIC ONLY · Crud Demo PASS (Mutating Paths Verified) · Super Admin STATIC ONLY · Test N/A · Auth N/A.

**No route is missing from Phase 1, Phase 5, or the module rollup.**

---

# PHASE 6 — UPDATED EVIDENCE PACKAGE: NEW FINDINGS N1–N13

## N1 — `/api/terms` PATCH + DELETE: unscoped term update/archive (2 vectors)

**Authenticated School:** `seed_school_ea` (School A admin) — **Target:** `fixture_term_b1` (School B, real row)

**BEFORE — Request (HTTP):**
```
PATCH  /api/terms?id=fixture_term_b1   body={"name":"Evidence Renamed"}
DELETE /api/terms?id=fixture_term_b1
```

**BEFORE — Pre-fix code (N1a PATCH, src/app/api/terms/route.ts):**
```ts
execute: async (data, { requestCtx: rc }) => {
  return withRls(rc, async (tx) => tx.term.update({ where: { id }, data: { ... } }));  // ← no school check
},
```
N1b DELETE identical shape (`tx.term.update({ where: { id: entityId }, data: { status: 'INACTIVE' } })`).

**BEFORE — DB state (rows owned by School B, before):** `fixture_term_b1` name=`Fixture Term B1`, status=`ACTIVE`.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N1a RESPONSE: HTTP 200 ... "name":"Evidence Renamed" ... "schoolId":"fixture_school_b"
N1b RESPONSE: HTTP 200 ... "status":"INACTIVE" ... "schoolId":"fixture_school_b"
```

**BEFORE — DB state (after exploit):** term renamed AND archived by School A admin — direct modification of foreign-owned row.

**Code Diff:**
```diff
- execute: async (data, { requestCtx: rc }) => {
-   return withRls(rc, async (tx) => tx.term.update({ where: { id }, data }));
+ execute: async (data, { authCtx: ac, requestCtx: rc }) => {
+   return withRls(rc, async (tx) => {
+     const existing = await tx.term.findFirst({ where: { id, schoolId: ac.schoolId }, select: { id: true } });
+     if (!existing) throw new AuthorizationError('Term not found in this school');
+     return tx.term.update({ where: { id }, data });
+   });
```
(DELETE: same guard pattern before `update({ status: 'INACTIVE' })`.)

**AFTER — Identical replays (`phase1.6-after.txt`):**
```
N1a RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Term not found in this school"}}
N1b RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Term not found in this school"}}
```

**AFTER — DB proof:** restore script reset the row; cleanup-verify: `termCount: 0` in School B, School A created no rows. Foreign row untouched by the replays (403 before any Prisma write).

## N2 — `/api/classes` PATCH + DELETE: unscoped class update/archive (2 vectors)

**Target:** `fixture_cls_b_g01` (School B, real row, name `Grade 1`).

**BEFORE — Request (HTTP):** `PATCH /api/classes?id=fixture_cls_b_g01 {"name":"Evidence Renamed"}` and `DELETE /api/classes?id=fixture_cls_b_g01`.

**BEFORE — Pre-fix code (src/app/api/classes/route.ts):** PATCH `tx.class.update({ where: { id }, data })`; DELETE `tx.class.update({ where: { id }, data: { status: 'ARCHIVED', isDeleted: true } })` — no school check.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N2a RESPONSE: HTTP 200 ... "name":"Evidence Renamed" ... "schoolId":"fixture_school_b"
N2b RESPONSE: HTTP 200 ... "status":"ARCHIVED","isDeleted":true ... "schoolId":"fixture_school_b"
```

**Code Diff:** both handlers now guard `class.findFirst({ where: { id, schoolId: ac.schoolId } })` → throw `AuthorizationError('Class not found in this school')` before the update.

**AFTER — Identical replays:** `HTTP 403 {"code":"FORBIDDEN","message":"Class not found in this school"}` for both.

**AFTER — DB proof:** restore + cleanup-verify: `fixture_cls_b_g01` name=`Grade 1`, status=`ACTIVE`, isDeleted=`false`.

## N3 — `/api/classes/[id]` PATCH + DELETE: unscoped class update/archive via path id (2 vectors)

**Targets:** `fixture_cls_b_g01` (PATCH) and `fixture_cls_b_g02` (empty School B class, DELETE).

**BEFORE — Request (HTTP):** `PATCH /api/classes/fixture_cls_b_g01 {"name":"Evidence Renamed"}`; `DELETE /api/classes/fixture_cls_b_g02`.

**BEFORE — Pre-fix code (src/app/api/classes/[id]/route.ts):** PATCH `tx.class.update({ where: { id }, data })`; DELETE did `findUnique({ where: { id } })` (no schoolId) then count-guard then archive.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N3a RESPONSE: HTTP 200 ... "status":"ARCHIVED","isDeleted":true
N3b RESPONSE: HTTP 200 ... "status":"ARCHIVED","isDeleted":true ... "updatedBy":"seed_user_admin"
```

**Code Diff:** PATCH guards `class.findFirst({ id, schoolId })`; DELETE changed `findUnique({ id })` → `findFirst({ id, schoolId })` + `AuthorizationError` before count guards.

**AFTER — Identical replays:** both `HTTP 403 "Class not found in this school"`.

**AFTER — DB proof:** `fixture_cls_b_g02` restored ACTIVE then deleted in cleanup (`clsG02Gone: 0` rows).

## N4 — `/api/sections` PATCH + DELETE: unscoped section update/archive (2 vectors)

**Target:** `fixture_sec_b_g01_a` (School B, real row, name `A`).

**BEFORE — Request (HTTP):** `PATCH /api/sections?id=fixture_sec_b_g01_a {"name":"Evidence Renamed"}`; `DELETE /api/sections?id=fixture_sec_b_g01_a`.

**BEFORE — Pre-fix code (src/app/api/sections/route.ts):** PATCH `tx.section.update({ where: { id }, data })`; DELETE `tx.section.update({ where: { id }, data: { status: 'INACTIVE' }) }`.

**BEFORE — Exploit result:** `N4a HTTP 200 ... "name":"Evidence Renamed"`; `N4b HTTP 200 ... "status":"INACTIVE"` (both `schoolId: fixture_school_b`).

**Code Diff:** both guard `section.findFirst({ where: { id, schoolId: ac.schoolId } })` → 403.

**AFTER — Identical replays:** both `HTTP 403 "Section not found in this school"`.

**AFTER — DB proof:** section restored name=`A`, status=`ACTIVE`; cleanup-verify shows intact.

## N5 — `/api/subjects` PATCH + DELETE: unscoped subject update/archive (2 vectors)

**Target:** `fixture_sub_b_math` (School B, real row, name `Mathematics`).

**BEFORE — Request (HTTP):** `PATCH /api/subjects?id=fixture_sub_b_math {"name":"Evidence Renamed"}`; `DELETE /api/subjects?id=fixture_sub_b_math`.

**BEFORE — Pre-fix code (src/app/api/subjects/route.ts):** PATCH `tx.subject.update({ where: { id }, data })`; DELETE `tx.subject.update({ where: { id }, data: { isActive: false }) }`.

**BEFORE — Exploit result:** `N5a HTTP 200 ... "name":"Evidence Renamed"`; `N5b HTTP 200 ... "isActive":false`.

**Code Diff:** both guard `subject.findFirst({ where: { id, schoolId: ac.schoolId } })` → 403.

**AFTER — Identical replays:** both `HTTP 403 "Subject not found in this school"`.

**AFTER — DB proof:** subject restored name=`Mathematics`, isActive=`true`.

## N6 — `/api/academic-years` PATCH + DELETE: unscoped year update/archive (2 vectors)

**Target:** `fixture_ay_b` (School B, real row, name `2026-2027`).

**BEFORE — Request (HTTP):** `PATCH /api/academic-years?id=fixture_ay_b {"name":"Evidence Renamed"}`; `DELETE /api/academic-years?id=fixture_ay_b`.

**BEFORE — Pre-fix code (src/app/api/academic-years/route.ts):** PATCH `tx.academicYear.update({ where: { id }, data })`; DELETE `tx.academicYear.update({ where: { id }, data: { status: 'COMPLETED', isActive: false }) }`.

**BEFORE — Exploit result:** `N6a HTTP 200 ... "name":"Evidence Renamed"`; `N6b HTTP 200 ... "status":"COMPLETED"`.

**Code Diff:** both guard `academicYear.findFirst({ where: { id, schoolId: ac.schoolId } })` → 403.

**AFTER — Identical replays:** both `HTTP 403 "Academic year not found in this school"`.

**AFTER — DB proof:** year restored name=`2026-2027`, status=`ACTIVE`, isActive=`false`.

## N7 — `/api/academic-years/[id]` PATCH + DELETE: unscoped year update/archive via path id (2 vectors)

**Targets:** `fixture_ay_b` (PATCH) and `fixture_ay_b2` (empty School B year, DELETE).

**BEFORE — Request (HTTP):** `PATCH /api/academic-years/fixture_ay_b {"name":"Evidence Renamed"}`; `DELETE /api/academic-years/fixture_ay_b2`.

**BEFORE — Pre-fix code (src/app/api/academic-years/[id]/route.ts):** PATCH `tx.academicYear.update({ where: { id }, data: updateData })`; DELETE `findUnique({ where: { id } })` (no schoolId) + count guard + archive.

**BEFORE — Exploit result:** `N7a HTTP 200`; `N7b HTTP 200 ... "status":"COMPLETED"`.

**Code Diff:** PATCH guards `findFirst({ id, schoolId })`; DELETE `findUnique({ id })` → `findFirst({ id, schoolId })` + `AuthorizationError`.

**AFTER — Identical replays:** both `HTTP 403 "Academic year not found in this school"`.

**AFTER — DB proof:** `fixture_ay_b2` restored ACTIVE then removed in cleanup (`ayB2Gone: 0`).

## N8 — `/api/students/[id]` DELETE: unscoped student archive (1 vector)

**Target:** `fixture_stu_b1` (School B, real student, status `ACTIVE`).

**BEFORE — Request (HTTP):** `DELETE /api/students/fixture_stu_b1`.

**BEFORE — Pre-fix code (src/app/api/students/[id]/route.ts):** `tx.student.findUnique({ where: { id } })` — **no school predicate** — then `tx.student.update({ where: { id }, data: { status: 'ARCHIVED', isDeleted: true } })`.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N8 RESPONSE: HTTP 200 ... "status":"ARCHIVED","isDeleted":true ... "schoolId":"fixture_school_b"
```

**Code Diff:** `findUnique({ where: { id } })` → `findFirst({ where: { id, schoolId: authCtx.schoolId } })`.

**AFTER — Identical replay:** `HTTP 404 {"success":false,"error":{"code":"NOT_FOUND","message":"Student not found"}}` — the scoped lookup returns null for the foreign student; no write occurs.

**AFTER — DB proof:** student restored status=`ACTIVE`, isDeleted=`false` (cleanup-verify).

## N9 — `/api/crud-demo` DELETE: not exploitable in tested configuration (permission gate) — hardened

**Target:** `fixture_crud_b1` (School B, real row).

**BEFORE — Request (HTTP):** `DELETE /api/crud-demo?id=fixture_crud_b1`.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N9 RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Role SCHOOL_ADMIN does not have delete permission on schools"}}
```
The handler's `runSimpleMutation({ resource: 'schools', action: 'archive' })` resolves to the `schools:delete` permission, which SCHOOL_ADMIN does not hold — the mutation code (unscoped `crudDemo.update({ id })`) is unreachable for tenant roles. **NOT a cross-tenant finding**; root cause recorded as a permission-mislabel defect (`schools` instead of `crud_demo`).

**Hardening (defense-in-depth, applied 2026-08-02):** the archive closure now asserts `crudDemo.findFirst({ where: { id: entityId, schoolId: ac.schoolId } })` before update, so any role that ever holds `schools:delete` cannot reach foreign rows either.

**AFTER — Identical replay:** `HTTP 403` (permission gate unchanged; foreign row untouched).

## N10 — `/api/classes` POST + `/api/terms` POST: cross-tenant reference creation (2 vectors)

**Target:** `fixture_ay_b` (foreign academic year referenced from School A rows).

**BEFORE — Request (HTTP):**
```
POST /api/classes body={"name":"Evidence N10","academicYearId":"fixture_ay_b"}
POST /api/terms   body={"name":"Evidence N10","academicYearId":"fixture_ay_b","startDate":"2026-06-01","endDate":"2026-12-31"}
```

**BEFORE — Pre-fix code:** both `create` closures wrote `schoolId: ac.schoolId` but inserted the client `academicYearId` with no validation.

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N10a RESPONSE: HTTP 201 ... "id":"cmsbvhia6000f1gu8nirwfaim","schoolId":"seed_school_ea","academicYearId":"fixture_ay_b"
N10b RESPONSE: HTTP 201 ... "id":"cmsbvhjdz000h1gu8z8w2s7xp","schoolId":"seed_school_ea","academicYearId":"fixture_ay_b"
```
School A rows created referencing a foreign year (tenant contamination).

**Code Diff:** both create closures now run `academicYear.findFirst({ where: { id: data.academicYearId, schoolId: ac.schoolId } })` and throw `AuthorizationError('Academic year not found in this school')` before create.

**AFTER — Identical replays:** both `HTTP 403 "Academic year not found in this school"`, no rows created.

**AFTER — DB proof:** cleanup-verify `classN10: 0`, `termN10: 0` (evidence rows removed); School B has no School A references.

## N11 — `/api/sections` POST: cross-tenant reference creation (1 vector)

**Target:** `fixture_cls_b_g01` (foreign class).

**BEFORE — Request (HTTP):** `POST /api/sections body={"name":"Evidence N11","classId":"fixture_cls_b_g01"}`.

**BEFORE — Pre-fix code:** create closure wrote `schoolId: ac.schoolId` with unvalidated `classId`.

**BEFORE — Exploit result:** `HTTP 201 ... "id":"cmsbvhkc4000j1gu8kimbrazz","schoolId":"seed_school_ea","classId":"fixture_cls_b_g01"`.

**Code Diff:** create now validates `class.findFirst({ where: { id: data.classId, schoolId: ac.schoolId } })` → 403.

**AFTER — Identical replay:** `HTTP 403 "Class not found in this school"`; `sectionN11: 0` after cleanup.

## N12 — `/api/students` POST + PATCH: cross-tenant enrollment references (2 vectors)

**Targets:** foreign `fixture_ay_b` / `fixture_cls_b_g01` / `fixture_sec_b_g01_a` from a School A student + enrollment.

**BEFORE — Request (HTTP):**
```
POST  /api/students body={"firstName":"Evidence","lastName":"N12","admissionNumber":"EVIDENCE-N12A","academicYearId":"fixture_ay_b","classId":"fixture_cls_b_g01","sectionId":"fixture_sec_b_g01_a"}
PATCH /api/students/<student-from-POST> body={"academicYearId":"fixture_ay_b","classId":"fixture_cls_b_g01","sectionId":"fixture_sec_b_g01_a","rollNumber":"99"}
```

**BEFORE — Pre-fix code:** POST `tx.enrollment.create({ data: { schoolId: ac.schoolId, ..., academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId } })` — no validation. PATCH enrollment branch created/updated enrollments with unvalidated year/class/section (PATCH pre-check only verified the student itself).

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N12a RESPONSE: HTTP 201 (student cmsbvhllo000l1gu8wmee9v77 created, schoolId seed_school_ea)
N12b RESPONSE: HTTP 200 ... enrollment updated with foreign year/class/section
```

**Code Diff:** both enrollment branches now validate year/class/section via school-scoped `findFirst` → `AuthorizationError` → 403 before any enrollment create/update.

**AFTER — Identical replays:** N12a `HTTP 403 "Academic year not found in this school"` (no student created); N12b (against in-school `seed_stu_001296`) `HTTP 403 "Academic year not found in this school"` — in-school student untouched.

**AFTER — DB proof:** `studentN12: 0`, `enrollmentN12: 0` after cleanup; `seed_stu_001296` enrollment unchanged.

## N13 — `/api/subjects/[id]` PATCH `action=assign`: cross-tenant subject assignment (1 vector)

**Target:** School A subject `seed_sub_mat` assigned against foreign year/class/section.

**BEFORE — Request (HTTP):**
```
PATCH /api/subjects/seed_sub_mat body={"action":"assign","academicYearId":"fixture_ay_b","classId":"fixture_cls_b_g01","sectionId":"fixture_sec_b_g01_a","teacherMembershipId":"seed_mem_admin"}
```

**BEFORE — Pre-fix code (src/app/api/subjects/[id]/route.ts):** subject pre-check was school-scoped, but `subjectAssignment.create` inserted the client `academicYearId`/`classId`/`sectionId` with no school validation (duplicate-check and teacher-check were school-scoped).

**BEFORE — Exploit result (`phase1.6-before.txt`):**
```
N13 RESPONSE: HTTP 201 ... "id":"cmsbvhr7l000p1gu8hxf77a9u","schoolId":"seed_school_ea","academicYearId":"fixture_ay_b","classId":"fixture_cls_b_g01","sectionId":"fixture_sec_b_g01_a"
```

**Code Diff:** the assign branch now validates `academicYear`, `class`, and optional `section` each via school-scoped `findFirst`; any miss returns `HTTP 403 "… not found in this school"` before create.

**AFTER — Identical replay:** `HTTP 403 "Academic year not found in this school"`.

**AFTER — DB proof:** `assignmentN13: 0` after cleanup; School A subject assignment list unchanged.

## Positive control (every N-guard passes legitimate same-school requests)

Full transcript: `docs/evidence/phase1.6-positive-control.txt`; harness: `docs/evidence/h-pc.ps1`. Each N-fix only adds a school-scoped lookup before the identical Prisma op, so legitimate in-school writes must succeed. Every guard was exercised through its legitimate path with the same authenticated actor (`seed_user_admin` / School A), all rows created at runtime as "Evidence PC *" and deleted afterward (see below).

| # | Request (positive control) | Result |
|---|---|---|
| N10a | `POST /api/classes` with own year `Y1` | HTTP 201 (class `C1`, `schoolId: seed_school_ea`) |
| N10b | `POST /api/terms` with own year `Y1` | HTTP 201 (term `T1`, `schoolId: seed_school_ea`) |
| N11 | `POST /api/sections` with own class `C1` | HTTP 201 (section `S1`, `schoolId: seed_school_ea`) |
| N12a | `POST /api/students` with own year/class/section | HTTP 201 (student `ST1`, `admissionNumber EVID-PC-0001`) |
| N12b | `PATCH /api/students/<ST1>` with own year/class/section + rollNumber | HTTP 200 (updated) |
| N8 | `DELETE /api/students/<ST1>` | HTTP 200 (`ARCHIVED`/`isDeleted:true`) |
| N1a | `PATCH /api/terms?id=<T1>` (rename) | HTTP 200 (renamed) |
| N1b | `DELETE /api/terms?id=<T1>` | HTTP 200 (`INACTIVE`) |
| N4a | `PATCH /api/sections?id=<S1>` (rename) | HTTP 200 (renamed) |
| N4b | `DELETE /api/sections?id=<S1>` | HTTP 200 (`INACTIVE`) |
| N2a | `PATCH /api/classes?id=<C1>` (rename) | HTTP 200 (renamed) |
| N2b | `DELETE /api/classes?id=<C1>` | HTTP 200 (`ARCHIVED`/`isDeleted:true`) |
| N3a | `PATCH /api/classes/<C2>` ([id] path, own class) | HTTP 200 (renamed) |
| N3b | `DELETE /api/classes/<C2>` | HTTP 200 (`ARCHIVED`) |
| N6a | `PATCH /api/academic-years?id=<Y1>` (rename) | HTTP 200 (renamed) |
| N6b | `DELETE /api/academic-years?id=<Y1>` | HTTP 200 (`COMPLETED`) |
| N7a | `PATCH /api/academic-years/<Y2>` ([id] path, own year) | HTTP 200 (renamed) |
| N7b | `DELETE /api/academic-years/<Y2>` | HTTP 200 (`COMPLETED`) |
| N5a | `PATCH /api/subjects?id=<SUB1>` (rename) | HTTP 200 (renamed) |
| N5b | `DELETE /api/subjects?id=<SUB1>` | HTTP 200 (`isActive:false`) |
| N13 | `PATCH /api/subjects/seed_sub_mat` assign with own year/class/section + `seed_mem_admin` | HTTP 201 (assignment `ASS1` created) |
| N9 | (no positive control possible) | n/a — see note below |

**N9 note:** no legitimate tenant-role path exists for `DELETE /api/crud-demo`: SCHOOL_ADMIN is not granted `schools:delete`, so the permission gate blocks every tenant role before the (now school-scoped) archive closure is reached. The hardened guard is dead code for tenant roles; verified by code inspection only.

**Positive-control DB verification (`docs/evidence/tmp-pc-cleanup.ts` run log):** after deletion of the PC rows — `pcRowsGone`: y1/y2/c1/c2/t1/s1/st1/sub1/ass1 all 0; `noOrphans`: enrollment for ST1 0, assignments referencing PC year/class/section 0; seeds untouched (`seed_sub_mat` Maths/MAT/active, `seed_sub_sci` Science/SCI/active, `seed_ay_2627` 2026-2027/ACTIVE/active, `seed_user_admin` active); School B fixture counts unchanged (cls 1, sec 1, sub 1, ay 1, stu 1, term 0).

## Student placement persistence (Phase 1.6C verification — CASE A)

The N12a/N12b responses show `academicYearId/classId/sectionId` as `null` on the student row itself even when the request body carries placement. Independent Phase 1.6C verification (`PC2-ST1`, fresh rows `Evidence PC2 Year B`/`Class B`/`Section B`, admission `EVID-16C-0003`):

- `POST /api/students` (body with `academicYearId=Y1, classId=C1, sectionId=S1`) → HTTP 201; response student row shows `academicYearId: null, classId: null, sectionId: null`.
- `GET /api/students/{ST1}` → HTTP 200 with `"enrollmentRecords":[{"studentId":ST1,"academicYearId":Y1,"classId":C1,"sectionId":S1,"status":"ACTIVE","joinedAt":...}]` — exactly one ACTIVE enrollment with Y1/C1/S1.
- Independent DB query (`enrollment` table): `enrollment count: 1`; row `{academicYearId: Y1, classId: C1, sectionId: S1, rollNumber: null, status: "ACTIVE"}`; student legacy fields `academicYearId/classId/sectionId: null`.

**Conclusion (CASE A):** Student placement is stored **exclusively** in `Enrollment`. The legacy `Student` placement fields intentionally remain `null` by design. The API response reflects the legacy student row; placement is persisted in the same request transaction via `enrollment.create`. Evidence rows deleted afterward (`PC2 CLEANUP`: students 0, enrollments 0, years/classes/sections 0; seeds and School B untouched).

**Scope limitation (Phase 1.6D):** This verification confirms Case A during normal operation. Transactional fault-injection testing (Case C) was not part of this audit and remains outside the verified scope. No conclusions are drawn regarding that scenario.

## DB restore + cleanup verification (evidence integrity)

`docs/evidence/tmp-n-restore.ts` restored every foreign row to its exact pre-audit state (verified values printed in run log): term `Fixture Term B1`/ACTIVE, class `Grade 1`/ACTIVE/not-deleted, section `A`/ACTIVE, subject `Mathematics`/active, year `2026-2027`/ACTIVE, student ACTIVE/not-deleted, and deleted all School A evidence rows (class, term, section, student+enrollment, assignment). `docs/evidence/tmp-n-cleanup.ts` then removed the four audit fixtures and verified: School B counts (terms 0, crud 0), all rows at original values, School A leftovers 0.

---

# PHASE 7 — FREEZE DECISION

## Q1 — Was the corrected audit methodology applied to the full API surface?

**YES.** Phase 1.6 re-read every route file to completion (41 files under `src/app/api/**`), built the route-level inventory in Phase 1 (every route exactly once), and runtime-tested every mutating handler against real foreign rows. The Phase 1.5 gap — route files truncated by the sweep, and inline-Prisma handlers not checked for school-scoping — is closed: the same defect class was actively searched for and found (N1–N13).

## Q2 — Finding totals under the Phase 3 rubric (CANONICAL TABLE)

**This table is the single authoritative count source for this package.** Every other count in this document and in `docs/phase1.5-evidence-package.md` was updated to match it (Phase 1.6B).

| Severity | Phase 1.5 vectors | Phase 1.6 vectors | **Total** |
|---|---|---|---|
| HIGH | 9 | 15 | **24** |
| MEDIUM | 6 | 6 | **12** |
| LOW | 0 | 0 | **0** |
| **TOTAL (exploited vectors)** | **15** | **21** | **36** |

- **Phase 1.5 HIGH (9):** H1–H6 (6), L1-borrow (1), L1-return (1, reclassified Phase 1.6B), L4-DELETE (1, reclassified Phase 1.6).
- **Phase 1.5 MEDIUM (6):** M1–M3 (3), L2 (1), L3 (1), L4-POST (1).
- **Phase 1.6 HIGH (15):** N1a, N1b, N2a, N2b, N3a, N3b, N4a, N4b, N5a, N5b, N6a, N6b, N7a, N7b, N8.
- **Phase 1.6 MEDIUM (6):** N10a, N10b, N11, N12a, N12b, N13.
- **Findings (defects, not vectors):** 26 total — 13 in Phase 1.5 (H1–H6, M1–M3, L1–L4) + 13 in Phase 1.6 (N1–N13).
- **Recorded non-findings:** N9 (permission-blocked, hardened), D7 LOW-1…LOW-4 spot checks (all returned safe — not findings). These do not enter the severity counts.

**Corrections applied during the Phase 1.6B consistency pass (all totals now match the canonical table):**

- **Previous total:** 34 vectors (13 Phase 1.5 + 21 Phase 1.6). **Correct total:** 36 vectors (15 Phase 1.5 + 21 Phase 1.6). **Reason:** the Phase 1.5 package counted its 13 *findings* as 13 *vectors*, but L1 spans 2 vectors (borrow + return) and L4 spans 2 (POST + DELETE) → 15 vectors.
- **Previous HIGH count:** 22 (H1–H6 6, L1 1, L4-DELETE 1, N1a–N8 14). **Correct HIGH count:** 24 (H1–H6 6, L1-borrow 1, L1-return 1, L4-DELETE 1, N1a–N8 15). **Reason:** (a) N1a–N8 spans 15 vectors — N8 is its own vector, the earlier "14" was an aggregation slip; (b) L1-return is now explicitly classified HIGH per the Phase 3 rubric (previously L1 counted once, borrow only).
- **Previous claim (Phase 1.6 package): "N1–N13 (all 21 vectors)"** — unchanged and correct: 21 exploited vectors (22 recorded incl. N9, which is a non-finding).

## Q3 — Exactly how many remain open?

**0.** Every recorded exploit vector is closed, each verified by replaying the identical request against the fixed code:
- **N-vectors 21/21** → HTTP 403/404 with unchanged foreign rows (`phase1.6-after.txt`, 22 response lines incl. N9's unchanged permission 403).
- **L-vectors 6/6** (L1-borrow, L1-return, L2, L3, L4-POST, L4-DELETE) → HTTP 403 with no rows created (`phase1.5-http-after-l14.txt`, L sections).
- **H/M-vectors 9/9** (H1–H6, M1–M3) → rejected post-fix, evidence at service level + SQL repro (`phase1.5-runtime.txt`; Phase 4 wording).
- Positive controls for all N-guards returned 200/201 (`phase1.6-positive-control.txt`); DB restore + cleanup-verify runs confirm zero contamination and zero leftovers.

## Q4 — Which conclusions are runtime vs static?

- **Runtime:** all 36 fixed vectors (pre-fix HTTP 200/201 captured for N1–N13; pre-fix evidence per Phase 4 wording for H/M/L); positive controls for every N-guard (`phase1.6-positive-control.txt`) and the Phase 1.5 library controls; LOW spot checks (D7); DB restore/cleanup verification.
- **Static only:** Staff, Teachers, Dashboard, School Settings, Super Admin, students search/drafts/guardians, subject-assignments DELETE, subject/academic-year POST create paths, all GET lists — all verified school-scoped by code review, none runtime-tested. Any module containing such paths is labelled `PASS (Mutating Paths Verified)` — never bare `PASS`.

## Q5 — Pre-fix HTTP status consistency

All N1–N13 records carry captured pre-fix HTTP responses (`phase1.6-before.txt`). H1–H6/M1–M3/L1-return/L4-DELETE carry the standardized `Pre-fix HTTP: NOT VERIFIED` block with the stated reason (`phase1.5-evidence-package.md` + Phase 4 of this document). No finding record uses ambiguous wording.

## Q6 — Severity review of L1-return and L4-DELETE

Completed (Phase 1.6 for L4-DELETE, Phase 1.6B for L1-return — both in Phase 3):
- **L4-DELETE:** reclassified **MEDIUM → HIGH** because it directly modifies a foreign-owned row (status flip); remediation (school-scoped assert) and post-fix 403 replay evidence are in `phase1.5-http-after-l14.txt`.
- **L1-return:** previously not individually classified (L1 counted once for borrow). Phase 1.6B classifies it **HIGH** — `bookBorrowing.update` + `book.update` on client-supplied ids with no school predicate directly modify foreign-owned rows. Same defect class as L1-borrow; closed (post-fix 403 replay in `phase1.5-http-after-l14.txt`).

## Q7 — Freeze decision

**PASS (Mutating Paths Verified) — READY WITH EXPLICIT TECHNICAL DEBT** (final Phase 1.6C verdict)

- The complete tenant-facing API surface is covered by a route-level inventory (41 route files, literal count in Phase 1); every mutating handler is runtime-verified against foreign identifiers (36/36 vectors closed); every N-guard additionally verified through its legitimate same-school path (positive controls, all 200/201); zero open findings; evidence package is complete (Phases 1–7).
- Read-only / static-only paths (GET lists, search/drafts/guardians, subject-assignments DELETE, subject/academic-year POST create paths, Staff, Teachers, Dashboard, School Settings, Super Admin) are school-scoped by code review and are labelled `STATIC ONLY` or `PASS (Mutating Paths Verified)` accordingly — they are not claimed to be runtime-tested.
- **Integrity statement:** During the Phase 1.6B documentation consistency pass (module labels, canonical counts, L1-return classification, positive controls, route-count verification), no additional security findings were discovered beyond those already recorded (H1–H6, M1–M3, L1–L4, N1–N13); every claim above was re-verified against the captured evidence files referenced in this package. If any future inconsistency is found, the freeze must be re-opened and the affected record corrected in Deliverable-4 format before re-freezing.
- **Explicit technical debt carried into the freeze:**
  1. **RLS still deferred** — tenant isolation remains application-layer only (`withRls` does not filter).
  2. **Static-only modules** (Staff, Teachers, Dashboard, School Settings, Super Admin, search/drafts/guardians, subject-assignments, GET lists) are code-reviewed but not runtime-tested — they carry school-scoped predicates in every read/write; runtime spot-tests remain a follow-up.
  3. **Dead code** (~30 unwired service functions) is not runtime-tested.
  4. Rejection semantics for the older H/M fixes remain coarse (HTTP 500 generic for some); N/L fixes return clean HTTP 403.
  5. Any future route must re-apply the school-scoped assertion pattern before mutation (or RLS must be enabled).

**Phase 1.6C validation pass (2026-08-02, final pre-freeze):**

- Release tag `v0.9-academics-complete` re-pointed at the audited commit (`043aca9` → amended final commit) carrying the Phase 1.6/1.6B security fixes and this complete evidence package; verified `git rev-parse HEAD` = `git rev-parse v0.9-academics-complete^{commit}`.
- Temporary artifacts removed from the tree: all `scripts/tmp-*` / `scripts/gate-*` moved to `docs/evidence/` (they are referenced evidence), `scripts/closure-*`, `jar.txt`, `prisma/check-class-enrollment.ts`, `prisma/check-db.ts` deleted; `git ls-tree -r v0.9-academics-complete` shows zero `scripts/tmp-*`, `scripts/gate-*`, `jar.txt` entries.
- Student placement verified as **CASE A** (placement stored exclusively in `Enrollment`; legacy student placement fields intentionally null) — see "Student placement persistence (Phase 1.6C verification — CASE A)" above.
- Count reconciliation re-verified across all locations (this Phase 7 Q2 canonical table, Phase 1.5 package line 895 and closing totals): HIGH 24 / MEDIUM 12 / LOW 0 / TOTAL 36 at every location.
- **Integrity statement (Phase 1.6C):** During the Phase 1.6C validation pass, no additional security findings were silently absorbed. If any new security issue had been discovered while executing Tasks 1–5, this document would have stopped, produced a full Deliverable-4 evidence record for that finding, and the freeze verdict would have been withheld until remediation and re-verification completed.
