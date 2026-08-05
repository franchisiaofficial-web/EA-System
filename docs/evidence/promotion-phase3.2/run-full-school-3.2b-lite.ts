import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  PromotionJob,
  PromotionJobBatch,
} from '../../../src/generated/prisma/client';
import { createPromotionJob } from '../../../src/services/promotion/promotion-job-service';
import { buildContext } from '../../../src/lib/prisma/rls-middleware';
import {
  resetRollLockStats,
  getRollLockStats,
} from '../../../src/services/promotion/promotion-roll-lock';

// CONNECTION-LIGHT HARNESS — Phase 3.2B (attempt 2).
// Permitted DB traffic during the run: ONE job+batch state read at each batch
// boundary (60 s sleep between reads, ~1 read per batch on a ~16 min run).
// NO pg_locks observer, NO continuous polling, NO repeating monitor queries.

const SCHOOL = 'seed_school_ea';
const AY2526 = 'seed_ay_2526';
const AY2627 = 'seed_ay_2627';
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const NULL_STUDENTS_SQL = `SELECT student_id, class_id, section_id, roll_number, status
FROM enrollments WHERE status='ACTIVE' AND roll_number IS NULL ORDER BY student_id;`;

(async () => {
  console.log(
    `=== PHASE 3.2B CONNECTION-LIGHT FULL-SCHOOL VALIDATION ${new Date().toISOString()} ===`
  );
  console.log(
    `PROMOTION_WORKERS=${process.env.PROMOTION_WORKERS ?? '(unset -> default 6)'}`
  );
  console.log(
    `PRISMA_POOL_MAX=${process.env.PRISMA_POOL_MAX ?? '(unset -> default 6)'}`
  );
  console.log(
    `HARNESS: batch-boundary state reads only (60 s sleep between reads); no observer, no continuous polling`
  );
  console.log(`SCOPE=FULL SCHOOL (no classId)`);

  // ── PRE state (before run; permitted) ───────────────────────────────────────
  const [preAy2526, preAy2627, prePor, preStuPo] = await Promise.all([
    p.enrollment.count({
      where: { schoolId: SCHOOL, academicYearId: AY2526, status: 'ACTIVE' },
    }),
    p.enrollment.count({
      where: { schoolId: SCHOOL, academicYearId: AY2627, status: 'ACTIVE' },
    }),
    p.passedOutRecord.count({ where: { schoolId: SCHOOL } }),
    p.student.count({ where: { schoolId: SCHOOL, status: 'PASSED_OUT' } }),
  ]);
  console.log(
    `PRE-STATE: ay2526_active=${preAy2526} ay2627_active=${preAy2627} passed_out_records=${prePor} students_passed_out=${preStuPo}`
  );
  if (
    preAy2526 !== 1457 ||
    preAy2627 !== 103 ||
    prePor !== 0 ||
    preStuPo !== 0
  ) {
    console.log('ABORT: baseline not certified (expected 1457/103/0/0)');
    await p.$disconnect();
    process.exit(1);
  }

  const tenantPre = (await p.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE school_id='fixture_school_b') AS enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE school_id='fixture_school_b') AS attendance,
            (SELECT COUNT(*) FROM guardians WHERE school_id='fixture_school_b') AS guardians`
  )) as { enrollments: string; attendance: string; guardians: string }[];
  console.log(
    `TENANT PRE (fixture_school_b): enrollments=${tenantPre[0].enrollments} attendance=${tenantPre[0].attendance} guardians=${tenantPre[0].guardians}`
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

  // ── Create the full-school job ───────────────────────────────────────────────
  const tStart = new Date();
  const tStartMs = Date.now();
  resetRollLockStats();
  console.log('--- create FULL-SCHOOL PromotionJob (no classId) ---');
  const { job, duplicate } = await createPromotionJob(
    { schoolId: SCHOOL, fromAcademicYearId: AY2526, toAcademicYearId: AY2627 },
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
    console.log('ABORT: duplicate job returned');
    await p.$disconnect();
    process.exit(1);
  }
  const jobId = job.id;

  // ── BATCH-BOUNDARY LOOP: sleep 60 s, then ONE state read ──────────────────
  console.log('--- batch-boundary state reads (60 s apart; ~1 read/batch) ---');
  const batchSeen = new Map<string, string>();
  let stateReads = 0;
  let terminal: { job: PromotionJob; batches: PromotionJobBatch[] } | null =
    null;
  for (let i = 0; i < 44; i++) {
    await sleep(60000);
    stateReads++;
    const jobRow = await p.promotionJob.findUnique({ where: { id: jobId } });
    const batchRows = await p.promotionJobBatch.findMany({
      where: { promotionJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
    if (!jobRow) {
      console.log('job row missing from DB');
      break;
    }
    const elapsedMin = ((Date.now() - tStartMs) / 1000 / 60).toFixed(1);
    console.log(
      `  [read#${stateReads} ${new Date().toISOString()}] elapsed=${elapsedMin}min job=${jobRow.status}: ${jobRow.processedStudents}/${jobRow.eligibleStudents} promoted=${jobRow.promotedStudents} passedOut=${jobRow.passedOutStudents} failed=${jobRow.failedStudents}`
    );
    let anyChange = false;
    for (const b of batchRows) {
      if (batchSeen.get(b.id) !== b.status) {
        const prev = batchSeen.get(b.id);
        batchSeen.set(b.id, b.status);
        anyChange = true;
        console.log(
          `      ${b.transition}: ${prev ?? 'created'} -> ${b.status} (eligible=${b.eligible} processed=${b.processed} promoted=${b.promoted} passedOut=${b.passedOut} failed=${b.failed})`
        );
      }
    }
    if (!anyChange)
      console.log('      (no batch state change since last read)');
    if (jobRow.status === 'COMPLETED' || jobRow.status === 'FAILED') {
      terminal = { job: jobRow, batches: batchRows };
      break;
    }
  }
  if (!terminal) {
    console.log('ABORT: run did not reach terminal state within read budget');
    await p.$disconnect();
    process.exit(1);
  }
  console.log(
    `state reads performed during run: ${stateReads} (batch-boundary only)`
  );
  const wallMs = Date.now() - tStartMs;
  console.log(
    `--- TERMINAL: ${terminal.job.status} (wall ${(wallMs / 1000).toFixed(1)} s) ---`
  );

  // ── Job row (raw) ──────────────────────────────────────────────────────────
  console.log('--- PROMOTION_JOBS ROW (raw) ---');
  console.log(JSON.stringify(terminal.job, null, 2));
  console.log('--- PROMOTION_JOB_BATCHES ROWS (raw) ---');
  for (const b of terminal.batches) console.log(JSON.stringify(b));
  console.log('--- PER-BATCH TIMING + PROMOTION COUNTS ---');
  for (const b of terminal.batches) {
    const d =
      b.startedAt && b.completedAt
        ? `${new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()}ms`
        : '(no timestamps)';
    console.log(
      `${b.transition} | eligible=${b.eligible} | processed=${b.processed} | promoted=${b.promoted} | passedOut=${b.passedOut} | failed=${b.failed} | ${d}`
    );
  }

  // ── Lock statistics (application timing: before acquire -> after acquire) ──
  const ls = getRollLockStats();
  console.log(
    '--- LOCK STATISTICS (application timing: before acquire -> after acquire) ---'
  );
  console.log(
    `acquisitions=${ls.acquisitions} waitMinMs=${ls.waitMinMs} waitAvgMs=${ls.waitAvgMs} waitP95Ms=${ls.waitP95Ms} waitMaxMs=${ls.waitMaxMs} lockTimeouts=${ls.lockTimeouts} mutexFailures=${ls.otherFailures} deadlocks=${ls.deadlocks} retryAttempts=${ls.retryAttempts}`
  );

  // ── Per-batch retry breakdown (from persisted audit_logs; no code change) ──
  console.log(
    '--- PER-BATCH RETRY BREAKDOWN (audit_logs rollCollisionRecovery=true, by target class) ---'
  );
  console.log('SQL EXECUTED:');
  console.log(`SELECT after->>'classId' AS target_class_id, COUNT(*)::int AS retry_successes FROM audit_logs
WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote'
AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}'
AND after->>'rollCollisionRecovery'='true' AND created_at >= $1::timestamptz GROUP BY 1 ORDER BY 1;`);
  const retryRows = (await p.$queryRawUnsafe(
    `SELECT after->>'classId' AS target_class_id, COUNT(*)::int AS retry_successes FROM audit_logs
     WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote'
     AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}'
     AND after->>'rollCollisionRecovery'='true' AND created_at >= $1::timestamptz
     GROUP BY 1 ORDER BY 1`,
    tStart
  )) as { target_class_id: string; retry_successes: number }[];
  const retryByClass = new Map(
    retryRows.map((r) => [r.target_class_id, r.retry_successes])
  );
  let sumRetry = 0;
  for (const b of terminal.batches) {
    const target = b.targetClassId ?? '(passed out)';
    const retryS = target ? (retryByClass.get(target) ?? 0) : 0;
    sumRetry += retryS;
    console.log(
      `${b.transition} | targetClass=${target} | promoted=${b.promoted} | retrySuccesses=${retryS} | retryFailures=${b.failed} | retryAttemptsObserved=${retryS + b.failed}`
    );
  }
  console.log(
    `sum(retySsucesses) per batch = ${sumRetry} | global retryAttempts counter = ${ls.retryAttempts}`
  );

  // ── Reconciliation ─────────────────────────────────────────────────────────
  const j = terminal.job;
  const countsOk = j.eligibleStudents === j.processedStudents;
  const totalsOk =
    j.processedStudents ===
    j.promotedStudents + j.passedOutStudents + j.failedStudents;
  console.log('--- RECONCILIATION (job counters) ---');
  console.log(
    `eligible==processed: ${countsOk} (${j.eligibleStudents} == ${j.processedStudents})`
  );
  console.log(
    `processed==promoted+passedOut+failed: ${totalsOk} (${j.processedStudents} == ${j.promotedStudents}+${j.passedOutStudents}+${j.failedStudents})`
  );
  const audits = (await p.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote' AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}' AND created_at >= $1::timestamptz) AS promote_audits,
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='student' AND action='pass_out' AND created_at >= $1::timestamptz) AS passout_audits,
       (SELECT COUNT(*)::int FROM (SELECT after->>'studentId' AS sid, COUNT(*) AS n FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote' AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}' AND created_at >= $1::timestamptz GROUP BY 1 HAVING COUNT(*) > 1) d) AS duplicate_audits`,
    tStart
  )) as {
    promote_audits: number;
    passout_audits: number;
    duplicate_audits: number;
  }[];
  console.log(
    `promote audits=${audits[0].promote_audits} | pass_out audits=${audits[0].passout_audits} | students with >1 promote audit=${audits[0].duplicate_audits}`
  );
  const auditOk =
    audits[0].promote_audits === j.promotedStudents &&
    audits[0].passout_audits === j.passedOutStudents &&
    audits[0].duplicate_audits === 0;
  console.log(`audit 1:1 with job counters: ${auditOk}`);
  console.log(
    `missing promote audits (promoted - audits) = ${j.promotedStudents - audits[0].promote_audits}`
  );
  console.log(
    `missing pass_out audits (passedOut - audits) = ${j.passedOutStudents - audits[0].passout_audits}`
  );

  // ── Duplicate-roll SQL (raw) ───────────────────────────────────────────────
  console.log('--- DUPLICATE ROLL CHECK: SQL EXECUTED ---');
  console.log(DUP_SQL);
  const dupRows = (await p.$queryRawUnsafe(DUP_SQL)) as {
    section_id: string;
    assigned_rolls: string | number;
    unique_rolls: string | number;
  }[];
  console.log(
    `--- RAW DATABASE OUTPUT @ ${new Date().toISOString()} | run=full-school-3.2b-lite ---`
  );
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
  console.log(`DUPLICATE-ROLL PASS=${dupOk}`);

  // ── NULL-roll SQL (raw) ────────────────────────────────────────────────────
  console.log('--- NULL ROLL CHECK: SQL EXECUTED ---');
  console.log(NULL_SQL);
  const nullRows = (await p.$queryRawUnsafe(NULL_SQL)) as {
    count: string | number;
  }[];
  const nullCount = Number(nullRows[0]?.count ?? 0);
  console.log(
    `NULL ROLL COUNT (raw): ${nullCount} @ ${new Date().toISOString()} | run=full-school-3.2b-lite`
  );
  const nullOk = nullCount === 0;
  if (nullCount > 0) {
    console.log('--- NULL-ROLL STUDENTS (raw) ---');
    const nullStudents = (await p.$queryRawUnsafe(NULL_STUDENTS_SQL)) as {
      student_id: string;
      class_id: string;
      section_id: string | null;
      roll_number: string | null;
      status: string;
    }[];
    for (const s of nullStudents) console.log(JSON.stringify(s));
  }

  // ── Tenant isolation POST ──────────────────────────────────────────────────
  const tenantPost = (await p.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE school_id='fixture_school_b') AS enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE school_id='fixture_school_b') AS attendance,
            (SELECT COUNT(*) FROM guardians WHERE school_id='fixture_school_b') AS guardians`
  )) as { enrollments: string; attendance: string; guardians: string }[];
  const tenantOk =
    tenantPre[0].enrollments === tenantPost[0].enrollments &&
    tenantPre[0].attendance === tenantPost[0].attendance &&
    tenantPre[0].guardians === tenantPost[0].guardians;
  console.log(
    `TENANT POST (fixture_school_b): enrollments=${tenantPost[0].enrollments} attendance=${tenantPost[0].attendance} guardians=${tenantPost[0].guardians} | unchanged=${tenantOk}`
  );

  // ── POST state + verdict ───────────────────────────────────────────────────
  const [postAy2526, postAy2627, postPor, postStuPo] = await Promise.all([
    p.enrollment.count({
      where: { schoolId: SCHOOL, academicYearId: AY2526, status: 'ACTIVE' },
    }),
    p.enrollment.count({
      where: { schoolId: SCHOOL, academicYearId: AY2627, status: 'ACTIVE' },
    }),
    p.passedOutRecord.count({ where: { schoolId: SCHOOL } }),
    p.student.count({ where: { schoolId: SCHOOL, status: 'PASSED_OUT' } }),
  ]);
  console.log(
    `POST-STATE: ay2526_active=${postAy2526} ay2627_active=${postAy2627} passed_out_records=${postPor} students_passed_out=${postStuPo}`
  );
  console.log(
    `TOTAL WALL: ${(wallMs / 1000).toFixed(1)} s | job.durationMs=${j.durationMs}`
  );
  console.log(
    `FAILURE BREAKDOWN: ${j.failedStudents === 0 ? '0 failures' : `${j.failedStudents} failures - job.error=${j.error ?? 'null'}`}`
  );

  const pass =
    j.status === 'COMPLETED' &&
    j.failedStudents === 0 &&
    countsOk &&
    totalsOk &&
    auditOk &&
    dupOk &&
    nullOk &&
    tenantOk &&
    ls.lockTimeouts === 0 &&
    ls.deadlocks === 0 &&
    ls.otherFailures === 0;
  console.log('--- VERDICT ---');
  console.log(
    pass
      ? 'PHASE 3.2B (CONNECTION-LIGHT): PASS'
      : 'PHASE 3.2B: STOP CONDITION (see BLOCKED-3.2B.md)'
  );
  await p.$disconnect();
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
