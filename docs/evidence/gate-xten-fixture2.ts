import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const B = 'fixture_school_b';

async function main() {
  const day = new Date('2026-08-01T06:00:00.000Z');

  await p.subject.upsert({
    where: { id: 'fixture_sub_b_math' },
    update: {},
    create: { id: 'fixture_sub_b_math', schoolId: B, name: 'Mathematics', code: 'MAT' },
  });

  const exam = await p.exam.upsert({
    where: { id: 'fixture_exam_b' },
    update: {},
    create: {
      id: 'fixture_exam_b',
      schoolId: B,
      name: 'Unit Test 1',
      academicYearId: 'fixture_ay_b',
      classId: 'fixture_cls_b_g01',
      sectionId: 'fixture_sec_b_g01_a',
      subjectId: 'fixture_sub_b_math',
      maxMarks: 100,
      passMarks: 35,
      examDate: day,
      status: 'COMPLETED',
    },
  });

  const res = await p.examResult.upsert({
    where: { examId_studentId: { examId: 'fixture_exam_b', studentId: 'fixture_stu_b1' } },
    update: { marksObtained: 88 },
    create: {
      id: 'fixture_res_b1',
      schoolId: B,
      examId: 'fixture_exam_b',
      studentId: 'fixture_stu_b1',
      marksObtained: 88,
      grade: 'A',
    },
  });

  const inv = await p.feeInvoice.upsert({
    where: { schoolId_invoiceNo: { schoolId: B, invoiceNo: 'INV-B-001' } },
    update: {},
    create: {
      id: 'fixture_inv_b1',
      schoolId: B,
      studentId: 'fixture_stu_b1',
      invoiceNo: 'INV-B-001',
      totalAmount: 5000,
      paidAmount: 0,
      dueDate: new Date('2026-09-01'),
      status: 'PENDING',
    },
  });

  await p.attendanceSession.upsert({
    where: { id: 'fixture_sess_b1' },
    update: {},
    create: {
      id: 'fixture_sess_b1',
      schoolId: B,
      classId: 'fixture_cls_b_g01',
      sectionId: 'fixture_sec_b_g01_a',
      teacherId: 'fixture_mem_b_stu',
      type: 'MORNING',
      status: 'ACTIVE',
      openedAt: day,
      createdBy: 'fixture_user_b_stu',
    },
  });

  await p.feeCategory.upsert({
    where: { id: 'fixture_cat_b1' },
    update: {},
    create: { id: 'fixture_cat_b1', schoolId: B, name: 'Tuition (School B)' },
  });

  const counts = await p.$queryRawUnsafe(
    `select (select count(*) from exams where id='fixture_exam_b') as exams,
            (select count(*) from exam_results where id='fixture_res_b1') as results,
            (select count(*) from fee_invoices where id='fixture_inv_b1') as invoices,
            (select count(*) from attendance_sessions where id='fixture_sess_b1') as sessions,
            (select count(*) from fee_categories where id='fixture_cat_b1') as categories`
  );
  console.log(
    'School B extended fixtures:',
    JSON.stringify(counts, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))
  );
  console.log('exam:', exam.id, '| result:', res.id, 'marks=', res.marksObtained, '| invoice:', inv.id, inv.invoiceNo);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
