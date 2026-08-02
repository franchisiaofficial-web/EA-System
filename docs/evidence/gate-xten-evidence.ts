import 'dotenv/config';
import { writeFileSync } from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { getExamResults, getStudentResults, upsertResult } from '../src/services/exam.service';
import { createInvoice, createFeeStructure, createFeeCategory, recordPayment } from '../src/services/fee.service';
import { runPromotionBatch } from '../src/services/promotion/promotion-service';
import { bulkMarkAttendance } from '../src/services/attendance/attendance-service';
import { withRls, buildContext, type RequestContext } from '../src/lib/prisma/rls-middleware';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const A = 'seed_school_ea';
const B = 'fixture_school_b';
const DATE = new Date('2026-08-01');

const authCtx = {
  userId: 'seed_user_admin',
  email: 'admin@easystem.dev',
  membershipId: 'seed_mem_admin',
  schoolId: A,
  role: 'SCHOOL_ADMIN',
  schoolStatus: 'ACTIVE',
};
const ctx: RequestContext = buildContext(authCtx.userId, {
  id: authCtx.membershipId,
  schoolId: authCtx.schoolId,
  role: authCtx.role,
});

const out: string[] = [];
const log = (s: string) => { out.push(s); console.log(s); };

async function q<T = Array<Record<string, unknown>>>(sql: string, ...args: unknown[]): Promise<T> {
  return p.$queryRawUnsafe<T>(sql, ...args);
}

