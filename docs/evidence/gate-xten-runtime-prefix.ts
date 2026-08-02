import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { getExamResults, getStudentResults, upsertResult } from '../../src/services/exam.service';
import { createInvoice, createFeeStructure, createFeeCategory, recordPayment } from '../../src/services/fee.service';
import { runPromotionBatch } from '../../src/services/promotion/promotion-service';
import { bulkMarkAttendance } from '../../src/services/attendance/attendance-service';
import { withRls, buildContext, type RequestContext } from '../../src/lib/prisma/rls-middleware';

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

async function q<T = Array<Record<string, unknown>>>(sql: string, ...args: unknown[]) {
  return p.$queryRawUnsafe<T>(sql, ...args);
}

async function main() {
  console.log('=== PHASE 1.5 RUNTIME â€” PRE-FIX (School A admin against School B data) ===\n');

  // â”€â”€ H1: exams â€” read foreign exam results â”€â”€
  try {
    const rows = await getExamResults('fixture_exam_b', ctx);
    console.log(`H1 getExamResults(foreign examId) -> OK, returned ${rows.length} row(s):`, JSON.stringify(rows.map((r) => ({ student: `${r.student.firstName} ${r.student.lastName}`, marks: r.marksObtained }))));
  } catch (e) {
    console.log(`H1 getExamResults(foreign examId) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ H2: exams â€” read foreign student results â”€â”€
  try {
    const rows = await getStudentResults('fixture_stu_b1', ctx);
    console.log(`H2 getStudentResults(foreign studentId) -> OK, returned ${rows.length} row(s):`, JSON.stringify(rows.map((r) => ({ exam: r.exam.name, marks: r.marksObtained }))));
  } catch (e) {
    console.log(`H2 getStudentResults(foreign studentId) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ H3: exams â€” upsert INTO foreign exam (update branch) â”€â”€
  try {
    await upsertResult(A, { examId: 'fixture_exam_b', studentId: 'fixture_stu_b1', marksObtained: 99, grade: 'A+' }, ctx);
    const after = await q(`select marks_obtained, grade, school_id from exam_results where id = 'fixture_res_b1'`);
    console.log(`H3 upsertResult(schoolId=A, foreign examId+studentId) -> OK; foreign row now:`, JSON.stringify(after));
  } catch (e) {
    console.log(`H3 upsertResult(foreign) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ H4: fees â€” record payment against foreign invoice â”€â”€
  try {
    await recordPayment(A, { invoiceId: 'fixture_inv_b1', amount: 2000, method: 'CASH' }, ctx);
    const inv = await q(`select school_id, paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`);
    const pay = await q(`select school_id, amount from fee_payments where invoice_id = 'fixture_inv_b1'`);
    console.log(`H4 recordPayment(schoolId=A, foreign invoiceId) -> OK; foreign invoice:`, JSON.stringify(inv), 'payments:', JSON.stringify(pay));
  } catch (e) {
    console.log(`H4 recordPayment(foreign) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ H5: attendance session â€” close foreign session (route-equivalent query) â”€â”€
  try {
    const res = await withRls(ctx, (tx) =>
      tx.attendanceSession.update({ where: { id: 'fixture_sess_b1' }, data: { status: 'CLOSED', closedAt: new Date(), updatedBy: authCtx.userId } })
    );
    console.log(`H5 attendanceSession.update(foreign id) -> OK, session now: status=${res.status} school=${res.schoolId}`);
  } catch (e) {
    console.log(`H5 attendanceSession.update(foreign id) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ H6: attendance server-action path â€” client-supplied schoolId â”€â”€
  try {
    const res = await bulkMarkAttendance(
      { schoolId: B, classId: 'fixture_cls_b_g01', date: DATE, records: [{ studentMembershipId: 'fixture_mem_b_stu', status: 'PRESENT' }] },
      authCtx, ctx
    );
    console.log(`H6 bulkMarkAttendance(schoolId=School B via client, School A user) -> OK, wrote ${res.length} row(s):`, JSON.stringify(res.map((r) => ({ id: r.id, schoolId: r.schoolId, classId: r.classId }))));
  } catch (e) {
    console.log(`H6 bulkMarkAttendance(client schoolId) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ M1: fees â€” invoice for foreign student (contamination) â”€â”€
  try {
    const inv = await createInvoice(A, { studentId: 'fixture_stu_b1', totalAmount: 2500, dueDate: '2026-09-15', month: 'Sep' }, ctx);
    console.log(`M1 createInvoice(schoolId=A, foreign studentId) -> OK, invoice:`, JSON.stringify({ id: inv.id, schoolId: inv.schoolId, studentId: inv.studentId }));
  } catch (e) {
    console.log(`M1 createInvoice(foreign) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ M2: fees â€” fee structure for foreign class (contamination) â”€â”€
  try {
    const cat = await createFeeCategory(A, 'Audit Test Cat', ctx);
    const st = await createFeeStructure(A, { categoryId: cat.id, classId: 'fixture_cls_b_g01', amount: 1000 }, ctx);
    console.log(`M2 createFeeStructure(schoolId=A, foreign classId) -> OK, structure:`, JSON.stringify({ id: st.id, schoolId: st.schoolId, classId: st.classId }));
  } catch (e) {
    console.log(`M2 createFeeStructure(foreign) -> REJECTED: ${(e as Error).message}`);
  }

  // â”€â”€ M3: promotion â€” foreign studentId in items (leak into failure) â”€â”€
  try {
    const res = await runPromotionBatch(
      { schoolId: A, fromAcademicYearId: 'seed_ay_2526', toAcademicYearId: 'seed_ay_2627', items: [{ studentId: 'fixture_stu_b1', action: 'PROMOTE' }] },
      authCtx, ctx
    );
    console.log(`M3 promotion(foreign studentId in items) -> summary: failed=${JSON.stringify(res.failed)}`);
  } catch (e) {
    console.log(`M3 promotion(foreign) -> REJECTED: ${(e as Error).message}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
