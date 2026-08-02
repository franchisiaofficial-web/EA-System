# EA SYSTEM — Phase 1.5 Evidence Package (canonical security audit)

Date: 2026-08-02
Scope: Cross-tenant isolation, Academics module + all reachable API routes
Artifacts: `docs/evidence/phase1.5-runtime.txt` (service-level), `docs/evidence/phase1.5-http.txt` (route-level), `docs/evidence/phase1.5-http-after-l14.txt` (L1–L4 post-fix replays). Completing audit: `docs/phase1.6-evidence-package.md` (freeze gate — full route inventory, N1–N13, Phases 1–7).
Harness sources: `docs/evidence/gate-xten-evidence.ts`, `docs/evidence/gate-xten-runtime-prefix.ts` (pre-fix, 2026-08-01), `docs/evidence/gate-xten-runtime-postfix.ts`, HTTP harness `h-evidence.ps1`, L1–L4 post-fix harness `h-evidence-after.ps1`

Test identities:
- Authenticated actor: School A admin — session school `seed_school_ea` (user `seed_user_admin`, membership `seed_mem_admin`)
- Target tenant: School B — `fixture_school_b` (fixtures: `fixture_cls_b_g01`, `fixture_stu_b1`, `fixture_mem_b_stu`, `fixture_exam_b`, `fixture_res_b1`, `fixture_inv_b1`, `fixture_sess_b1`, `fixture_cat_b1`, `fixture_book_b1`)

---

# DELIVERABLE 1 — PHASE A: COMPLETE RAW SQL INVENTORY

All raw SQL call sites in `src/` (verified by full-tree grep, 2026-08-02):

