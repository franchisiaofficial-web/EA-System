# Phase 1.5 — Tenant Isolation Audit (Freeze Gate)

Status: **PASS** — Date: 2026-08-02
Audit target: Cross-tenant data isolation in `src/services/**` + API/action layers
Primary question: Was the Attendance cross-tenant vulnerability (Phase 1) unique, or one instance of a wider class?

---

## Executive Summary

**The Attendance vulnerability was NOT unique.** A systematic audit found the same class of defect in
6 more reachable vectors (exams ×3, fees ×3, attendance sessions ×1, attendance server action ×1),
all proven with runtime cross-tenant probes (Case D — writes/reads succeeded across tenants).

All 9 reachable findings (6 P0, 3 MEDIUM) were remediated and re-verified: every foreign-identifier
probe now fails closed (Case C — application-layer rejection), and all previously-contaminated rows
were removed. DB state verified clean post-fix.

Additionally, ~30 exported service functions (including every static-audit MEDIUM candidate) are
**dead code** — zero callers anywhere in `src`. They are documented as accepted technical debt with a
recommendation to remove or wire correctly.

---

## Phase A — Raw SQL Inventory (5 sites)

| # | Location | Query | RLS | School-scoped | Verdict |
|---|----------|-------|-----|---------------|---------|
| A1 | `src/services/attendance/attendance-service.ts:290` | `$queryRawUnsafe` roster validation | withRls | YES — `$6` school predicate | LOW ✓ |
| A2 | `src/services/attendance/attendance-service.ts:334` | `$queryRawUnsafe` INSERT (bulk) | withRls | YES — `NOT EXISTS` school-scoped subquery | LOW ✓ |
| A3 | `src/lib/prisma/rls-middleware.ts:44` | `$queryRawUnsafe` SET LOCAL (context) | n/a | n/a — infrastructure | LOW ✓ |
| A4 | `src/app/dashboard/super-admin/platform-health/page.tsx:19` | `$queryRaw\`SELECT 1\`` | authPrisma | n/a — constant, no data | LOW ✓ |
| A5 | `src/app/dashboard/super-admin/page.tsx:96` | `$queryRaw\`SELECT 1\`` | authPrisma | n/a — constant, no data | LOW ✓ |

No parameterizable SQL (string-interpolated user input) found outside the RLS middleware. All 5 sites
verified safe. Architectural note: `withRls` is currently **inert** (RLS is disabled on all tables,
zero policies, `postgres` role has `usebypassrls=true`) — isolation relies entirely on explicit
application-layer where-clauses. RLS rollout remains deferred (Phase 2 hardening item).

---

## Phase B — Reachable Service Surface (ORM)

Import analysis of every route/page/action (`src/app/**`, `src/actions/**`):

| Service | Functions reached | Scoping at audit time | Verdict |
|---------|-------------------|-----------------------|---------|
| `attendance/attendance-service.ts` | markAttendance, bulkMarkAttendance, getClassAttendance, getStudentAttendance | School-scoped predicates (Phase 1 fix) | ✓ fixed |
| `exam.service.ts` | getExams, getExamResults, getStudentResults, upsertResult, bulkUpsertResults | getExams scoped; by-id lookups **unscoped** | ✓ fixed |
| `fee.service.ts` | getInvoices, createInvoice, recordPayment, getFeeStructures, createFeeStructure | lists scoped; create/record **unscoped on identifiers** | ✓ fixed |
| `promotion/promotion-service.ts` | runPromotionBatch, completeAcademicYearFlow | School-scoped planning reads; failure detail leaked foreign student info | ✓ fixed |
| `academic/academic-service.ts` | listClasses | School-scoped by `schoolId` param (from authCtx) | ✓ safe |
| `parents/parent-service.ts` | getLinkedStudents | Session-derived `parentMembershipId` (from authCtx) | ✓ safe |
| `error-log.service.ts` | getErrorLogs, getRecentErrors, getErrorLogById, updateErrorLog | SUPER_ADMIN role-gated routes only | ✓ safe (role-gated) |

### Dead code (zero callers — accepted debt)

