import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
(async () => {
  await p.$executeRawUnsafe(`delete from book_borrowings where book_id = 'fixture_book_b1'`);
  await p.$executeRawUnsafe(`update books set available = quantity where id = 'fixture_book_b1'`);
  await p.$executeRawUnsafe(`delete from timetables where id = 'cmsbitwp500060wu84o228aoi'`);
  await p.$executeRawUnsafe(`delete from transport_assignments where id = 'cmsbity8000070wu8h58dlssr'`);
  await p.$executeRawUnsafe(`delete from class_assignments where id = 'cmsbitz6400080wu8dgz6jyob'`);
  const checks: Array<[string, string]> = [
    ['borrowings on fixture_book_b1', `select count(*)::int as n from book_borrowings where book_id = 'fixture_book_b1'`],
    ['book availability', `select quantity, available from books where id = 'fixture_book_b1'`],
    ['timetables schoolA/foreign-class', `select count(*)::int as n from timetables where class_id = 'fixture_cls_b_g01'`],
    ['transport assignments foreign student', `select count(*)::int as n from transport_assignments where student_id = 'fixture_stu_b1'`],
    ['class assignments foreign class', `select count(*)::int as n from class_assignments where class_id = 'fixture_cls_b_g01'`],
    ['attendance sessions fixture_sess_b1', `select status, closed_at from attendance_sessions where id = 'fixture_sess_b1'`],
    ['attendance records school B', `select count(*)::int as n from attendance_records where school_id = 'fixture_school_b'`],
    ['exam result fixture_res_b1', `select marks_obtained, grade from exam_results where id = 'fixture_res_b1'`],
    ['fee invoice fixture_inv_b1', `select paid_amount, status from fee_invoices where id = 'fixture_inv_b1'`],
  ];
  for (const [label, sql] of checks) {
    const r = await p.$queryRawUnsafe(sql);
    console.log(`${label}: ${JSON.stringify(r)}`);
  }
  await p.$disconnect();
})();
