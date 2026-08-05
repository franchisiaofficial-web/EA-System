import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';
import { runPromotionBatch } from '../../../src/services/promotion/promotion-service';
import { buildContext } from '../../../src/lib/prisma/rls-middleware';
import {
  resetRollLockStats,
  getRollLockStats,
} from '../../../src/services/promotion/promotion-roll-lock';

const RUN_ID = process.env.RUN_ID ?? 'unnamed-run';
const RUN_CLASS = process.env.RUN_CLASS ?? '';
const SCHOOL = 'seed_school_ea';
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

const DUP_SQL = `SELECT
    section_id,
    COUNT(roll_number) AS assigned_rolls,
    COUNT(DISTINCT roll_number) AS unique_rolls
FROM enrollments
WHERE
status='ACTIVE'
AND roll_number IS NOT NULL
GROUP BY section_id;`;

const NULL_SQL = `SELECT
COUNT(*)
FROM enrollments
WHERE
status='ACTIVE'
AND roll_number IS NULL;`;

(async () => {
  console.log(`=== RUN ${RUN_ID} ===`);
  console.log(`timestamp=${new Date().toISOString()}`);
  console.log(
    `PROMOTION_WORKERS=${process.env.PROMOTION_WORKERS ?? '(unset -> default 6)'}`
  );
  console.log(`SCOPE=${RUN_CLASS ? RUN_CLASS : 'FULL SCHOOL'}`);

  const [preAy2526, preAy2627, prePor, preStuPo] = await Promise.all([
    p.enrollment.count({
      where: {
        schoolId: SCHOOL,
        academicYearId: 'seed_ay_2526',
        status: 'ACTIVE',
      },
    }),
    p.enrollment.count({
      where: {
        schoolId: SCHOOL,
        academicYearId: 'seed_ay_2627',
        status: 'ACTIVE',
      },
    }),
    p.passedOutRecord.count({ where: { schoolId: SCHOOL } }),
    p.student.count({ where: { schoolId: SCHOOL, status: 'PASSED_OUT' } }),
  ]);
  console.log(
    `PRE-STATE: ay2526_active=${preAy2526} ay2627_active=${preAy2627} passed_out_records=${prePor} students_passed_out=${preStuPo}`
  );

  const admin = await p.membership.findFirst({
    where: { schoolId: SCHOOL, role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!admin) {
    console.log('no admin');
    return;
  }
  const c = {
    userId: admin.user.id,
    email: admin.user.email,
    membershipId: admin.id,
    schoolId: admin.schoolId,
    role: admin.role,
    schoolStatus: 'ACTIVE',
  };
  const ctx = buildContext(c.userId, {
    id: admin.id,
    schoolId: admin.schoolId,
    role: admin.role,
  });

  resetRollLockStats();
  console.log('run started — heartbeat every 25 students');
  const t0 = Date.now();
  const batchInput: Parameters<typeof runPromotionBatch>[0] = {
    schoolId: SCHOOL,
    fromAcademicYearId: 'seed_ay_2526',
    toAcademicYearId: 'seed_ay_2627',
    items: [],
    onProgress: (p) => {
      if (p.processed % 25 === 0)
        console.log(
          `  [progress] processed=${p.processed} promoted=${p.promoted} passedOut=${p.passedOut} failed=${p.failed}`
        );
    },
  };
  if (RUN_CLASS) batchInput.classId = RUN_CLASS;
  const summary = await runPromotionBatch(batchInput, c, ctx);
  const wall = Date.now() - t0;

  console.log('--- RUN SUMMARY ---');
  console.log(
    `eligible=${summary.eligible} processed=${summary.total} promoted=${summary.promoted} passedOut=${summary.passedOut} skipped=${summary.skipped} failed=${summary.failed.length} retryable=${summary.retryable}`
  );
  console.log(
    `durationMs=${summary.durationMs} wallMs=${wall} studentsPerSec=${(summary.total / (wall / 1000)).toFixed(2)}`
  );
  const reasonMap = new Map<string, number>();
  for (const f of summary.failed)
    reasonMap.set(f.reason, (reasonMap.get(f.reason) ?? 0) + 1);
  console.log(
    `failureReasons=${JSON.stringify(Array.from(reasonMap.entries()))}`
  );

  const ls = getRollLockStats();
  console.log(
    '--- LOCK STATS (application timestamps: before acquire -> after acquire) ---'
  );
  console.log(
    `acquisitions=${ls.acquisitions} waitMinMs=${ls.waitMinMs} waitAvgMs=${ls.waitAvgMs} waitMaxMs=${ls.waitMaxMs} waitP95Ms=${ls.waitP95Ms} lockTimeouts=${ls.lockTimeouts} deadlocks=${ls.deadlocks} mutexFailures=${ls.otherFailures} retryAttempts=${ls.retryAttempts}`
  );

  const [postAy2526, postAy2627, postPor, postStuPo] = await Promise.all([
    p.enrollment.count({
      where: {
        schoolId: SCHOOL,
        academicYearId: 'seed_ay_2526',
        status: 'ACTIVE',
      },
    }),
    p.enrollment.count({
      where: {
        schoolId: SCHOOL,
        academicYearId: 'seed_ay_2627',
        status: 'ACTIVE',
      },
    }),
    p.passedOutRecord.count({ where: { schoolId: SCHOOL } }),
    p.student.count({ where: { schoolId: SCHOOL, status: 'PASSED_OUT' } }),
  ]);
  console.log(
    `POST-STATE: ay2526_active=${postAy2526} ay2627_active=${postAy2627} passed_out_records=${postPor} students_passed_out=${postStuPo}`
  );

  console.log('--- DUPLICATE ROLL CHECK: SQL EXECUTED ---');
  console.log(DUP_SQL);
  console.log(
    `--- RAW DATABASE OUTPUT @ ${new Date().toISOString()} | run=${RUN_ID} ---`
  );
  const dupRows = (await p.$queryRawUnsafe(DUP_SQL)) as {
    section_id: string;
    assigned_rolls: string | number;
    unique_rolls: string | number;
  }[];
  let dupOk = true;
  for (const r of dupRows) {
    const assigned = Number(r.assigned_rolls);
    const unique = Number(r.unique_rolls);
    const ok = assigned === unique;
    if (!ok) dupOk = false;
    console.log(
      `${r.section_id} | assigned_rolls=${assigned} | unique_rolls=${unique} | ${ok ? 'OK' : 'VIOLATION'}`
    );
  }
  console.log(
    `DUPLICATE-ROLL PASS=${dupOk} (assigned_rolls == unique_rolls for EVERY section: ${dupOk ? 'yes' : 'NO'})`
  );

  console.log('--- NULL ROLL CHECK: SQL EXECUTED ---');
  console.log(NULL_SQL);
  const nullRows = (await p.$queryRawUnsafe(NULL_SQL)) as {
    count: string | number;
  }[];
  const nullCount = Number(nullRows[0]?.count ?? 0);
  console.log(
    `NULL ROLL COUNT (raw): ${nullCount} @ ${new Date().toISOString()} | run=${RUN_ID}`
  );
  if (nullCount > 0) {
    console.log('--- NULL-ROLL STUDENTS (raw) ---');
    const nullStudents = (await p.$queryRawUnsafe(
      `SELECT student_id, class_id, section_id, roll_number, status FROM enrollments WHERE status='ACTIVE' AND roll_number IS NULL ORDER BY student_id;`
    )) as {
      student_id: string;
      class_id: string;
      section_id: string | null;
      roll_number: string | null;
      status: string;
    }[];
    for (const s of nullStudents) console.log(JSON.stringify(s));
  }

  await p.$disconnect();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