`getUserById`, `getUsersForSchool` (user-service); `getSchoolById`, `getSchoolBySlug`,
`updateSchoolSettings` (school-service); `getSchoolMembers`, `getMemberCount`, `inviteUser`,
`acceptInvite`, `suspendMembership` (membership-service); `linkParentToStudent`,
`removeParentLink`, `getLinkedParents` (parent-service); `createAcademicYear`, `updateSection`,
`updateClass`, `archiveClass`, `assignTeacher`, `removeTeacher`, `getAssignments`,
`getEnrollments`, `enrollStudent`, `transferStudent`, `archiveEnrollment`, `updateAcademicYear`,
`activateAcademicYear` (academic-service); `getAuditLogs`, `logSchoolEvent` (audit-service);
`getUserMemberships`, `recordLogin` (auth-service); `getEnabledFeatures`, `isFeatureEnabled`,
`toggleSchoolFeature`, `getAllFeatures` (feature-service); `super-admin-service.ts` (all).

Every static-audit MEDIUM candidate (`getUserById`, `getSchoolBySlug`, `suspendMembership`,
`acceptInvite`, `linkParentToStudent`) falls into this dead set — **unreachable, not exploitable today**.
Recommendation: delete or wire with school-scoped validation before Phase 2.

---

## Phase C — Service Risk Matrix (reachable only)

| ID | Service / method | Client-controlled identifier | Risk | Fix | Runtime result post-fix |
|----|------------------|------------------------------|------|-----|--------------------------|
| H1 | exam.service getExamResults | examId | **P0 read** | `assertExamInSchool` | REJECTED (Case C) |
| H2 | exam.service getStudentResults | studentId | **P0 read** | `assertStudentInSchool` | REJECTED (Case C) |
| H3 | exam.service upsertResult / bulkUpsertResults | examId+studentId | **P0 write** | assert both in school | REJECTED (Case C) |
| H4 | fee.service recordPayment | invoiceId | **P0 write** | assert invoice in school; payment uses invoice.schoolId | REJECTED (Case C) |
| H5 | `api/attendance/sessions/[id]` PATCH | session id | **P0 write** | findFirst scoped by authCtx.schoolId before update | REJECTED (Case C, HTTP 500→blocked) |
| H6 | `actions/attendance.ts` + bulkMarkAttendance | schoolId in body | **P0 write** | action derives schoolId from session; service asserts `input.schoolId === authCtx.schoolId` | REJECTED (Case C) |
| M1 | fee.service createInvoice | studentId | MEDIUM write | assert student in school | REJECTED (Case C) |
| M2 | fee.service createFeeStructure (+ sessions POST classId) | categoryId/classId | MEDIUM write | assert category+class in school (class also in sessions POST) | REJECTED (Case C) |
| M3 | promotion runPromotionBatch failure detail | studentId in items | MEDIUM info leak | detail query scoped to school; foreign students render "—" | NO LEAK (verified) |

LOW spot-checks (runtime): `GET /api/students/:id` foreign → HTTP 404; `GET /api/students?schoolId=<foreign>` → param ignored, session school returned; `GET /api/attendance/sessions?classId=<foreign>` → 200 empty (Case A); `GET /api/attendance` foreign classId → 0 records (Case A); raw-SQL attendance sites re-proven in Phase 1 post-fix runs.

---

## Phase D — Runtime Evidence

Harnesses: `docs/evidence/gate-xten-runtime-prefix.ts` (pre-fix, 2026-08-01), `docs/evidence/gate-xten-runtime-postfix.ts` + `h5-http-patch.ps1` (post-fix, 2026-08-02). Actor: School A admin (`seed_user_admin`), target: School B fixture data (`fixture_*`).

### Pre-fix (Case D confirmed)

| Probe | Result |
|-------|--------|
| H1 getExamResults(foreign examId) | OK — returned 1 row (foreign result, marks 88) |
| H2 getStudentResults(foreign studentId) | OK — returned 1 row |
| H3 upsertResult(schoolId=A, foreign exam+student) | OK — foreign row mutated to 99/A+ |
| H4 recordPayment(schoolId=A, foreign invoiceId) | OK — foreign invoice PARTIAL; payment row created under `seed_school_ea` |
| H5 attendanceSession.update(foreign id) | OK — foreign session CLOSED |
| H6 bulkMarkAttendance(schoolId=B via client) | OK — attendance row written under `fixture_school_b` |
| M1 createInvoice(A, foreign studentId) | OK — cross-tenant invoice created |
| M2 createFeeStructure(A, foreign classId) | OK — cross-tenant structure created |
| M3 promotion(foreign studentId) | failed item, but leak of foreign name/admissionNumber/currentClass |