async function main() {
  log('EA SYSTEM - PHASE 1.5 EVIDENCE PACKAGE - SERVICE-LEVEL RUNTIME');
  log('Run: 2026-08-02  Actor: School A admin  Target: School B fixture data');
  log('');

  // ════════════════ BEFORE — literal SQL the PRE-FIX code executed ════════════════
  log('====================================================================');
  log('SECTION 1: BEFORE — literal vulnerable SQL (no school predicate)');
  log('====================================================================');
  log('');

  log('--- H1 BEFORE: getExamResults(examId) — pre-fix Prisma query had NO school filter ---');
  log('SQL: SELECT er.id, er.school_id, er.exam_id, er.marks_obtained, er.grade, s.first_name, s.last_name, s.admission_number');
  log('     FROM exam_results er LEFT JOIN students s ON s.id = er.student_id');
  log("     WHERE er.exam_id = 'fixture_exam_b'  [NO school predicate]");
  const h1b = await q(`select er.id, er.school_id, er.exam_id, er.marks_obtained, er.grade,
                              s.first_name, s.last_name, s.admission_number
                       from exam_results er left join students s on s.id = er.student_id
                       where er.exam_id = 'fixture_exam_b'`);
  log(`ROWS RETURNED: ${h1b.length}`);
  for (const r of h1b) log('  ' + JSON.stringify(r));
  log('');

  log('--- H2 BEFORE: getStudentResults(studentId) — pre-fix Prisma query had NO school filter ---');
  log('SQL: SELECT er.id, er.school_id, er.exam_id, er.marks_obtained, e.name AS exam_name');
  log('     FROM exam_results er LEFT JOIN exams e ON e.id = er.exam_id');
  log("     WHERE er.student_id = 'fixture_stu_b1'  [NO school predicate]");
  const h2b = await q(`select er.id, er.school_id, er.exam_id, er.marks_obtained, e.name as exam_name
                       from exam_results er left join exams e on e.id = er.exam_id
                       where er.student_id = 'fixture_stu_b1'`);
  log(`ROWS RETURNED: ${h2b.length}`);
  for (const r of h2b) log('  ' + JSON.stringify(r));
  log('');

  log('--- H3 BEFORE: upsertResult() — pre-fix UPDATE had NO school predicate (transactional repro, ROLLBACK) ---');
  log("SQL: BEGIN;");
  log("     UPDATE exam_results SET marks_obtained = 99, grade = 'A+' WHERE id = 'fixture_res_b1';");
  log("     SELECT marks_obtained, grade FROM exam_results WHERE id = 'fixture_res_b1';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  const h3upd = await p.$executeRawUnsafe(`update exam_results set marks_obtained = 99, grade = 'A+' where id = 'fixture_res_b1'`);
  const h3mid = await q(`select marks_obtained, grade from exam_results where id = 'fixture_res_b1'`);
  log(`UPDATE affected rows: ${h3upd}`);
  log('ROW INSIDE TRANSACTION (mutation visible): ' + JSON.stringify(h3mid[0]));
  await p.$executeRawUnsafe('ROLLBACK');
  const h3after = await q(`select marks_obtained, grade from exam_results where id = 'fixture_res_b1'`);
  log('ROW AFTER ROLLBACK: ' + JSON.stringify(h3after[0]));
  log('');

  log('--- H4 BEFORE: recordPayment() — pre-fix created a School A payment on a School B invoice and mutated it (transactional repro, ROLLBACK) ---');
  log('SQL: BEGIN;');
  log("     INSERT INTO fee_payments (id, school_id, invoice_id, amount, method, paid_at, received_by, created_at)");
  log("       VALUES ('evid_pay_h4', 'seed_school_ea', 'fixture_inv_b1', 2000, 'CASH', now(), 'seed_user_admin', now());");
  log("     UPDATE fee_invoices SET paid_amount = paid_amount + 2000, status = 'PARTIAL' WHERE id = 'fixture_inv_b1';");
  log("     SELECT * FROM fee_payments WHERE invoice_id = 'fixture_inv_b1';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  await p.$executeRawUnsafe(`insert into fee_payments (id, school_id, invoice_id, amount, method, paid_at, received_by, created_at)
                             values ('evid_pay_h4', 'seed_school_ea', 'fixture_inv_b1', 2000, 'CASH', now(), 'seed_user_admin', now())`);
  await p.$executeRawUnsafe(`update fee_invoices set paid_amount = paid_amount + 2000, status = 'PARTIAL' where id = 'fixture_inv_b1'`);
  const h4pay = await q(`select id, school_id, invoice_id, amount, method from fee_payments where invoice_id = 'fixture_inv_b1'`);
  const h4inv = await q(`select id, paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`);
  log('PAYMENT ROW INSIDE TRANSACTION: ' + JSON.stringify(h4pay[0]));
  log('INVOICE INSIDE TRANSACTION: ' + JSON.stringify(h4inv[0]));
  await p.$executeRawUnsafe('ROLLBACK');
  const h4invAfter = await q(`select id, paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`);
  const h4payAfter = await q(`select count(*)::int as n from fee_payments where invoice_id = 'fixture_inv_b1'`);
  log('INVOICE AFTER ROLLBACK: ' + JSON.stringify(h4invAfter[0]));
  log(`PAYMENTS AFTER ROLLBACK: ${h4payAfter[0].n}`);
  log('');

  log('--- H5 BEFORE: PATCH session — pre-fix update had NO school predicate (transactional repro, ROLLBACK) ---');
  log('SQL: BEGIN;');
  log("     UPDATE attendance_sessions SET status = 'CLOSED', closed_at = now(), updated_by = 'seed_user_admin' WHERE id = 'fixture_sess_b1';");
  log("     SELECT id, status FROM attendance_sessions WHERE id = 'fixture_sess_b1';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  const h5upd = await p.$executeRawUnsafe(`update attendance_sessions set status = 'CLOSED', closed_at = now(), updated_by = 'seed_user_admin' where id = 'fixture_sess_b1'`);
  const h5mid = await q(`select id, status from attendance_sessions where id = 'fixture_sess_b1'`);
  log(`UPDATE affected rows: ${h5upd}`);
  log('ROW INSIDE TRANSACTION: ' + JSON.stringify(h5mid[0]));
  await p.$executeRawUnsafe('ROLLBACK');
  const h5after = await q(`select id, status from attendance_sessions where id = 'fixture_sess_b1'`);
  log('ROW AFTER ROLLBACK: ' + JSON.stringify(h5after[0]));
  log('');

  log('--- H6 BEFORE: bulkMarkAttendance with client-supplied schoolId=fixture_school_b (transactional repro, ROLLBACK) ---');
  log('SQL: BEGIN;');
  log("     INSERT INTO attendance_records (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, marked_at, is_deleted, created_by, created_at, updated_at)");
  log("       VALUES ('evid_att_h6', 'fixture_school_b', 'fixture_cls_b_g01', 'fixture_mem_b_stu', '2026-08-01', 'PRESENT', 'seed_mem_admin', now(), false, 'seed_user_admin', now(), now());");
  log("     SELECT count(*) FROM attendance_records WHERE school_id = 'fixture_school_b';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  await p.$executeRawUnsafe(`insert into attendance_records (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, marked_at, is_deleted, created_by, created_at, updated_at)
                             values ('evid_att_h6', 'fixture_school_b', 'fixture_cls_b_g01', 'fixture_mem_b_stu', '2026-08-01', 'PRESENT', 'seed_mem_admin', now(), false, 'seed_user_admin', now(), now())`);
  const h6mid = await q(`select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`);
  log(`ATTENDANCE ROWS FOR School B INSIDE TRANSACTION: ${h6mid[0].n}`);
  await p.$executeRawUnsafe('ROLLBACK');
  const h6after = await q(`select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`);
  log(`ATTENDANCE ROWS FOR School B AFTER ROLLBACK: ${h6after[0].n}`);
  log('');

  log('--- M1 BEFORE: createInvoice(schoolId=A, foreign studentId) (transactional repro, ROLLBACK) ---');
  log('SQL: BEGIN;');
  log("     INSERT INTO fee_invoices (id, school_id, student_id, invoice_no, total_amount, due_date, status, created_at, updated_at)");
  log("       VALUES ('evid_inv_m1', 'seed_school_ea', 'fixture_stu_b1', 'INV-EVID-M1', 2500, '2026-09-15', 'PENDING', now(), now());");
  log("     SELECT id, school_id, student_id, invoice_no FROM fee_invoices WHERE id = 'evid_inv_m1';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  await p.$executeRawUnsafe(`insert into fee_invoices (id, school_id, student_id, invoice_no, total_amount, due_date, status, created_at, updated_at)
                             values ('evid_inv_m1', 'seed_school_ea', 'fixture_stu_b1', 'INV-EVID-M1', 2500, '2026-09-15', 'PENDING', now(), now())`);
  const m1mid = await q(`select id, school_id, student_id, invoice_no from fee_invoices where id = 'evid_inv_m1'`);
  log('ROW INSIDE TRANSACTION (invoice in School A, student in School B): ' + JSON.stringify(m1mid[0]));
  await p.$executeRawUnsafe('ROLLBACK');
  const m1after = await q(`select count(*)::int as n from fee_invoices where id = 'evid_inv_m1'`);
  log(`ROW AFTER ROLLBACK: ${m1after[0].n}`);
  log('');

  log('--- M2 BEFORE: createFeeStructure(schoolId=A, foreign classId) (transactional repro, ROLLBACK) ---');
  log('SQL: BEGIN;');
  log("     INSERT INTO fee_structures (id, school_id, category_id, class_id, amount, frequency, is_active, created_at, updated_at)");
  log("       VALUES ('evid_fs_m2', 'seed_school_ea', 'fixture_cat_b1', 'fixture_cls_b_g01', 1000, 'MONTHLY', true, now(), now());");
  log("     SELECT id, school_id, category_id, class_id, amount FROM fee_structures WHERE id = 'evid_fs_m2';");
  log('     ROLLBACK;');
  await p.$executeRawUnsafe('BEGIN');
  await p.$executeRawUnsafe(`insert into fee_structures (id, school_id, category_id, class_id, amount, frequency, is_active, created_at, updated_at)
                             values ('evid_fs_m2', 'seed_school_ea', 'fixture_cat_b1', 'fixture_cls_b_g01', 1000, 'MONTHLY', true, now(), now())`);
  const m2mid = await q(`select id, school_id, category_id, class_id, amount from fee_structures where id = 'evid_fs_m2'`);
  log('ROW INSIDE TRANSACTION (structure in School A, category+class in School B): ' + JSON.stringify(m2mid[0]));
  await p.$executeRawUnsafe('ROLLBACK');
  const m2after = await q(`select count(*)::int as n from fee_structures where id = 'evid_fs_m2'`);
  log(`ROW AFTER ROLLBACK: ${m2after[0].n}`);
  log('');

  log('--- M3 BEFORE: promotion failure detail — pre-fix detail query had NO school filter ---');
  log('SQL: SELECT id, first_name, last_name, admission_number FROM students');
  log("     WHERE id IN ('fixture_stu_b1')  [NO school predicate]");
  const m3b = await q(`select id, first_name, last_name, admission_number from students where id = 'fixture_stu_b1'`);
  log('LEAKED ROWS RETURNED: ' + m3b.length);
  for (const r of m3b) log('  ' + JSON.stringify(r));
  log('');

  // ════════════════ AFTER — current fixed code, identical requests ════════════════
  log('====================================================================');
  log('SECTION 2: AFTER — identical requests against FIXED code');
  log('====================================================================');
  log('');

  log('--- H1 AFTER: getExamResults(fixture_exam_b, ctx) ---');
  try {
    const rows = await getExamResults('fixture_exam_b', ctx);
    log(`RESULT: OK — returned ${rows.length} row(s)`);
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  log('Fixed guard SQL: SELECT id FROM exams WHERE id = $1 AND school_id = $2');
  const h1g = await q(`select id from exams where id = 'fixture_exam_b' and school_id = 'seed_school_ea'`);
  log(`GUARD SQL ROWS: ${h1g.length}`);
  log('');

  log('--- H2 AFTER: getStudentResults(fixture_stu_b1, ctx) ---');
  try {
    const rows = await getStudentResults('fixture_stu_b1', ctx);
    log(`RESULT: OK — returned ${rows.length} row(s)`);
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  log('Fixed guard SQL: SELECT id FROM students WHERE id = $1 AND school_id = $2');
  const h2g = await q(`select id from students where id = 'fixture_stu_b1' and school_id = 'seed_school_ea'`);
  log(`GUARD SQL ROWS: ${h2g.length}`);
  log('');

  log('--- H3 AFTER: upsertResult(seed_school_ea, { examId: fixture_exam_b, studentId: fixture_stu_b1, marksObtained: 99 }, ctx) ---');
  try {
    await upsertResult(A, { examId: 'fixture_exam_b', studentId: 'fixture_stu_b1', marksObtained: 99 }, ctx);
    log('RESULT: OK (UNEXPECTED)');
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  const h3v = await q(`select marks_obtained, grade from exam_results where id = 'fixture_res_b1'`);
  log('FOREIGN ROW UNCHANGED: ' + JSON.stringify(h3v[0]));
  log('');

  log('--- H4 AFTER: recordPayment(seed_school_ea, { invoiceId: fixture_inv_b1, amount: 2000, method: CASH }, ctx) ---');
  try {
    await recordPayment(A, { invoiceId: 'fixture_inv_b1', amount: 2000, method: 'CASH' }, ctx);
    log('RESULT: OK (UNEXPECTED)');
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  const h4v = await q(`select id, paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`);
  const h4p = await q(`select count(*)::int as n from fee_payments where invoice_id = 'fixture_inv_b1'`);
  log(`FOREIGN INVOICE UNCHANGED: ${JSON.stringify(h4v[0])}; payments: ${h4p[0].n}`);
  log('');

  log('--- H5 AFTER: fixed route guard — findFirst scoped by school ---');
  log('Fixed guard SQL: SELECT id FROM attendance_sessions WHERE id = $1 AND school_id = $2');
  const h5g = await q(`select id from attendance_sessions where id = 'fixture_sess_b1' and school_id = 'seed_school_ea'`);
  log(`GUARD SQL ROWS: ${h5g.length} (0 → PATCH aborts with error)`);
  const h5v = await q(`select id, status from attendance_sessions where id = 'fixture_sess_b1'`);
  log('FOREIGN SESSION UNCHANGED: ' + JSON.stringify(h5v[0]));
  log('');

  log('--- H6 AFTER: bulkMarkAttendance({ schoolId: fixture_school_b, classId: fixture_cls_b_g01, ... }, authCtx=School A, ctx) ---');
  try {
    const res = await bulkMarkAttendance(
      { schoolId: B, classId: 'fixture_cls_b_g01', date: DATE, records: [{ studentMembershipId: 'fixture_mem_b_stu', status: 'PRESENT' }] },
      authCtx, ctx
    );
    log(`RESULT: OK — wrote ${res.length} row(s) (UNEXPECTED)`);
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  const h6v = await q(`select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`);
  log(`SCHOOL B ATTENDANCE ROWS: ${h6v[0].n}`);
  log('');

  log('--- M1 AFTER: createInvoice(seed_school_ea, { studentId: fixture_stu_b1, totalAmount: 2500, dueDate: 2026-09-15 }, ctx) ---');
  try {
    const inv = await createInvoice(A, { studentId: 'fixture_stu_b1', totalAmount: 2500, dueDate: '2026-09-15' }, ctx);
    log('RESULT: OK (UNEXPECTED): ' + inv.id);
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  const m1v = await q(`select count(*)::int as n from fee_invoices where student_id = 'fixture_stu_b1' and school_id = 'seed_school_ea'`);
  log(`SCHOOL A INVOICES ON FOREIGN STUDENT: ${m1v[0].n}`);
  log('');

  log('--- M2 AFTER: createFeeStructure(seed_school_ea, { categoryId: <School A cat>, classId: fixture_cls_b_g01, amount: 1000 }, ctx) ---');
  let catId = '';
  try {
    const cat = await createFeeCategory(A, 'Evidence Cat M2', ctx);
    catId = cat.id;
    log(`School A category created: ${cat.id} (for test setup)`);
    await createFeeStructure(A, { categoryId: cat.id, classId: 'fixture_cls_b_g01', amount: 1000 }, ctx);
    log('RESULT: OK (UNEXPECTED)');
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  if (catId) await p.$executeRawUnsafe(`delete from fee_categories where id = '${catId}'`);
  const m2v = await q(`select count(*)::int as n from fee_structures where class_id = 'fixture_cls_b_g01'`);
  log(`FEE STRUCTURES ON FOREIGN CLASS: ${m2v[0].n}`);
  log('');

  log('--- M3 AFTER: runPromotionBatch with foreign studentId in items ---');
  try {
    const res = await runPromotionBatch(
      { schoolId: A, fromAcademicYearId: 'seed_ay_2526', toAcademicYearId: 'seed_ay_2627', items: [{ studentId: 'fixture_stu_b1', action: 'PROMOTE' }] },
      authCtx, ctx
    );
    const failed = res.failed && res.failed.length > 0 ? res.failed[0] : null;
    log(`FAILURE DETAIL: ${JSON.stringify(failed)}`);
    log(`LEAKED FIELDS PRESENT: ${failed ? JSON.stringify({ hasName: typeof failed.studentName === 'string' && failed.studentName !== '—', hasAdmission: failed.admissionNumber && failed.admissionNumber !== '—' }) : 'n/a'}`);
  } catch (e) { log(`RESULT: REJECTED — ${(e as Error).message}`); }
  const m3g = await q(`select id from students where id = 'fixture_stu_b1' and school_id = 'seed_school_ea'`);
  log(`Fixed detail SQL (WHERE student_id AND school_id): rows = ${m3g.length} → details render '—'`);
  log('');

  // ════════════════ Final DB state ════════════════
  log('====================================================================');
  log('SECTION 3: FINAL DB STATE');
  log('====================================================================');
  const states: Array<[string, unknown]> = [];
  states.push(['attendance_records where school_id=fixture_school_b', await q(`select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`)]);
  states.push(['fee_payments total', await q(`select count(*)::int as n from fee_payments`)]);
  states.push(['fee_invoices where school_id=seed_school_ea AND student_id=fixture_stu_b1', await q(`select count(*)::int as n from fee_invoices where school_id = 'seed_school_ea' and student_id = 'fixture_stu_b1'`)]);
  states.push(['fee_structures where class_id=fixture_cls_b_g01', await q(`select count(*)::int as n from fee_structures where class_id = 'fixture_cls_b_g01'`)]);
  states.push(['exam_results fixture_res_b1', await q(`select marks_obtained, grade from exam_results where id = 'fixture_res_b1'`)]);
  states.push(['attendance_sessions fixture_sess_b1', await q(`select status, closed_at from attendance_sessions where id = 'fixture_sess_b1'`)]);
  states.push(['fee_invoices fixture_inv_b1', await q(`select paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`)]);
  for (const [label, rows] of states) log(`${label}: ${JSON.stringify(rows)}`);

  writeFileSync('docs/evidence/phase1.5-runtime.txt', out.join('\n'), 'utf8');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