| File | Line | Function | Query Type | School Predicate | RLS Context | Risk | Status |
|------|------|----------|------------|------------------|-------------|------|--------|
| `src/services/attendance/attendance-service.ts` | 297 | `bulkMarkAttendance` | `$queryRawUnsafe` (roster validation) | YES — `m.school_id = $6`, `s.school_id = $6`, `e.school_id = $6`, `ar.school_id = $6` | withRls | LOW | Verified safe (foreign ids resolve to NULL → rejection; proven in Phase 1 post-fix runs and today's runtime.txt) |
| `src/services/attendance/attendance-service.ts` | 341 | `bulkMarkAttendance` | `$queryRawUnsafe` (bulk INSERT … RETURNING) | YES — INSERT guarded by school-scoped validation above; `school_id` written from `input.schoolId` after H6 assertion | withRls | LOW | Verified safe (H6 rejection today) |
| `src/lib/prisma/rls-middleware.ts` | 44 | `withRls` (set_config) | `$queryRawUnsafe` | n/a — infrastructure (`SET LOCAL app.current_school_id/membership_id`) | withRls | LOW | Verified safe (SET LOCAL rollback proven in Phase 1 `docs/evidence/gate-setlocal.ts`) |
| `src/app/dashboard/super-admin/platform-health/page.tsx` | 19 | platform-health page | `$queryRaw\`SELECT 1\`` | n/a — constant, no data access | authPrisma | LOW | Verified safe (constant) |
| `src/app/dashboard/super-admin/page.tsx` | 96 | super-admin page | `$queryRaw\`SELECT 1\`` | n/a — constant, no data access | authPrisma | LOW | Verified safe (constant) |

No other `$queryRaw*`/`$executeRaw*` call sites exist in `src/`. No parameterizable (string-interpolated) SQL with user input exists outside the RLS middleware.

---

# DELIVERABLE 2 — PHASE B: COMPLETE PRISMA ORM AUDIT

All business areas, each exactly once. "Runtime Tested" values: **Deliverable 4** (direct exploit), **Deliverable 7** (LOW spot-check), **Not runtime tested**.

| Service | Read | Create | Update | Delete | Tenant Validation | Explicit School Scope | Runtime Tested | Runtime Evidence |
|---------|------|--------|--------|--------|-------------------|------------------------|----------------|------------------|
| Students | `api/students` list/search, `api/students/[id]` GET | `api/students` POST, drafts | `api/students/[id]` PATCH | archive (PATCH status) | Identifiers validated via `schoolId: authCtx.schoolId` in every where-clause; guardians cross-check `guardian.schoolId !== schoolId` (guardians route :113) | YES — `authCtx.schoolId` on all reads/writes | Deliverable 7 | LOW-1 foreign by-id → HTTP 404; LOW-4 `?schoolId=` param ignored, session school returned |
| Staff | `api/staff/members` GET | `api/staff/members` POST | `api/staff/members/[id]` PATCH | — | where-clauses scoped `schoolId: authCtx.schoolId`; email-in-school check on create | YES | Not runtime tested | Static: all queries carry schoolId predicate |
| Attendance | `attendance-service` getClassAttendance/getStudentAttendance + API GET | markAttendance/bulkMarkAttendance | updateAttendanceRecord | soft delete | School-scoped predicates everywhere; H6 assertion `input.schoolId === authCtx.schoolId` (service :211) | YES | Deliverable 4 | H6 exploit → REJECTED post-fix; Deliverable 7 LOW-2 foreign class GET → 200 [] |
| Promotion | promotion-service planning reads | promotion items (enrollment moves) | — | — | Reads scoped by `input.schoolId`; foreign items fail safely; failure detail query school-scoped (:222) | YES | Deliverable 4 | M3: pre-fix PII leak; post-fix `studentName:"—"` |
| Fees | getInvoices/getFeeStructures/getFeeCategories | createInvoice/createFeeStructure/createFeeCategory | recordPayment (invoice paidAmount/status) | — | `assertStudentInSchool`/`assertClassInSchool`/`assertCategoryInSchool` guards added; all lists scoped | YES | Deliverable 4 | H4/M1/M2 → REJECTED post-fix, DB unchanged |
| Sessions | `api/attendance/sessions` GET | POST (classId validated :28-31) | `[id]` PATCH (findFirst scoped :18-21) | — | PATCH scoped `where: { id, schoolId: authCtx.schoolId }`; POST validates class in school | YES | Deliverable 4 | H5 PATCH foreign → HTTP 500 blocked, session remains ACTIVE; Deliverable 7 LOW-3 foreign class GET → 200 [] |
| Exams | getExams/getExamResults/getStudentResults | — | upsertResult/bulkUpsertResults | — | `assertExamInSchool` + `assertStudentInSchool` before every by-id operation | YES | Deliverable 4 | H1/H2/H3 → REJECTED post-fix, foreign row unchanged |
| Subjects | `api/subjects` GET | POST | `api/subjects/[id]` PATCH (teacher assignment validated :76/:93) | — | where-clauses scoped `schoolId: authCtx.schoolId` | YES | Not runtime tested | Static: all queries carry schoolId predicate |
| Academic Years | `api/academic-years` GET | POST | `api/academic-years/[id]` PATCH | — | where-clauses scoped `schoolId: authCtx.schoolId` | YES | Not runtime tested | Static: scoped |
| Classes | `api/classes` GET, `[id]` GET | POST | `[id]` PATCH | archive via PATCH | list/by-id scoped; class-assignments POST/DELETE validate classId + teacherMembershipId in school (fixed, see 4A) | YES | Deliverable 4A | L4 create foreign class+teacher → HTTP 403 post-fix; classes CRUD itself scoped |
| Sections | `api/sections` GET, `[id]` GET | POST | `[id]` PATCH | — | where-clauses scoped `schoolId: authCtx.schoolId` | YES | Not runtime tested | Static: scoped |
| Dashboard | `api/dashboard/school-admin` aggregates | — | — | — | every aggregate `where: { schoolId }` from `authCtx.schoolId` | YES | Not runtime tested | Static: scoped |
| Parent | parent attendance page `getLinkedStudents(authCtx.membershipId)`; guardians routes | guardians create | guardians update | unlink | parentMembershipId from session; guardians scoped by schoolId | YES | Not runtime tested | Static: session-derived |
| Communication | **Module does not exist** — no schema model, no route, no service, no UI (verified by schema grep + route-tree search, 2026-08-02) | — | — | — | n/a | n/a | Not runtime tested | n/a — absent |
| Library | `api/library` GET (books/borrowings scoped) | `book.create` scoped; `bookBorrowing.create` validates bookId + studentId in school (fixed, see 4A) | `bookBorrowing.update` by id validated — borrowing must belong to school (fixed, see 4A) | — | GET scoped; POST borrow/return validate identifiers in school | **YES** | Deliverable 4A | L1 borrow foreign book+student → HTTP 403 post-fix; positive control 201/200 in own school |
| Transport | `api/transport` GET (scoped) | vehicle create scoped; assignment create validates studentId/routeId/vehicleId in school (fixed, see 4A) | — | — | GET scoped; assignment POST validates identifiers in school | **YES** | Deliverable 4A | L3 assignment foreign student → HTTP 403 post-fix |
| Timetable | `api/timetable` GET (scoped) | POST create validates classId/sectionId/subjectId/teacherId in school (fixed, see 4A) | — | — | GET scoped; POST validates all client identifiers in school | **YES** | Deliverable 4A | L2 timetable foreign class+subject → HTTP 403 post-fix |
| Class Assignments | `api/class-assignments` GET (scoped) | POST validates classId + teacherMembershipId in school (fixed, see 4A) | — | DELETE by id validated — assignment must belong to school (fixed, see 4A) | GET scoped; POST/DELETE check school ownership of all client ids | **YES** | Deliverable 4A | L4 create foreign class+teacher → HTTP 403; DELETE foreign → HTTP 403 post-fix |
| Super-Admin | `admin/schools`, `admin/audit-logs`, `admin/error-logs` | school create | school update, error-log update | — | SUPER_ADMIN role-gated routes; `superAdmin`/`authPrisma` clients bypass RLS by design | YES (role) | Not runtime tested | Static: role-gated |
| School Settings | `api/school-settings` | create | update | — | upsert keyed by `schoolId: authCtx.schoolId` | YES | Not runtime tested | Static: scoped |

---

# DELIVERABLE 3 — PHASE C: COMPLETE SERVICE RISK MATRIX

| Service | ORM / Raw SQL | Scoping Evidence | Runtime Evidence | Result |
|---------|---------------|------------------|------------------|--------|
| Students | ORM (routes) | `schoolId: authCtx.schoolId` everywhere | D7 LOW-1 (404), LOW-4 (param ignored) | SAFE |
| Staff | ORM (routes) | schoolId predicates + email-in-school check | none (static) | SAFE (not runtime tested) |
| Attendance | Raw SQL (2 sites) + ORM | school-scoped SQL predicates + H6 assertion | D4 H6 (rejected post-fix); D7 LOW-2 (0 rows) | FIXED |
| Promotion | ORM | schoolId-scoped planning + scoped failure detail | D4 M3 (leak closed) | FIXED |
| Fees | ORM | schoolId param + assert guards | D4 H4/M1/M2 (rejected post-fix, DB unchanged) | FIXED |
| Sessions | ORM (routes) | PATCH scoped findFirst; POST class validation | D4 H5 (500 blocked); D7 LOW-3 (0 rows) | FIXED |
| Exams | ORM | assertExamInSchool/assertStudentInSchool | D4 H1/H2/H3 (rejected post-fix, row unchanged) | FIXED |
| Subjects | ORM (routes) | schoolId predicates incl. teacher-assign | none (static) | SAFE (not runtime tested) |
| Academic Years | ORM (routes) | schoolId predicates | none (static) | SAFE (not runtime tested) |
| Classes | ORM (routes) | list/by-id scoped; assignments POST/DELETE now school-validated | D4A L4 (rejected 403 post-fix) | FIXED |
| Sections | ORM (routes) | schoolId predicates | none (static) | SAFE (not runtime tested) |
| Dashboard | ORM (route) | all aggregates schoolId-scoped | none (static) | SAFE (not runtime tested) |
| Parent | ORM | session-derived membershipId; guardians scoped | none (static) | SAFE (not runtime tested) |
| Library | ORM (route) | GET scoped; borrow/return school-validated | D4A L1 (rejected 403 post-fix; positive control OK) | FIXED |
| Transport | ORM (route) | GET scoped; assignment create school-validated | D4A L3 (rejected 403 post-fix) | FIXED |
| Timetable | ORM (route) | GET scoped; create school-validated | D4A L2 (rejected 403 post-fix) | FIXED |
| Class Assignments | ORM (route) | GET scoped; POST/DELETE school-validated | D4A L4 POST + DELETE (rejected 403 post-fix) | FIXED |
| Super-Admin | ORM (authPrisma/superAdmin) | role-gated routes | none (static) | SAFE (role-gated, not runtime tested) |
| School Settings | ORM (route) | upsert keyed by authCtx schoolId | none (static) | SAFE (not runtime tested) |
| Communication | — | module absent | — | N/A |

---

# DELIVERABLE 4 — COMPLETE VULNERABILITY RECORD

Every issue stands alone. For each: BEFORE (authenticated school, target school, request, pre-fix code, SQL executed, rows returned, database state) → Code Diff → AFTER (identical replay, response, status code, database proof, why it fails).

Files without a git baseline (`exam.service.ts`, `fee.service.ts`, promotion detail, sessions routes are untracked) quote the pre-fix code as captured on disk during the audit (2026-08-01 snapshot); the pre-fix behavior is proven by the literal SQL reproduction run today (transactional ROLLBACK where writes) and the pre-fix runtime transcript (2026-08-01, `docs/evidence/gate-xten-runtime-prefix.ts`).

---

## H1 — getExamResults(examId): cross-tenant read of exam results

**Authenticated School:** `seed_school_ea` (School A admin)
**Target School:** `fixture_school_b`

**BEFORE — Request (service level):**
```
getExamResults('fixture_exam_b', ctx)   // ctx.schoolId = seed_school_ea
```

**BEFORE — Pre-fix code (audit snapshot, file untracked):**
```ts
export async function getExamResults(examId: string, rc: RequestContext) {
  return withRls(rc, (tx) => tx.examResult.findMany({
    where: { examId },                       // ← no school validation
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
    orderBy: { student: { firstName: "asc" } },
  }));
}
```

**BEFORE — SQL executed (literal, run 2026-08-02):**
```sql
SELECT er.id, er.school_id, er.exam_id, er.marks_obtained, er.grade, s.first_name, s.last_name, s.admission_number
FROM exam_results er LEFT JOIN students s ON s.id = er.student_id
WHERE er.exam_id = 'fixture_exam_b'          -- NO school predicate
```

**BEFORE — Rows returned:**
```
ROWS RETURNED: 1
{"id":"fixture_res_b1","school_id":"fixture_school_b","exam_id":"fixture_exam_b","marks_obtained":88,"grade":"A","first_name":"Bharat","last_name":"Vasan","admission_number":"FIXADM0001"}
```

**BEFORE — Response (pre-fix runtime transcript, 2026-08-01):**
```
H1 getExamResults(foreign examId) -> OK, returned 1 row
```

**Code Diff:**
```diff
 export async function getExamResults(examId: string, rc: RequestContext) {
-  return withRls(rc, (tx) => tx.examResult.findMany({
-    where: { examId },
+  return withRls(rc, async (tx) => {
+    await assertExamInSchool(tx, examId, rc.schoolId);
+    return tx.examResult.findMany({
+      where: { examId },
```
New guard (src/services/exam.service.ts:13-16):
```ts
async function assertExamInSchool(tx, examId, schoolId) {
  const exam = await tx.exam.findFirst({ where: { id: examId, schoolId } });
  if (!exam) throw new Error("Exam not found");
}
```

**AFTER — Replay identical request:**
```
RESULT: REJECTED — Exam not found
```

**AFTER — Status code (route-level, HTTP transcript):** `GET /api/exams?examId=fixture_exam_b` → **HTTP 500**, body `{"success":false,"error":{"code":"INTERNAL","message":"An unexpected error occurred"}}` (rejection; no data returned)

**AFTER — Database proof (fixed guard SQL, literal):**
```sql
SELECT id FROM exams WHERE id = 'fixture_exam_b' AND school_id = 'seed_school_ea'
```
```
GUARD SQL ROWS: 0
```

**Why the exploit no longer succeeds:** the guard query returns 0 rows for a foreign exam, the service throws before the result query executes, and the foreign row was never read.

---

## H2 — getStudentResults(studentId): cross-tenant read by student

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `getStudentResults('fixture_stu_b1', ctx)`

**BEFORE — Pre-fix code (audit snapshot):**
```ts
export async function getStudentResults(studentId: string, rc: RequestContext) {
  return withRls(rc, (tx) => tx.examResult.findMany({
    where: { studentId },                    // ← no school validation
    include: { exam: { include: { subject: { select: { name: true } } } } },
    orderBy: { exam: { examDate: "desc" } },
  }));
}
```

**BEFORE — SQL executed (literal):**
```sql
SELECT er.id, er.school_id, er.exam_id, er.marks_obtained, e.name AS exam_name
FROM exam_results er LEFT JOIN exams e ON e.id = er.exam_id
WHERE er.student_id = 'fixture_stu_b1'       -- NO school predicate
```

**BEFORE — Rows returned:**
```
ROWS RETURNED: 1
{"id":"fixture_res_b1","school_id":"fixture_school_b","exam_id":"fixture_exam_b","marks_obtained":88,"exam_name":"Unit Test 1"}
```

**BEFORE — Response (pre-fix transcript):** `H2 getStudentResults(foreign studentId) -> OK, returned 1 row`

**Code Diff:**
```diff
 export async function getStudentResults(studentId: string, rc: RequestContext) {
-  return withRls(rc, (tx) => tx.examResult.findMany({
-    where: { studentId },
+  return withRls(rc, async (tx) => {
+    await assertStudentInSchool(tx, studentId, rc.schoolId);
+    return tx.examResult.findMany({
+      where: { studentId },
```
New guard (src/services/exam.service.ts:18-21):
```ts
async function assertStudentInSchool(tx, studentId, schoolId) {
  const student = await tx.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw new Error("Student not found");
}
```

**AFTER — Replay:** `RESULT: REJECTED — Student not found`
**AFTER — Route-level:** `GET /api/exams?studentId=fixture_stu_b1` → **HTTP 500** (rejection)

**AFTER — Database proof:**
```sql
SELECT id FROM students WHERE id = 'fixture_stu_b1' AND school_id = 'seed_school_ea'
```
```
GUARD SQL ROWS: 0
```

**Why it fails now:** guard returns 0 rows for the foreign student; service throws before reading results.

---

## H3 — upsertResult / bulkUpsertResults: cross-tenant WRITE of a foreign result

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `upsertResult('seed_school_ea', { examId: 'fixture_exam_b', studentId: 'fixture_stu_b1', marksObtained: 99 }, ctx)`

**BEFORE — Pre-fix code (audit snapshot):**
```ts
export async function upsertResult(schoolId: string, data, rc: RequestContext) {
  return withRls(rc, (tx) => tx.examResult.upsert({
    where: { examId_studentId: { examId: data.examId, studentId: data.studentId } },
    create: { schoolId, ...data },
    update: { marksObtained: data.marksObtained, grade: data.grade, remarks: data.remarks },
  }));
}
```

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
UPDATE exam_results SET marks_obtained = 99, grade = 'A+' WHERE id = 'fixture_res_b1';
SELECT marks_obtained, grade FROM exam_results WHERE id = 'fixture_res_b1';
ROLLBACK;
```

**BEFORE — Rows:**
```
UPDATE affected rows: 1
ROW INSIDE TRANSACTION (mutation visible): {"marks_obtained":99,"grade":"A+"}
ROW AFTER ROLLBACK: {"marks_obtained":88,"grade":"A"}
```

**BEFORE — Response (pre-fix transcript):** `H3 upsertResult(foreign) -> OK; foreign row mutated to marks 99, grade A+` (real mutation, subsequently restored to 88 by the post-fix cleanup)

**Code Diff:** identical guard insertion pattern:
```diff
 export async function upsertResult(schoolId, data, rc) {
   return withRls(rc, async (tx) => {
+    await assertExamInSchool(tx, data.examId, schoolId);
+    await assertStudentInSchool(tx, data.studentId, schoolId);
     return tx.examResult.upsert({
```
(bulkUpsertResults:59-61 — `assertExamInSchool` once, `assertStudentInSchool` per result)

**AFTER — Replay:** `RESULT: REJECTED — Exam not found`

**AFTER — Database proof:**
```sql
SELECT marks_obtained, grade FROM exam_results WHERE id = 'fixture_res_b1'
```
```
FOREIGN ROW UNCHANGED: {"marks_obtained":88,"grade":"A"}
```

**Why it fails now:** assertions reject the foreign exam/student before the upsert can execute; no write occurs.

---

## H4 — recordPayment(invoiceId): cross-tenant payment + foreign invoice mutation

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `recordPayment('seed_school_ea', { invoiceId: 'fixture_inv_b1', amount: 2000, method: 'CASH' }, ctx)`

**BEFORE — Pre-fix code (audit snapshot):**
```ts
export async function recordPayment(schoolId, data, rc) {
  return withRls(rc, async (tx) => {
    const invoice = await tx.feeInvoice.findUnique({ where: { id: data.invoiceId } });  // ← no school check
    const payment = await tx.feePayment.create({ data: { schoolId, invoiceId: data.invoiceId, ... } });
    await tx.feeInvoice.update({ where: { id: data.invoiceId }, data: { paidAmount: ..., status: ... } });
    return payment;
  });
}
```

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
INSERT INTO fee_payments (id, school_id, invoice_id, amount, method, paid_at, received_by, created_at)
  VALUES ('evid_pay_h4', 'seed_school_ea', 'fixture_inv_b1', 2000, 'CASH', now(), 'seed_user_admin', now());
UPDATE fee_invoices SET paid_amount = paid_amount + 2000, status = 'PARTIAL' WHERE id = 'fixture_inv_b1';
SELECT id, school_id, invoice_id, amount, method FROM fee_payments WHERE invoice_id = 'fixture_inv_b1';
ROLLBACK;
```

**BEFORE — Rows:**
```
PAYMENT ROW INSIDE TRANSACTION: {"id":"evid_pay_h4","school_id":"seed_school_ea","invoice_id":"fixture_inv_b1","amount":2000,"method":"CASH"}
INVOICE INSIDE TRANSACTION: {"id":"fixture_inv_b1","paid_amount":2000,"status":"PARTIAL"}
INVOICE AFTER ROLLBACK: {"id":"fixture_inv_b1","paid_amount":0,"status":"PENDING"}
PAYMENTS AFTER ROLLBACK: 0
```

**BEFORE — Response (pre-fix transcript):** `H4 recordPayment(schoolId=A, foreign invoiceId) -> OK; foreign invoice paid_amount 2000 status PARTIAL; payment row school_id=seed_school_ea` (tenant contamination; real payment row was subsequently deleted)

**Code Diff (src/services/fee.service.ts):**
```diff
 export async function recordPayment(schoolId, data, rc) {
   return withRls(rc, async (tx) => {
-    const invoice = await tx.feeInvoice.findUnique({ where: { id: data.invoiceId } });
+    const invoice = await tx.feeInvoice.findFirst({ where: { id: data.invoiceId, schoolId } });
+    if (!invoice) throw new Error("Invoice not found");
     const payment = await tx.feePayment.create({ data: { schoolId, invoiceId: data.invoiceId, ... } });
```

**AFTER — Replay:** `RESULT: REJECTED — Invoice not found`
**AFTER — Route-level:** `POST /api/fees?action=payment` (foreign invoiceId) → **HTTP 500** (rejection)

**AFTER — Database proof:**
```sql
SELECT id, paid_amount, status FROM fee_invoices WHERE id = 'fixture_inv_b1';
SELECT count(*) FROM fee_payments WHERE invoice_id = 'fixture_inv_b1';
```
```
FOREIGN INVOICE UNCHANGED: {"id":"fixture_inv_b1","paid_amount":0,"status":"PENDING"}; payments: 0
```

**Why it fails now:** the invoice lookup is school-scoped; a foreign invoice returns 0 rows → throw before any write.

---

## H5 — PATCH /api/attendance/sessions/[id]: cross-tenant session close

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request (route-level, HTTP):**
```
PATCH /api/attendance/sessions/fixture_sess_b1   body={"status":"CLOSED"}
```

**BEFORE — Pre-fix code (audit snapshot, src/app/api/attendance/sessions/[id]/route.ts):**
```ts
const session = await withRls(rc, async (tx) =>
  tx.attendanceSession.update({
    where: { id },                     // ← no school validation
    data: { status: "CLOSED", closedAt: new Date(), updatedBy: authCtx.userId },
  })
);
```

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
UPDATE attendance_sessions SET status = 'CLOSED', closed_at = now(), updated_by = 'seed_user_admin' WHERE id = 'fixture_sess_b1';
SELECT id, status FROM attendance_sessions WHERE id = 'fixture_sess_b1';
ROLLBACK;
```

**BEFORE — Rows:**
```
UPDATE affected rows: 1
ROW INSIDE TRANSACTION: {"id":"fixture_sess_b1","status":"CLOSED"}
ROW AFTER ROLLBACK: {"id":"fixture_sess_b1","status":"ACTIVE"}
```

**BEFORE — Response (pre-fix transcript):** `H5 attendanceSession.update(foreign id) -> OK, CLOSED` (real mutation; session was restored to ACTIVE by post-fix cleanup). Pre-fix HTTP response for this route: **NOT VERIFIED** (the route was fixed before any HTTP-level test; the service-level update is the captured pre-fix evidence).

**Code Diff (src/app/api/attendance/sessions/[id]/route.ts):**
```diff
   const session = await withRls(rc, async (tx) =>
-    tx.attendanceSession.update({
-      where: { id },
+    async (tx) => {
+      const existing = await tx.attendanceSession.findFirst({
+        where: { id, schoolId: authCtx.schoolId },
+      });
+      if (!existing) throw new Error('Attendance session not found');
+      return tx.attendanceSession.update({
+        where: { id },
```

**AFTER — Replay (identical HTTP request):**
```
REQUEST: PATCH /api/attendance/sessions/fixture_sess_b1  body={status:CLOSED}
RESPONSE: HTTP 500 body={"success":false,"error":{"code":"INTERNAL","message":"An unexpected error occurred"}}
```

**AFTER — Database proof:**
```sql
SELECT id FROM attendance_sessions WHERE id = 'fixture_sess_b1' AND school_id = 'seed_school_ea';
SELECT id, status FROM attendance_sessions WHERE id = 'fixture_sess_b1';
```
```
GUARD SQL ROWS: 0
FOREIGN SESSION UNCHANGED: {"id":"fixture_sess_b1","status":"ACTIVE"}
```

**Why it fails now:** the guard findFirst is school-scoped → 0 rows for the foreign session → throw before update; the session remains ACTIVE.

---

## H6 — bulkMarkAttendance with client-supplied schoolId

Full standalone treatment in **Deliverable 5**.

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b` (via payload)

**BEFORE — Request:** `bulkMarkAttendance({ schoolId: 'fixture_school_b', classId: 'fixture_cls_b_g01', date, records: [{ studentMembershipId: 'fixture_mem_b_stu', status: 'PRESENT' }] }, authCtx=School A, ctx)`

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
INSERT INTO attendance_records (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, marked_at, is_deleted, created_by, created_at, updated_at)
  VALUES ('evid_att_h6', 'fixture_school_b', 'fixture_cls_b_g01', 'fixture_mem_b_stu', '2026-08-01', 'PRESENT', 'seed_mem_admin', now(), false, 'seed_user_admin', now(), now());
SELECT count(*) FROM attendance_records WHERE school_id = 'fixture_school_b';
ROLLBACK;
```

**BEFORE — Rows:**
```
ATTENDANCE ROWS FOR School B INSIDE TRANSACTION: 1
ATTENDANCE ROWS FOR School B AFTER ROLLBACK: 0
```

**BEFORE — Response (pre-fix transcript):** `H6 bulkMarkAttendance(schoolId=B via client) -> OK, wrote 1 row` (real write to School B; row deleted by post-fix cleanup)

**AFTER — Replay:** `RESULT: REJECTED — School mismatch: operation scoped to authenticated school only`
**AFTER — Database proof:**
```sql
SELECT count(*) FROM attendance_records WHERE school_id = 'fixture_school_b'
```
```
SCHOOL B ATTENDANCE ROWS: 0
```

**Why it fails now:** service assertion `input.schoolId !== authCtx.schoolId` rejects at the boundary; the action layer additionally derives schoolId from the session (Deliverable 5).

---

## M1 — createInvoice(studentId): cross-tenant invoice creation

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `createInvoice('seed_school_ea', { studentId: 'fixture_stu_b1', totalAmount: 2500, dueDate: '2026-09-15' }, ctx)`

**BEFORE — Pre-fix code (audit snapshot):**
```ts
export async function createInvoice(schoolId, data, rc) {
  return withRls(rc, async (tx) => {
    const count = await tx.feeInvoice.count({ where: { schoolId } });
    const invoiceNo = `INV-${...}`;
    return tx.feeInvoice.create({ data: { schoolId, invoiceNo, ...data } });  // studentId never validated
  });
}
```

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
INSERT INTO fee_invoices (id, school_id, student_id, invoice_no, total_amount, due_date, status, created_at, updated_at)
  VALUES ('evid_inv_m1', 'seed_school_ea', 'fixture_stu_b1', 'INV-EVID-M1', 2500, '2026-09-15', 'PENDING', now(), now());
SELECT id, school_id, student_id, invoice_no FROM fee_invoices WHERE id = 'evid_inv_m1';
ROLLBACK;
```

**BEFORE — Rows:**
```
ROW INSIDE TRANSACTION (invoice in School A, student in School B): {"id":"evid_inv_m1","school_id":"seed_school_ea","student_id":"fixture_stu_b1","invoice_no":"INV-EVID-M1"}
ROW AFTER ROLLBACK: 0
```

**BEFORE — Response (pre-fix transcript):** `M1 createInvoice(A, foreign studentId) -> OK, created cmsbhrj8h0003zcu855rfmp0o` (real contaminated invoice; deleted by post-fix cleanup)

**Code Diff (src/services/fee.service.ts):**
```diff
 export async function createInvoice(schoolId, data, rc) {
   return withRls(rc, async (tx) => {
+    const student = await tx.student.findFirst({ where: { id: data.studentId, schoolId } });
+    if (!student) throw new Error("Student not found");
     const count = await tx.feeInvoice.count({ where: { schoolId } });
```

**AFTER — Replay:** `RESULT: REJECTED — Student not found`
**AFTER — Route-level:** `POST /api/fees` (foreign studentId) → **HTTP 500** (rejection)
**AFTER — Database proof:**
```sql
SELECT count(*) FROM fee_invoices WHERE student_id = 'fixture_stu_b1' AND school_id = 'seed_school_ea'
```
```
SCHOOL A INVOICES ON FOREIGN STUDENT: 0
```

**Why it fails now:** student guard is school-scoped → 0 rows → throw before create.

---

## M2 — createFeeStructure(categoryId/classId): cross-tenant fee structure + session classId

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `createFeeStructure('seed_school_ea', { categoryId: <School A cat>, classId: 'fixture_cls_b_g01', amount: 1000 }, ctx)` (and independently, sessions POST with `classId: fixture_cls_b_g01`)

**BEFORE — Pre-fix code (audit snapshot):**
```ts
export async function createFeeStructure(schoolId, data, rc) {
  return withRls(rc, (tx) => tx.feeStructure.create({ data: { schoolId, ...data } }));  // categoryId/classId never validated
}
```

**BEFORE — SQL executed (literal, transactional repro):**
```sql
BEGIN;
INSERT INTO fee_structures (id, school_id, category_id, class_id, amount, frequency, is_active, created_at, updated_at)
  VALUES ('evid_fs_m2', 'seed_school_ea', 'fixture_cat_b1', 'fixture_cls_b_g01', 1000, 'MONTHLY', true, now(), now());
SELECT id, school_id, category_id, class_id, amount FROM fee_structures WHERE id = 'evid_fs_m2';
ROLLBACK;
```

**BEFORE — Rows:**
```
ROW INSIDE TRANSACTION (structure in School A, category+class in School B): {"id":"evid_fs_m2","school_id":"seed_school_ea","category_id":"fixture_cat_b1","class_id":"fixture_cls_b_g01","amount":1000}
ROW AFTER ROLLBACK: 0
```

**BEFORE — Response (pre-fix transcript):** `M2 createFeeStructure(A, foreign classId) -> OK, created cmsbhrjv80005zcu8g8ke3zf2` (real contaminated structure; deleted by cleanup)

**Code Diff (src/services/fee.service.ts + sessions POST route):**
```diff
 export async function createFeeStructure(schoolId, data, rc) {
   return withRls(rc, async (tx) => {
+    const category = await tx.feeCategory.findFirst({ where: { id: data.categoryId, schoolId } });
+    if (!category) throw new Error("Fee category not found");
+    if (data.classId) {
+      const cls = await tx.class.findFirst({ where: { id: data.classId, schoolId } });
+      if (!cls) throw new Error("Class not found");
+    }
     return tx.feeStructure.create({ data: { schoolId, ...data } });
```
sessions POST (src/app/api/attendance/sessions/route.ts:27-31): `const cls = await tx.class.findFirst({ where: { id: parsed.classId, schoolId: authCtx.schoolId } }); if (!cls) throw new Error('Class not found');`

**AFTER — Replay:** `RESULT: REJECTED — Class not found`
**AFTER — Route-level:** `POST /api/attendance/sessions` (foreign classId) → **HTTP 500** (rejection)
**AFTER — Database proof:**
```sql
SELECT count(*) FROM fee_structures WHERE class_id = 'fixture_cls_b_g01'
```
```
FEE STRUCTURES ON FOREIGN CLASS: 0
```

**Why it fails now:** category/class guards are school-scoped → throw before create.

---

## M3 — Promotion failure detail: cross-tenant PII leak

Full standalone treatment in **Deliverable 6**.

**Authenticated School:** `seed_school_ea`  **Target School:** `fixture_school_b`

**BEFORE — Request:** `runPromotionBatch({ schoolId: 'seed_school_ea', fromAcademicYearId: 'seed_ay_2526', toAcademicYearId: 'seed_ay_2627', items: [{ studentId: 'fixture_stu_b1', action: 'PROMOTE' }] }, authCtx, ctx)`

**BEFORE — SQL executed (pre-fix detail query, literal):**
```sql
SELECT id, first_name, last_name, admission_number FROM students
WHERE id IN ('fixture_stu_b1')              -- NO school predicate
```
```
LEAKED ROWS RETURNED: 1
{"id":"fixture_stu_b1","first_name":"Bharat","last_name":"Vasan","admission_number":"FIXADM0001"}
```

**BEFORE — Response (pre-fix transcript):** failure detail contained `studentName: "Bharat Vasan"`, `admissionNumber: "FIXADM0001"`, `currentClass` — leaked foreign PII.

**Code Diff (src/services/promotion/promotion-service.ts:220-225):**
```diff
     if (missingIds.length > 0) {
       const rows = await tx.student.findMany({
-        where: { id: { in: missingIds } },
+        where: { id: { in: missingIds }, schoolId: input.schoolId },
         select: { id: true, firstName: true, lastName: true, admissionNumber: true },
       });
```

**AFTER — Replay:**
```
FAILURE DETAIL: {"studentId":"fixture_stu_b1","studentName":"—","admissionNumber":"—","currentClass":"—","currentSection":"—","reason":"No active enrollment in the selected academic year","action":"RETRY","attemptedAction":"PROMOTE"}
LEAKED FIELDS PRESENT: {"hasName":false,"hasAdmission":false}
```

**AFTER — Database proof:**
```sql
SELECT id FROM students WHERE id = 'fixture_stu_b1' AND school_id = 'seed_school_ea'
```
```
rows = 0 → details render '—'
```

**Why it fails now:** the detail query is school-scoped → foreign student rows don't resolve → placeholders render instead of PII.

---

# DELIVERABLE 4A — L1–L4: REMEDIATION RECORD (route-layer inline-Prisma findings)

L1–L4 were found open during evidence assembly (Section 2 of `phase1.5-http.txt`): all four are routes with inline Prisma that accepted client-supplied identifiers without school validation and returned **HTTP 201** with foreign-tenant rows created. All four were fixed on 2026-08-02 and re-verified by replaying the **identical requests** against the fixed code — every replay returned **HTTP 403** and created no rows. A positive control proves legitimate in-school writes still succeed.

Post-fix artifact: `docs/evidence/phase1.5-http-after-l14.txt` (identical replays + positive control, logged 2026-08-02).

## L1 — `POST /api/library` borrow + return (Library)

**BEFORE (open):**
```
REQUEST: POST /api/library?action=borrow body={bookId:fixture_book_b1,studentId:fixture_stu_b1,dueDate:2026-09-01}
RESPONSE: HTTP 201 ... "status":"BORROWED"   (schoolId seed_school_ea; book availability decremented)
```
Pre-fix handler (audit snapshot): created `bookBorrowing` from `body.bookId`/`body.studentId` and ran `book.update({ available: decrement })` with **no school check** on either identifier.

**Fix (`src/app/api/library/route.ts`):** borrow now asserts, inside `withRls`, that `book` exists with `{ id, schoolId: authCtx.schoolId }` and `student` exists with `{ id, schoolId: authCtx.schoolId }` (and `available >= 1`) before create + decrement. Return now asserts `bookBorrowing` exists with `{ id, schoolId: authCtx.schoolId }` before update + increment. Failures throw `AuthorizationError` → HTTP 403.

**AFTER (identical replays, `phase1.5-http-after-l14.txt`):**
```
REQUEST: POST /api/library?action=borrow body={bookId:fixture_book_b1,studentId:fixture_stu_b1,dueDate:2026-09-01}
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Book not found in this school"}}

REQUEST: POST /api/library?action=return body={borrowingId:fixture_brw_b1}   (real foreign BORROWED row, created as fixture)
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Borrowing not found in this school"}}
```
**Database proof:** `fixture_book_b1.available` unchanged at 3; foreign `book_borrowings` count 0 after cleanup; the target foreign row `fixture_brw_b1` remained `BORROWED` (not RETURNED).

## L2 — `POST /api/timetable` create (Timetable)

**BEFORE (open):**
```
REQUEST: POST /api/timetable body={classId:fixture_cls_b_g01,subjectId:fixture_sub_b_math,dayOfWeek:1,startTime:09:00,endTime:09:40}
RESPONSE: HTTP 201 ... "classId":"fixture_cls_b_g01","subjectId":"fixture_sub_b_math"   (row created with schoolId seed_school_ea)
```

**Fix (`src/app/api/timetable/route.ts`):** create now asserts `class` `{ id, schoolId }`, optional `section` `{ id, schoolId, classId }`, `subject` `{ id, schoolId }`, and optional `teacher` membership `{ id, schoolId }` before insert.

**AFTER (identical replay):**
```
REQUEST: POST /api/timetable body={classId:fixture_cls_b_g01,subjectId:fixture_sub_b_math,dayOfWeek:1,startTime:09:00,endTime:09:40}
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Class not found in this school"}}
```
**Database proof:** `timetables` where `class_id = 'fixture_cls_b_g01'` count 0.

## L3 — `POST /api/transport?action=assignment` create (Transport)

**BEFORE (open):**
```
REQUEST: POST /api/transport?action=assignment body={studentId:fixture_stu_b1}
RESPONSE: HTTP 201 ... "studentId":"fixture_stu_b1"   (row created with schoolId seed_school_ea)
```

**Fix (`src/app/api/transport/route.ts`):** assignment create now asserts `student` `{ id, schoolId }`, optional `route` `{ id, schoolId }`, optional `vehicle` `{ id, schoolId }` before insert.

**AFTER (identical replay):**
```
REQUEST: POST /api/transport?action=assignment body={studentId:fixture_stu_b1}
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Student not found in this school"}}
```
**Database proof:** `transport_assignments` where `student_id = 'fixture_stu_b1'` count 0.

## L4 — `POST /api/class-assignments` create + `DELETE` archive (Class Assignments)

**BEFORE (open):**
```
REQUEST: POST /api/class-assignments body={classId:fixture_cls_b_g01,teacherMembershipId:fixture_mem_b_stu,role:PRIMARY}
RESPONSE: HTTP 201 ... "classId":"fixture_cls_b_g01","teacherMembershipId":"fixture_mem_b_stu"   (row created with schoolId seed_school_ea)
```
DELETE vector was static-only at assembly time (unscoped `update({ id })` archive).

**Fix (`src/app/api/class-assignments/route.ts`):** POST now asserts `class` `{ id, schoolId: ac.schoolId }` and `teacherMembership` `{ id, schoolId: ac.schoolId }` before the upsert; the `existing` lookup is now also scoped `schoolId: ac.schoolId`. DELETE now asserts the assignment exists with `{ id, schoolId: rc.schoolId }` before archiving.

**AFTER (identical replays):**
```
REQUEST: POST /api/class-assignments body={classId:fixture_cls_b_g01,teacherMembershipId:fixture_mem_b_stu,role:PRIMARY}
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Class not found in this school"}}

REQUEST: DELETE /api/class-assignments?id=fixture_ca_b1   (real foreign ACTIVE row, created as fixture)
RESPONSE: HTTP 403 {"success":false,"error":{"code":"FORBIDDEN","message":"Assignment not found in this school"}}
```
**Database proof:** `class_assignments` where `class_id = 'fixture_cls_b_g01'` count 0 after cleanup; the target foreign row `fixture_ca_b1` remained `ACTIVE` (not archived).

## Positive control — the fix rejects foreign rows, not legitimate writes

```
REQUEST: POST /api/library (create book, own school)           RESPONSE: HTTP 201 (schoolId seed_school_ea)
REQUEST: GET /api/students (first School A student id=seed_stu_001296)   RESPONSE: HTTP 200
REQUEST: POST /api/library?action=borrow body={bookId:<own>,studentId:seed_stu_001296,dueDate:2026-09-01}   RESPONSE: HTTP 201
REQUEST: POST /api/library?action=return body={borrowingId:<own>}   RESPONSE: HTTP 200 ("status":"RETURNED")
```
Control rows were deleted post-run (book delete cascades its borrowings); DB re-verified clean (0 leftover, `fixture_book_b1` back to 3/3).

---

# DELIVERABLE 5 — H6: CLIENT-SUPPLIED schoolId (standalone proof)

## Pre-fix code — where schoolId came directly from the client

`src/actions/attendance.ts` (git diff against HEAD, authoritative before-lines):
```ts
// BEFORE (HEAD):
export async function bulkMarkAttendanceAction(data: { ... }) {
  const authCtx = await getCtx();
  await requirePermission(authCtx, 'attendance_records', 'create');
  const ctx = toRequestContext(authCtx);
  await bulkMarkAttendance(data, authCtx, ctx);   // ← data.schoolId passed straight through
  revalidatePath('/dashboard/teacher/attendance');
}
```
The client form submits `{ schoolId, classId, date, records }`; the action forwarded `data.schoolId` untouched, and the service INSERTed with `schoolId: input.schoolId` (src/services/attendance/attendance-service.ts, pre-fix).

## Exploit — Authenticated: School A. Payload:
```json
{
  "schoolId": "fixture_school_b",
  "classId": "fixture_cls_b_g01",
  "date": "2026-08-01",
  "records": [ { "studentMembershipId": "fixture_mem_b_stu", "status": "PRESENT" } ]
}
```

**Request:** `bulkMarkAttendance(payload, authCtx=School A, ctx)`
**Response (pre-fix transcript):** `OK, wrote 1 row`

**Database query (literal, transactional repro):**
```sql
BEGIN;
INSERT INTO attendance_records (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, marked_at, is_deleted, created_by, created_at, updated_at)
  VALUES ('evid_att_h6', 'fixture_school_b', 'fixture_cls_b_g01', 'fixture_mem_b_stu', '2026-08-01', 'PRESENT', 'seed_mem_admin', now(), false, 'seed_user_admin', now(), now());
SELECT count(*) FROM attendance_records WHERE school_id = 'fixture_school_b';
ROLLBACK;
```
**Database result:**
```
ATTENDANCE ROWS FOR School B INSIDE TRANSACTION: 1
ATTENDANCE ROWS FOR School B AFTER ROLLBACK: 0
```

## Fix — code deriving authCtx.schoolId instead (git diff):
```diff
-  await bulkMarkAttendance(data, authCtx, ctx);
+  // Phase 1.5 tenant isolation: schoolId is NEVER client-supplied; it is
+  // derived from the authenticated session.
+  await bulkMarkAttendance({ ...data, schoolId: authCtx.schoolId }, authCtx, ctx);
```
(same pattern for `markAttendanceAction`)

Plus defense-in-depth at the service boundary (src/services/attendance/attendance-service.ts:209-214):
```ts
if (input.schoolId !== authCtx.schoolId) {
  throw new Error('School mismatch: operation scoped to authenticated school only');
}
```

## Re-test — identical exploit payload:
```
RESULT: REJECTED — School mismatch: operation scoped to authenticated school only
```
**Database query:**
```sql
SELECT count(*) FROM attendance_records WHERE school_id = 'fixture_school_b'
```
**Database result:** `SCHOOL B ATTENDANCE ROWS: 0`

**Confirm the client can no longer influence tenant selection:** the service now rejects any call whose `schoolId` differs from the session school, regardless of payload; the action layer overwrites `data.schoolId` with `authCtx.schoolId` before the service is reached.

---

# DELIVERABLE 6 — M3: PROMOTION PII LEAK (standalone proof)

**BEFORE — Promotion request:** `runPromotionBatch({ schoolId: 'seed_school_ea', fromAcademicYearId: 'seed_ay_2526', toAcademicYearId: 'seed_ay_2627', items: [{ studentId: 'fixture_stu_b1', action: 'PROMOTE' }] }, ...)`

**BEFORE — Failure response (pre-fix transcript, 2026-08-01):** the failed item carried the foreign student's details — leaked fields:
- `studentName: "Bharat Vasan"`
- `admissionNumber: "FIXADM0001"`
- `currentClass` (foreign class name)

**BEFORE — SQL that produced the leak (literal):**
```sql
SELECT id, first_name, last_name, admission_number FROM students
WHERE id IN ('fixture_stu_b1')     -- NO school predicate
```
```
LEAKED ROWS RETURNED: 1
{"id":"fixture_stu_b1","first_name":"Bharat","last_name":"Vasan","admission_number":"FIXADM0001"}
```

**Code Diff (src/services/promotion/promotion-service.ts):**
```diff
-        where: { id: { in: missingIds } },
+        where: { id: { in: missingIds }, schoolId: input.schoolId },
```

**AFTER — Replay identical request, actual response:**
```
FAILURE DETAIL: {"studentId":"fixture_stu_b1","studentName":"—","admissionNumber":"—","currentClass":"—","currentSection":"—","reason":"No active enrollment in the selected academic year","action":"RETRY","attemptedAction":"PROMOTE"}
```

**Confirm foreign PII is removed/redacted/replaced:** `hasName:false, hasAdmission:false` — the name and admission number are replaced by `—` placeholders; no foreign PII is present.

---

# DELIVERABLE 7 — PHASE D: LOW-RISK RUNTIME SPOT CHECKS

| Service | Why LOW | Cross-Tenant Request | Runtime Response | Database Proof | Result |
|---------|---------|----------------------|------------------|----------------|--------|
| Students (by-id route) | by-id GET is a well-covered code path with explicit `where: { id, schoolId }` | `GET /api/students/fixture_stu_b1` (foreign id) | HTTP 404 `{"success":false,"error":{"code":"NOT_FOUND","message":"Student not found"}}` | (route returns before any read; School B student row untouched — verified in cleanup run: `fixture_stu_b1` intact) | SAFE |
| Students (list param spoof) | list route ignores client params for tenant | `GET /api/students?schoolId=fixture_school_b` | HTTP 200, `firstItem.schoolId=seed_school_ea` (param ignored; session school used) | School B rows never returned | SAFE |
| Attendance (GET) | schoolId predicate + validation SQL covered in H6 tests | `GET /api/attendance?classId=fixture_cls_b_g01&date=2026-08-01` (foreign class) | HTTP 200 `{"success":true,"data":[]}` | `SELECT count(*) FROM attendance_records WHERE school_id='fixture_school_b'` → 0 | SAFE |
| Sessions (GET) | list scoped by authCtx.schoolId | `GET /api/attendance/sessions?classId=fixture_cls_b_g01` (foreign class) | HTTP 200 `{"success":true,"data":[]}` | no rows for foreign class in School A; School B session untouched | SAFE |
| Raw SQL site A1/A2 (attendance-service) | school-scoped `$6` predicates; foreign ids resolve NULL | (Phase 1 post-fix probes: foreign membership/class → rejection) | REJECTED (Case C) | 0 rows inserted; runtime.txt H6 section shows 0 School B rows | SAFE |

Minimum satisfied: 4 LOW-risk services runtime-tested above (Students, Attendance GET, Sessions GET, raw-SQL sites).

---

# DELIVERABLE 8 — DISCOVERY METHOD

| Issue | Discovery Method | Would Static Review Alone Have Found It? | Runtime Required? |
|-------|------------------|-------------------------------------------|-------------------|
| H1 | Static (Phase B service audit) → runtime confirm | YES (by-id lookup without school filter is visible in code) | YES (proved reachability + Case D) |
| H2 | Static (Phase B service audit) → runtime confirm | YES | YES |
| H3 | Static (Phase B service audit) → runtime confirm | YES | YES |
| H4 | Static (Phase B service audit) → runtime confirm | YES | YES (proved real write + contamination) |
| H5 | Static (route audit: PATCH handler) → runtime confirm | YES | YES (proved real write) |
| H6 | Static (action layer audit: client param passthrough) → runtime confirm | YES | YES (proved tenant selection influence) |
| M1 | Static (service audit: create without identifier validation) → runtime confirm | YES | YES |
| M2 | Static (service audit) → runtime confirm | YES | YES |
| M3 | Runtime first (pre-fix batch run returned leaked detail); static root-cause after | NO — leak existed only in a response shape; static review alone flagged the unscoped detail query as suspicious, but the exploit was proven by runtime | YES |
| L1 (Library) | Static (route sweep during evidence assembly) → runtime confirm | YES | YES (proved 201 + availability decrement; fixed → 403 replay) |
| L2 (Timetable) | Static (route sweep) → runtime confirm | YES | YES (proved 201; fixed → 403 replay) |
| L3 (Transport) | Static (route sweep) → runtime confirm | YES | YES (proved 201; fixed → 403 replay) |
| L4 (Class assignments) | Static (route sweep) → runtime confirm | YES | YES (proved 201; DELETE vector now runtime-verified too — both fixed → 403 replays) |

**Could this methodology reasonably detect a tenth vulnerability of the same class?** Yes — and it did: the same method (route-layer sweep for client-supplied identifiers without school validation) surfaced L1–L4 during evidence assembly, and runtime testing confirmed all four.

**Limitations (explicit):**
1. The Phase B sweep originally covered `src/services/**`; routes with inline Prisma (library, transport, timetable, class-assignments) were not swept at that time — this gap is why L1–L4 were missed in the first pass. Any route not re-swept after this package could still harbor the pattern.
2. Dead code (≈30 exported service functions with zero callers) is not runtime-tested; if wired later without validation, the class reappears.
3. L1-return (unscoped `bookBorrowing.update` by id) and L4-DELETE (unscoped archive) were initially static-only (**NOT VERIFIED**); both were closed by the L1/L4 fixes and are now runtime-verified — each returns HTTP 403 against a real foreign row (Deliverable 4A).
4. RLS is disabled; `withRls` does not filter. A new code path that omits school predicates bypasses nothing and is only as safe as its where-clauses.
5. Runtime testing used fixture tenants (`fixture_*`) and transactional ROLLBACK reproductions; real-world data shapes may differ.

---

# DELIVERABLE 9 — RLS DEFERRAL

During Phase 1.5 we identified multiple real cross-tenant vulnerabilities in application-layer authorization. Every identified issue was fixed and re-verified through runtime testing.

Database Row Level Security remains intentionally deferred and is not currently enforcing tenant isolation.

Tenant isolation presently depends on application-layer validation.

RLS remains the planned defense-in-depth layer because it protects against future authorization mistakes that application code alone cannot guarantee.

*This statement stands separate from the dead-code inventory, the RLS deferral itself, and cosmetic/cleanup items listed elsewhere in this package.*

---

# DELIVERABLE 10 — FINAL EVIDENCE SUMMARY

## Q1 — Was Attendance the only vulnerable module?

**NO.** Attendance was not the only vulnerable module. Runtime-confirmed same-class findings exist in Exams (H1, H2, H3), Fees (H4, M1, M2), Sessions (H5), the Attendance action itself (H6), Promotion (M3), and — confirmed during evidence assembly — Library (L1), Timetable (L2), Transport (L3), and Class Assignments (L4). Evidence: pre-fix transcript (2026-08-01) + today's literal SQL reproductions and HTTP 201 responses in `docs/evidence/phase1.5-http.txt` lines 38-49; all 13 remediated and re-verified (Deliverables 4, 4A).

## Q2 — Exactly how many runtime-confirmed P0 vulnerabilities were found?

**7** — H1, H2, H3, H4, H5, H6 (6, from the original audit) plus **L1** (Library borrow: foreign book availability decrement — a direct cross-tenant write to foreign state, HTTP 201). Runtime-confirmed MEDIUM-class findings: **6** — M1, M2, M3, L2, L3, L4-POST. Total identified: **13 findings**. (Post-audit notes, per the canonical table in `docs/phase1.6-evidence-package.md` Phase 7 Q2: findings vs vectors are counted separately — these 13 findings span **15 vectors** (L1 = borrow + return, L4 = POST + DELETE); under the formalized Phase 3 rubric L4-DELETE and L1-return are reclassified **HIGH** as direct modifications of foreign-owned rows; the Phase 1.6 audit additionally found and fixed N1–N13 — 21 further vectors. Full counts: **36 vectors (24 HIGH, 12 MEDIUM, 0 LOW), 0 open** — see the canonical table.)

## Q3 — Exactly how many were fixed?

**13** — H1, H2, H3, H4, H5, H6, M1, M2, M3 (Deliverable 4) and L1–L4 including their return/DELETE vectors (Deliverable 4A). Each re-verified by replaying the identical request against fixed code: H/M rejections → HTTP 500, L1–L4 rejections → HTTP 403, all with unchanged DB state (this document, runtime.txt, http-after-l14.txt).

## Q4 — Exactly how many remain open?

**0.** L1–L4 were fixed on 2026-08-02 and every identical replay returned HTTP 403 with no rows created; the two vectors previously static-only (L1-return, L4-DELETE) were closed by the same fixes and are now runtime-verified against real foreign rows (Deliverable 4A). Evidence rows from both test rounds were deleted and foreign data verified intact (cleanup-verify runs).

## Q5 — Which conclusions come from runtime evidence vs static analysis?

- **Runtime evidence:** H1–H6 and M1–M3 rejection post-fix (identical replay); L1–L4 rejection post-fix (identical replay, `phase1.5-http-after-l14.txt`); positive control (own-school borrow/return 201/200); pre-fix Case D transcripts; L1–L4 pre-fix HTTP 201; LOW spot checks; DB state checks (foreign rows unchanged, evidence rows removed).
- **Static analysis only:** scoping of Subjects, Staff, Academic Years, Classes, Sections, Dashboard, Parent, School Settings, Super-Admin (all read-schoolId-predicates from code, none runtime-tested); dead-code inventory (≈30 unwired functions); raw-SQL inventory sites A3/A4/A5.

## Q6 — Discrepancy vs the previous summary ("9 remediated")?

The previous count "9 remediated" was correct at the time but the accompanying claim "no known reachable cross-tenant vector remains" was wrong: the route sweep during evidence assembly surfaced 4 further same-class findings (L1–L4), all runtime-confirmed as open. This package records the total as **13** (H1–H6 + M1–M3 + L1–L4). All 13 are now fixed and re-verified by identical replays. The initial gap was coverage: Phase B swept `src/services/**`; routes with inline Prisma (library, transport, timetable, class-assignments) were not swept until this package.

## Q7 — Can Phase 1 be frozen?

**READY WITH EXPLICIT TECHNICAL DEBT** — superseded in wording by `docs/phase1.6-evidence-package.md` Phase 7 Q7, which states **PASS (Mutating Paths Verified)** with the Phase 1.6B integrity statement.

Justification, from the evidence above only:
- All 13 identified cross-tenant findings (H1–H6, M1–M3, L1–L4) are fixed. Every fix is re-verified by replaying the identical pre-fix request: H/M replays → HTTP 500 with unchanged DB state (Deliverable 4); L1–L4 replays → HTTP 403 with no rows created, including the previously static-only return/DELETE vectors (Deliverable 4A). Positive control confirms legitimate in-school writes still succeed.
- No runtime-confirmed reachable vector remains open (Q4: 0).
- **Phase 1.6 completing audit (2026-08-02, `docs/phase1.6-evidence-package.md`):** full route-level inventory of the entire `src/app/api/**` surface (41 files, every route exactly once), which found and fixed N1–N13 (21 further vectors — unscoped PATCH/DELETE/archive handlers in terms/classes/sections/subjects/academic-years/students and cross-tenant reference creation in create/assign handlers). All 21 replayed identical requests → HTTP 403/404. Freeze verdict re-affirmed with 0 open findings.

**Explicit technical debt carried into the freeze (unchanged):**
- **RLS deferred** (Deliverable 9): tenant isolation is application-layer only; `withRls` does not filter.
- **Dead code** (~30 unwired service functions) is not runtime-tested; wiring them without validation could reintroduce the defect class.
- **Rejection semantics are coarse**: fixed H/M routes return HTTP 500 (generic INTERNAL) rather than a scoped 4xx; L1–L4 return HTTP 403.
- Modules whose scoping is static-only (Subjects, Staff, Academic Years, Classes, Sections, Dashboard, Parent, School Settings, Super-Admin) have not been runtime-tested against foreign identifiers.
- The Phase B sweep covered `src/services/**` and all current inline-Prisma routes; any future route must re-apply the same school-validation pattern (or RLS must be enabled).

---

*This document supersedes `docs/phase1.5-tenant-audit.md` as the canonical Phase 1.5 security audit. Raw artifacts: `docs/evidence/phase1.5-runtime.txt`, `docs/evidence/phase1.5-http.txt`, `docs/evidence/phase1.5-http-after-l14.txt`.*
