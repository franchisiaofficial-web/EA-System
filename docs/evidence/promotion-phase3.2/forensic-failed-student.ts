import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

(async () => {
  console.log(
    '--- ACTIVE 2526 enrollments remaining (should be exactly the failed student) ---'
  );
  const rows = (await p.$queryRawUnsafe(
    `SELECT e.student_id, e.class_id, e.section_id, e.roll_number, e.status, s.first_name || ' ' || s.last_name AS student_name, s.admission_number
     FROM enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.school_id='seed_school_ea' AND e.academic_year_id='seed_ay_2526' AND e.status='ACTIVE'
     ORDER BY e.student_id`
  )) as {
    student_id: string;
    class_id: string;
    section_id: string;
    roll_number: string | null;
    status: string;
    student_name: string;
    admission_number: string;
  }[];
  console.log(JSON.stringify(rows, null, 2));

  console.log('--- audit_logs for that student (any action in run window) ---');
  if (rows.length) {
    const sid = rows[0].student_id;
    const audits = (await p.$queryRawUnsafe(
      `SELECT action, entity, record_id, created_at, after
       FROM audit_logs
       WHERE school_id='seed_school_ea' AND (record_id=$1 OR after->>'studentId'=$1)
         AND created_at >= '2026-08-05T06:36:00Z'::timestamptz
       ORDER BY created_at`,
      sid
    )) as {
      action: string;
      entity: string;
      record_id: string;
      created_at: Date;
      after: unknown;
    }[];
    console.log(JSON.stringify(audits, null, 2));

    console.log('--- student 2627 enrollments (should be none) ---');
    const e2627 = (await p.$queryRawUnsafe(
      `SELECT id, class_id, section_id, roll_number, status FROM enrollments WHERE student_id=$1 AND academic_year_id='seed_ay_2627'`,
      sid
    )) as {
      id: string;
      class_id: string;
      section_id: string;
      roll_number: string | null;
      status: string;
    }[];
    console.log(JSON.stringify(e2627, null, 2));

    console.log(
      '--- all students of class seed_cls_2526_g09 (Grade 7) status ---'
    );
    const g09 = (await p.$queryRawUnsafe(
      `SELECT e.student_id, s.first_name || ' ' || s.last_name AS student_name, e.section_id, e.roll_number, e.status
     FROM enrollments e JOIN students s ON s.id = e.student_id
     WHERE e.school_id='seed_school_ea' AND e.academic_year_id='seed_ay_2526' AND e.class_id='seed_cls_2526_g09'
     ORDER BY e.section_id, e.roll_number`
    )) as {
      student_id: string;
      name: string;
      section_id: string;
      roll_number: string | null;
      status: string;
    }[];
    console.log(JSON.stringify(g09, null, 2));
  }
  await p.$disconnect();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
