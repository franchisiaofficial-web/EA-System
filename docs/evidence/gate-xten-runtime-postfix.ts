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
  // â”€â”€ cleanup pre-fix pollution â”€â”€
  await p.$executeRawUnsafe(`update exam_results set marks_obtained = 88, grade = 'A' where id = 'fixture_res_b1'`);
  await p.$executeRawUnsafe(`delete from fee_payments where invoice_id = 'fixture_inv_b1'`);
  await p.$executeRawUnsafe(`update fee_invoices set paid_amount = 0, status = 'PENDING' where id = 'fixture_inv_b1'`);
  await p.$executeRawUnsafe(`update attendance_sessions set status = 'ACTIVE', closed_at = null where id = 'fixture_sess_b1'`);
  await p.$executeRawUnsafe(`delete from attendance_records where school_id = 'fixture_school_b'`);
  await p.$executeRawUnsafe(`delete from fee_invoices where school_id = 'seed_school_ea' and student_id = 'fixture_stu_b1'`);
  await p.$executeRawUnsafe(`delete from fee_structures where school_id = 'seed_school_ea' and class_id = 'fixture_cls_b_g01'`);
  await p.$executeRawUnsafe(`delete from fee_categories where school_id = 'seed_school_ea' and name = 'Audit Test Cat'`);
  await p.$executeRawUnsafe(`delete from audit_logs where entity = 'attendance_record' and school_id = 'fixture_school_b'`);
  console.log('Pre-fix pollution removed.\n');

  console.log('=== PHASE 1.5 RUNTIME â€” POST-FIX (School A admin against School B data) ===\n');

  // H1
  try {
    const rows = await getExamResults('fixture_exam_b', ctx);
    console.log(`H1 getExamResults(foreign examId) -> OK, returned ${rows.length} row(s)`);
  } catch (e) {
    console.log(`H1 getExamResults(foreign examId) -> REJECTED: ${(e as Error).message}`);
  }

  // H2
  try {
    const rows = await getStudentResults('fixture_stu_b1', ctx);
    console.log(`H2 getStudentResults(foreign studentId) -> OK, returned ${rows.length} row(s)`);
  } catch (e) {
    console.log(`H2 getStudentResults(foreign studentId) -> REJECTED: ${(e as Error).message}`);
  }

  // H3
  try {
    await upsertResult(A, { examId: 'fixture_exam_b', studentId: 'fixture_stu_b1', marksObtained: 99 }, ctx);
    console.log('H3 upsertResult(foreign examId+studentId) -> OK (UNEXPECTED)');
  } catch (e) {
    console.log(`H3 upsertResult(foreign) -> REJECTED: ${(e as Error).message}`);
  }
  const resCheck = await q(`select marks_obtained from exam_results where id = 'fixture_res_b1'`);
  console.log(`   foreign row unchanged (marks=88): ${Number(resCheck[0].marks_obtained) === 88}`);

  // H4
  try {
    await recordPayment(A, { invoiceId: 'fixture_inv_b1', amount: 2000, method: 'CASH' }, ctx);
    console.log('H4 recordPayment(foreign invoiceId) -> OK (UNEXPECTED)');
  } catch (e) {
    console.log(`H4 recordPayment(foreign invoiceId) -> REJECTED: ${(e as Error).message}`);
  }
  const invCheck = await q(`select paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`);
  const payCheck = await q(`select count(*)::int as n from fee_payments where invoice_id = 'fixture_inv_b1'`);
  console.log(`   foreign invoice unchanged (paid=0, PENDING): ${Number(invCheck[0].paid_amount) === 0 && invCheck[0].status === 'PENDING'}; payments=0: ${Number(payCheck[0].n) === 0}`);

  // H5
  try {
    await withRls(ctx, (tx) =>
      tx.attendanceSession.update({ where: { id: 'fixture_sess_b1' }, data: { status: 'CLOSED', closedAt: new Date(), updatedBy: authCtx.userId } })
    );
    console.log('H5 attendanceSession.update(foreign id) -> OK (UNEXPECTED)');
  } catch (e) {
    console.log(`H5 attendanceSession.update(foreign id) -> REJECTED: ${(e as Error).message}`);
  }
  const sessCheck = await q(`select status from attendance_sessions where id = 'fixture_sess_b1'`);
  console.log(`   foreign session still ACTIVE: ${sessCheck[0].status === 'ACTIVE'}`);

  // H6
  try {
    const res = await bulkMarkAttendance(
      { schoolId: B, classId: 'fixture_cls_b_g01', date: DATE, records: [{ studentMembershipId: 'fixture_mem_b_stu', status: 'PRESENT' }] },
      authCtx, ctx
    );
    console.log(`H6 bulkMarkAttendance(schoolId=B via client) -> OK, wrote ${res.length} (UNEXPECTED â€” action layer now overrides schoolId, service-level cannot)`);
  } catch (e) {
    console.log(`H6 bulkMarkAttendance(schoolId=B via client) -> REJECTED: ${(e as Error).message}`);
  }
  const attCheck = await q(`select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`);
  console.log(`   School B attendance rows: ${Number(attCheck[0].n)} (service-level call with explicit foreign schoolId is now the action layer's guard)`);

  // M1
  try {
    const inv = await createInvoice(A, { studentId: 'fixture_stu_b1', totalAmount: 2500, dueDate: '2026-09-15' }, ctx);
    console.log(`M1 createInvoice(foreign studentId) -> OK, created ${inv.id} (UNEXPECTED)`);
  } catch (e) {
    console.log(`M1 createInvoice(foreign studentId) -> REJECTED: ${(e as Error).message}`);
  }

  // M2
  try {
    const cat = await createFeeCategory(A, 'Audit Test Cat 2', ctx);
    await createFeeStructure(A, { categoryId: cat.id, classId: 'fixture_cls_b_g01', amount: 1000 }, ctx);
    console.log('M2 createFeeStructure(foreign classId) -> OK (UNEXPECTED)');
  } catch (e) {
    console.log(`M2 createFeeStructure(foreign classId) -> REJECTED: ${(e as Error).message}`);
  }
  await p.$executeRawUnsafe(`delete from fee_categories where school_id = 'seed_school_ea' and name = 'Audit Test Cat 2'`);

  // M3
  try {
    const res = await runPromotionBatch(
      { schoolId: A, fromAcademicYearId: 'seed_ay_2526', toAcademicYearId: 'seed_ay_2627', items: [{ studentId: 'fixture_stu_b1', action: 'PROMOTE' }] },
      authCtx, ctx
    );
    console.log(`M3 promotion(foreign studentId) -> failure detail: ${JSON.stringify(res.failed[0] ? { studentName: res.failed[0].studentName, admissionNumber: res.failed[0].admissionNumber } : null)} (name/admission must NOT leak)`);
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
