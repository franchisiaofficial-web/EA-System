import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';
import {
  createPromotionJob,
  getPromotionJob,
} from '../../../src/services/promotion/promotion-job-service';
import { buildContext } from '../../../src/lib/prisma/rls-middleware';
import {
  resetRollLockStats,
  getRollLockStats,
} from '../../../src/services/promotion/promotion-roll-lock';

const SCHOOL = 'seed_school_ea';
const OTHER_SCHOOL = 'fixture_school_b';
const RUN_CLASS = process.env.RUN_CLASS ?? 'seed_cls_2526_g04';
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DUP_SQL = `SELECT section_id, COUNT(roll_number) AS assigned_rolls, COUNT(DISTINCT roll_number) AS unique_rolls
FROM enrollments WHERE status='ACTIVE' AND roll_number IS NOT NULL GROUP BY section_id;`;
const NULL_SQL = `SELECT COUNT(*) FROM enrollments WHERE status='ACTIVE' AND roll_number IS NULL;`;

(async () => {
  console.log(`=== JOB REGRESSION ${new Date().toISOString()} ===`);
  console.log(
    `PROMOTION_WORKERS=${process.env.PROMOTION_WORKERS ?? '(unset -> default 6)'}`
  );
  console.log(`RUN_CLASS=${RUN_CLASS}`);

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

  const q = async (label: string) => {
    const r = await Promise.all([
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
      p.attendanceRecord.count({ where: { schoolId: SCHOOL } }),
      p.guardian.count({ where: { schoolId: SCHOOL } }),
      p.enrollment.count({
        where: { schoolId: OTHER_SCHOOL, status: 'ACTIVE' },
      }),
    ]);
    console.log(
      `${label}: ay2526=${r[0]} ay2627=${r[1]} passed_out_records=${r[2]} students_passed_out=${r[3]} attendance=${r[4]} guardians=${r[5]} otherSchoolActive=${r[6]}`
    );
    return r;
  };

  await q('PRE');

  const tStart = new Date();
  resetRollLockStats();
  console.log(
    '--- 1) create class-scoped PromotionJob (goes through global scheduler) ---'
  );
  const { job, duplicate } = await createPromotionJob(
    {
      schoolId: SCHOOL,
      fromAcademicYearId: 'seed_ay_2526',
      toAcademicYearId: 'seed_ay_2627',
      classId: RUN_CLASS,
    },
    c,
    ctx
  );
  console.log(
    'created:',
    job.id,
    'status=',
    job.status,
    'duplicate=',
    duplicate
  );
  if (duplicate) {
    console.log('unexpected duplicate');
    return;
  }
  const jobId = job.id;

  console.log('--- 2) poll until terminal ---');
  let view: Awaited<ReturnType<typeof getPromotionJob>> = null;
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) {
    await sleep(2000);
    view = await getPromotionJob(jobId, ctx);
    if (!view) {
      console.log('job not found');
      return;
    }
    if (i % 5 === 0)
      console.log(
        `poll ${i}: status=${view.status} processed=${view.processed}/${view.eligible} promoted=${view.promoted} batch=${view.currentBatch?.transition ?? '-'}`
      );
    if (view.status === 'COMPLETED' || view.status === 'FAILED') break;
  }
  const wall = Math.round((Date.now() - t0) / 1000);
  if (!view) return;

  console.log(`--- 3) final state (${wall}s) ---`);
  console.log(
    'status:',
    view.status,
    '| eligible:',
    view.eligible,
    '| processed:',
    view.processed,
    '| promoted:',
    view.promoted,
    '| passedOut:',
    view.passedOut,
    '| failed:',
    view.failed,
    '| error:',
    view.error,
    '| durationMs:',
    view.durationMs
  );
  console.log('batches:', JSON.stringify(view.batches));
  const totalsOk =
    view.processed === view.promoted + view.passedOut + view.failed;
  const countsOk = view.eligible === view.processed;
  const batchDone =
    view.batches.length === 1 &&
    view.batches[0].status === 'COMPLETED' &&
    view.batches[0].promoted > 0 &&
    view.batches[0].failed === 0;
  console.log(
    'processed==promoted+passedOut+failed:',
    totalsOk,
    '| eligible==processed:',
    countsOk,
    '| single batch COMPLETED:',
    batchDone
  );

  const ls = getRollLockStats();
  console.log('--- LOCK STATS (through JOB path) ---');
  console.log(
    `acquisitions=${ls.acquisitions} waitMinMs=${ls.waitMinMs} waitAvgMs=${ls.waitAvgMs} waitMaxMs=${ls.waitMaxMs} waitP95Ms=${ls.waitP95Ms} lockTimeouts=${ls.lockTimeouts} deadlocks=${ls.deadlocks} mutexFailures=${ls.otherFailures} retryAttempts=${ls.retryAttempts}`
  );

  console.log(
    '--- 4) idempotent re-run (same class after COMPLETED: 0 double-promotions) ---'
  );
  const rerun = await createPromotionJob(
    {
      schoolId: SCHOOL,
      fromAcademicYearId: 'seed_ay_2526',
      toAcademicYearId: 'seed_ay_2627',
      classId: RUN_CLASS,
    },
    c,
    ctx
  );
  console.log('rerun created:', rerun.job.id, 'duplicate=', rerun.duplicate);
  let rv: Awaited<ReturnType<typeof getPromotionJob>> = null;
  for (let i = 0; i < 60; i++) {
    await sleep(1500);
    rv = await getPromotionJob(rerun.job.id, ctx);
    if (rv && (rv.status === 'COMPLETED' || rv.status === 'FAILED')) break;
  }
  if (rv)
    console.log(
      'rerun final:',
      rv.status,
      'eligible=',
      rv.eligible,
      'processed=',
      rv.processed,
      'promoted=',
      rv.promoted,
      'failed=',
      rv.failed
    );
  const rerunOk =
    !!rv && rv.status === 'COMPLETED' && rv.promoted === 0 && rv.failed === 0;
  console.log('idempotent re-run ok (0 double-promotions):', rerunOk);

  console.log(
    '--- 5) retry route branch (retry ONLY failed batches; expect NOTHING_TO_RETRY / 409) ---'
  );
  const failedBatches = await p.promotionJobBatch.findMany({
    where: { promotionJobId: jobId, status: 'FAILED' },
    select: { sourceClassId: true },
    distinct: ['sourceClassId'],
  });
  console.log('FAILED batches in job:', failedBatches.length);
  const retryClassIds = failedBatches
    .map((b) => b.sourceClassId)
    .filter((id): id is string => !!id);
  const retryBranch =
    retryClassIds.length === 0
      ? '409 NOTHING_TO_RETRY (no failed batches)'
      : '202 retry scheduled';
  console.log('retry branch taken:', retryBranch);

  console.log(
    '--- 6) raw duplicate-roll + NULL-roll + tenants + audit (post-run) ---'
  );
  const dupRows = (await p.$queryRawUnsafe(DUP_SQL)) as {
    section_id: string;
    assigned_rolls: string | number;
    unique_rolls: string | number;
  }[];
  let dupOk = true;
  for (const r of dupRows)
    if (Number(r.assigned_rolls) !== Number(r.unique_rolls)) dupOk = false;
  const nullCount = Number(
    ((await p.$queryRawUnsafe(NULL_SQL)) as { count: string | number }[])[0]
      ?.count ?? 0
  );
  console.log(`DUPLICATE-ROLL PASS=${dupOk}`);
  console.log(`NULL ROLL COUNT=${nullCount}`);
  const audits =
    (
      (await p.$queryRaw`SELECT COUNT(*)::int AS n FROM audit_logs WHERE school_id=${SCHOOL} AND entity='enrollment' AND action='promote' AND created_at >= ${tStart}`) as {
        n: number;
      }[]
    )[0]?.n ?? 0;
  console.log(
    `audit_logs (entity=enrollment action=promote) created during job: ${audits}`
  );

  await q('POST');
  const postOther = await p.enrollment.count({
    where: { schoolId: OTHER_SCHOOL },
  });
  console.log(
    `tenant isolation: other school total enrollments untouched=${postOther}`
  );

  const jobRow = await p.promotionJob.findUnique({ where: { id: jobId } });
  console.log(
    'promotion_job row (raw):',
    JSON.stringify({
      status: jobRow?.status,
      eligible: jobRow?.eligibleStudents,
      processed: jobRow?.processedStudents,
      promoted: jobRow?.promotedStudents,
      failed: jobRow?.failedStudents,
      durationMs: jobRow?.durationMs,
    })
  );
  const batchRow = await p.promotionJobBatch.findFirst({
    where: { promotionJobId: jobId },
  });
  console.log(
    'promotion_job_batches rows (raw):',
    JSON.stringify({
      transition: batchRow?.transition,
      status: batchRow?.status,
      eligible: batchRow?.eligible,
      processed: batchRow?.processed,
      promoted: batchRow?.promoted,
      failed: batchRow?.failed,
    })
  );

  const pass =
    view.status === 'COMPLETED' &&
    totalsOk &&
    countsOk &&
    batchDone &&
    rerunOk &&
    dupOk &&
    nullCount === 0 &&
    ls.otherFailures === 0 &&
    ls.deadlocks === 0 &&
    ls.lockTimeouts === 0;
  console.log(pass ? 'JOB REGRESSION PASSED' : 'JOB REGRESSION FAILED');
  await p.$disconnect();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