### Post-fix (all closed)

| Probe | Result | Evidence |
|-------|--------|----------|
| H1 | REJECTED: "Exam not found" | no rows returned |
| H2 | REJECTED: "Student not found" | no rows returned |
| H3 | REJECTED; foreign row unchanged (marks=88) | DB check ✓ |
| H4 | REJECTED: "Invoice not found"; invoice unchanged (paid=0/PENDING); 0 payments | DB check ✓ |
| H5 (route-level HTTP) | PATCH foreign session → HTTP 500 (blocked); session remains ACTIVE | DB check ✓ |
| H6 | REJECTED: "School mismatch: operation scoped to authenticated school only"; 0 School B attendance rows | DB check ✓ |
| M1 | REJECTED: "Student not found" | no invoice created |
| M2 | REJECTED: "Class not found" | no structure created |
| M3 | failure detail renders "—" — no foreign PII | response check ✓ |

### Post-fix DB verification

| Check | Result |
|-------|--------|
| attendance_records where school_id=fixture_school_b | 0 rows |
| fee_payments total | 0 rows |
| fee_invoices linked to foreign student | only the legitimate `fixture_inv_b1` (School B fixture) |
| fee_structures on foreign class | 0 rows |
| fixture_sess_b1 | ACTIVE, closed_at null (restored) |
| fixture_res_b1 | marks 88, grade A (restored) |
| fixture_inv_b1 | paid 0, PENDING (restored) |

---

## Phase E — Final Assessment

**Q1. Was the Attendance vulnerability unique?** NO. Six additional P0s (H1–H6) across exams,
fees, sessions, and server actions were proven with runtime evidence. Same defect class:
client-controlled identifiers consumed by services without school validation.

**Q2. How many cross-tenant gaps were found?** 9 reachable (6 P0, 3 MEDIUM) + 5 static MEDIUM
candidates, the latter all dead code.

**Q3. How many remediated?** 9/9 reachable findings remediated with runtime re-verification.
Dead-code findings accepted as debt (unexploitable); RLS rollout deferred to Phase 2.

**Q4. Freeze recommendation: READY** — with accepted technical debt (below).

**Q5. Why READY (reason B — evidence-based):**
- Every reachable service validates foreign identifiers against the session school before any
  read/write (Case C), verified pre/post with byte-level DB state checks.
- Route/action layers derive schoolId exclusively from `authCtx`; server actions additionally
  assert at the service boundary (defense in depth).
- `npx tsc --noEmit` clean; no regressions observed in the live dev server.
- No known reachable cross-tenant vector remains; remaining items are structural hardening.

---

## Accepted Technical Debt (tracked for Phase 2)

1. **RLS not enabled** — `rls-attendance.sql` never applied; `withRls` is inert; `postgres` role
   uses `usebypassrls=true`. Application-layer guards are the only control.
2. **Dead code** — ~30 exported service functions unwired; recommend deletion or school-scoped wiring.
3. **Error status codes** — foreign-identifier rejections surface as HTTP 500 (codebase convention is
   plain `Error` → 500); semantic 404 mapping is a follow-up cleanup.
4. **Promotion failure detail** — foreign students now render "—" instead of leaking; UX refinement
   (explicit "student not in this school") deferred.

---

## Files changed this phase

- `src/services/exam.service.ts` — added `assertExamInSchool` / `assertStudentInSchool`; all by-id reads/writes validated
- `src/services/fee.service.ts` — `recordPayment`/`createInvoice`/`createFeeStructure` assert identifiers in school
- `src/app/api/attendance/sessions/route.ts` — POST validates classId belongs to school
- `src/app/api/attendance/sessions/[id]/route.ts` — PATCH validates session belongs to school
- `src/actions/attendance.ts` — schoolId derived from session, never client input
- `src/services/attendance/attendance-service.ts` — `bulkMarkAttendance` asserts `input.schoolId === authCtx.schoolId`
- `src/services/promotion/promotion-service.ts` — failure detail query school-scoped
- `docs/evidence/gate-xten-runtime-postfix.ts` — post-fix runtime harness (new)
