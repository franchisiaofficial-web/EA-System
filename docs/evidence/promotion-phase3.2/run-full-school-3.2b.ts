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

const SCHOOL = 'seed_school_ea';
const OTHER_SCHOOL = 'fixture_school_b';
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

// ── pg_locks observer (cross-key evidence; sampling every 1 s) ───────────────
interface LockObs {
  t: string;
  pid: number;
  classid: number;
  objid: number;
  granted: boolean;
  mode: string;
}
const lockObs: LockObs[] = [];

async function observeAdvisoryLocks() {
  try {
    const rows = (await p.$queryRawUnsafe(
      `SELECT pid, classid, objid, granted, mode FROM pg_locks WHERE locktype='advisory' ORDER BY pid, classid, objid`
    )) as {
      pid: number;
      classid: number;
      objid: number;
      granted: boolean;
      mode: string;
    }[];
    const t = new Date().toISOString();
    for (const r of rows)
      lockObs.push({
        t,
        pid: Number(r.pid),
        classid: Number(r.classid),
        objid: Number(r.objid),
        granted: r.granted,
        mode: r.mode,
      });
  } catch (e) {
    console.log(
      `[observer] sample error: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

(async () => {
  console.log(
    `=== PHASE 3.2B FULL-SCHOOL VALIDATION ${new Date().toISOString()} ===`
  );
  console.log(
    `PROMOTION_WORKERS=${process.env.PROMOTION_WORKERS ?? '(unset -> default 6)'}`
  );
  console.log(
    `PRISMA_POOL_MAX=${process.env.PRISMA_POOL_MAX ?? '(unset -> default 6)'}`
  );
  console.log(`SCOPE=FULL SCHOOL (no classId)`);

  // ── 0. PRE-state ─────────────────────────────────────────────────────────────
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

  // ── Expected lock keys (target sections the run will serialize on) ──────────
  const expectedKeys = (await p.$queryRawUnsafe(
    `SELECT c.id AS class_id, c.name AS class_name, s.id AS section_id,
            hashtext(${`'${SCHOOL}'`})::bigint AS k1,
            hashtext(${`'${AY2627}'`} || c.id || s.id)::bigint AS k2
     FROM classes c JOIN sections s ON s.class_id = c.id
     WHERE c.school_id=${`'${SCHOOL}'`} AND c.academic_year_id=${`'${AY2627}'`}
       AND c.is_deleted = false AND s.status = 'ACTIVE'
     ORDER BY c.sort_order, s.name`
  )) as {
    class_id: string;
    class_name: string;
    section_id: string;
    k1: string;
    k2: string;
  }[];
  console.log('--- EXPECTED ADVISORY LOCK KEYS (per 2627 target section) ---');
  for (const k of expectedKeys)
    console.log(
      `${k.class_name} | class=${k.class_id} | section=${k.section_id} | key1=${k.k1} | key2=${k.k2}`
    );
  const expectedSet = new Set(expectedKeys.map((k) => `${k.k1}:${k.k2}`));

  // ── Tenant spot-check PRE ────────────────────────────────────────────────────
  const tenantPre = (await p.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE school_id=${`'${OTHER_SCHOOL}'`}) AS enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE school_id=${`'${OTHER_SCHOOL}'`}) AS attendance,
            (SELECT COUNT(*) FROM guardians WHERE school_id=${`'${OTHER_SCHOOL}'`}) AS guardians`
  )) as { enrollments: string; attendance: string; guardians: string }[];
  console.log(
    `TENANT PRE (${OTHER_SCHOOL}): enrollments=${tenantPre[0].enrollments} attendance=${tenantPre[0].attendance} guardians=${tenantPre[0].guardians}`
  );

  // ── Admin auth context ───────────────────────────────────────────────────────
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

  // ── Start observer ───────────────────────────────────────────────────────────
  const observer = setInterval(() => void observeAdvisoryLocks(), 1000);

  // ── Create the full-school job ───────────────────────────────────────────────
  const tStart = new Date();
  const tStartMs = Date.now();
  resetRollLockStats();
  console.log(
    '--- 1) create FULL-SCHOOL PromotionJob (no classId -> all grade transitions) ---'
  );
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

  // ── Poll DB state directly (source of truth: promotion_jobs + promotion_job_batches) ──
  console.log('--- 2) polling database state every 5 s ---');
  let terminal: { job: PromotionJob; batches: PromotionJobBatch[] } | null =
    null;
  const batchSeen = new Map<string, string>();
  let lastProgressLog = Date.now();
  for (let i = 0; i < 720; i++) {
    await sleep(5000);
    const jobRow = await p.promotionJob.findUnique({ where: { id: jobId } });
    const batchRows = await p.promotionJobBatch.findMany({
      where: { promotionJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
    if (!jobRow) {
      console.log('job row missing from DB');
      break;
    }

    for (const b of batchRows) {
      if (batchSeen.get(b.id) !== b.status) {
        const prev = batchSeen.get(b.id);
        batchSeen.set(b.id, b.status);
        console.log(
          `  [batch ${new Date().toISOString()}] ${b.transition}: ${prev ?? 'created'} -> ${b.status} (eligible=${b.eligible} processed=${b.processed} promoted=${b.promoted} passedOut=${b.passedOut} failed=${b.failed})`
        );
      }
    }
    const wallMin = ((Date.now() - tStartMs) / 1000 / 60).toFixed(1);
    if (Date.now() - lastProgressLog > 30000) {
      lastProgressLog = Date.now();
      console.log(
        `  [heartbeat ${new Date().toISOString()}] elapsed=${wallMin}min job=${jobRow.status} processed=${jobRow.processedStudents}/${jobRow.eligibleStudents} promoted=${jobRow.promotedStudents} passedOut=${jobRow.passedOutStudents} failed=${jobRow.failedStudents}`
      );
    }
    if (jobRow.status === 'COMPLETED' || jobRow.status === 'FAILED') {
      terminal = { job: jobRow, batches: batchRows };
      break;
    }
  }
  clearInterval(observer);
  if (!terminal) {
    console.log('ABORT: run did not reach terminal state within poll budget');
    await p.$disconnect();
    process.exit(1);
  }
  const wallMs = Date.now() - tStartMs;
  console.log(
    `--- 3) TERMINAL STATE: ${terminal.job.status} (wall ${(wallMs / 1000).toFixed(1)} s) ---`
  );

  // ── 4. Job row (raw, all fields) ─────────────────────────────────────────────
  console.log('--- PROMOTION_JOBS ROW (raw) ---');
  console.log(JSON.stringify(terminal.job, null, 2));
  console.log('--- PROMOTION_JOB_BATCHES ROWS (raw, all 13+) ---');
  for (const b of terminal.batches) {
    console.log(JSON.stringify(b));
  }
  console.log('--- PER-BATCH TIMING (startedAt -> completedAt) ---');
  for (const b of terminal.batches) {
    const d =
      b.startedAt && b.completedAt
        ? `${new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()}ms`
        : '(no timestamps)';
    console.log(
      `${b.transition} | status=${b.status} | eligible=${b.eligible} | promoted=${b.promoted} | passedOut=${b.passedOut} | failed=${b.failed} | ${d}`
    );
  }

  // ── 5. Lock stats (aggregated across the whole run) ──────────────────────────
  const ls = getRollLockStats();
  console.log('--- LOCK STATS (whole run, all mutex keys) ---');
  console.log(
    `acquisitions=${ls.acquisitions} waitMinMs=${ls.waitMinMs} waitAvgMs=${ls.waitAvgMs} waitMaxMs=${ls.waitMaxMs} waitP95Ms=${ls.waitP95Ms} lockTimeouts=${ls.lockTimeouts} deadlocks=${ls.deadlocks} mutexFailures=${ls.otherFailures} retryAttempts=${ls.retryAttempts}`
  );

  // ── 6. Reconciliation ─────────────────────────────────────────────────────────
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
       (SELECT COUNT(*) FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote' AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}' AND created_at >= $1::timestamptz) AS promote_audits,
       (SELECT COUNT(*) FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='student' AND action='pass_out' AND created_at >= $1::timestamptz) AS passout_audits,
       (SELECT COUNT(*) FROM (SELECT after->>'studentId' AS sid, COUNT(*) AS n FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote' AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}' AND created_at >= $1::timestamptz GROUP BY 1 HAVING COUNT(*) > 1) d) AS duplicate_audits`,
    tStart
  )) as {
    promote_audits: string;
    passout_audits: string;
    duplicate_audits: string;
  }[];
  console.log('--- AUDIT CROSS-CHECK (raw, run window) ---');
  console.log(
    `promote audits=${audits[0].promote_audits} | pass_out audits=${audits[0].passout_audits} | students with >1 promote audit=${audits[0].duplicate_audits}`
  );
  const auditOk =
    Number(audits[0].promote_audits) === j.promotedStudents &&
    Number(audits[0].passout_audits) === j.passedOutStudents &&
    Number(audits[0].duplicate_audits) === 0;
  console.log(`audit 1:1 with job counters: ${auditOk}`);

  // ── 7. Duplicate-roll invariant (raw SQL, full output) ───────────────────────
  console.log('--- DUPLICATE ROLL CHECK: SQL EXECUTED ---');
  console.log(DUP_SQL);
  const dupRows = (await p.$queryRawUnsafe(DUP_SQL)) as {
    section_id: string;
    assigned_rolls: string | number;
    unique_rolls: string | number;
  }[];
  console.log(
    `--- RAW DATABASE OUTPUT @ ${new Date().toISOString()} | run=full-school-3.2b ---`
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
  console.log(
    `DUPLICATE-ROLL PASS=${dupOk} (assigned_rolls == unique_rolls for EVERY section: ${dupOk ? 'yes' : 'NO'})`
  );

  // ── 8. NULL-roll report (raw SQL) ─────────────────────────────────────────────
  console.log('--- NULL ROLL CHECK: SQL EXECUTED ---');
  console.log(NULL_SQL);
  const nullRows = (await p.$queryRawUnsafe(NULL_SQL)) as {
    count: string | number;
  }[];
  const nullCount = Number(nullRows[0]?.count ?? 0);
  console.log(
    `NULL ROLL COUNT (raw): ${nullCount} @ ${new Date().toISOString()} | run=full-school-3.2b`
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

  // ── 9. Tenant isolation POST ──────────────────────────────────────────────────
  const tenantPost = (await p.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE school_id='${OTHER_SCHOOL}') AS enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE school_id='${OTHER_SCHOOL}') AS attendance,
            (SELECT COUNT(*) FROM guardians WHERE school_id='${OTHER_SCHOOL}') AS guardians`
  )) as { enrollments: string; attendance: string; guardians: string }[];
  const tenantOk =
    tenantPre[0].enrollments === tenantPost[0].enrollments &&
    tenantPre[0].attendance === tenantPost[0].attendance &&
    tenantPre[0].guardians === tenantPost[0].guardians;
  console.log(
    `TENANT POST (${OTHER_SCHOOL}): enrollments=${tenantPost[0].enrollments} attendance=${tenantPost[0].attendance} guardians=${tenantPost[0].guardians} | unchanged=${tenantOk}`
  );

  // ── CROSS-KEY ANALYSIS (from pg_locks observations) ──────────────────────────
  console.log('--- CROSS-KEY ANALYSIS (pg_locks observations) ---');
  console.log(`advisory-lock observations captured: ${lockObs.length}`);
  const obsKeys = new Map<
    string,
    { granted: number; waiting: number; pids: Set<number> }
  >();
  for (const o of lockObs) {
    const k = `${o.classid}:${o.objid}`;
    if (!obsKeys.has(k))
      obsKeys.set(k, { granted: 0, waiting: 0, pids: new Set() });
    const e = obsKeys.get(k)!;
    if (o.granted) e.granted++;
    else e.waiting++;
    e.pids.add(o.pid);
  }
  let foreignKeys = 0;
  for (const [k, e] of obsKeys) {
    const known = expectedSet.has(k);
    if (!known) foreignKeys++;
    console.log(
      `key=${k} | grantedSamples=${e.granted} waitingSamples=${e.waiting} distinctPids=${e.pids.size} | expectedKey=${known ? 'YES' : 'NO - FOREIGN'}`
    );
  }
  console.log(`foreign (unexpected) keys observed: ${foreignKeys}`);

  // sample-level: max distinct keys granted at one instant; waiters share the granted key
  const bySample = new Map<
    string,
    { granted: Set<string>; waiting: Set<string> }
  >();
  for (const o of lockObs) {
    if (!bySample.has(o.t))
      bySample.set(o.t, { granted: new Set(), waiting: new Set() });
    const s = bySample.get(o.t)!;
    (o.granted ? s.granted : s.waiting).add(`${o.classid}:${o.objid}`);
  }
  let maxConcurrent = 0;
  let crossKeyWaits = 0;
  let weirdSamples = 0;
  for (const [, s] of bySample) {
    maxConcurrent = Math.max(maxConcurrent, s.granted.size);
    if (
      s.waiting.size > 0 &&
      (s.granted.size === 0 || ![...s.waiting].every((w) => s.granted.has(w)))
    ) {
      crossKeyWaits++;
      console.log(
        `  CROSS-KEY WAIT SAMPLE ${new Date().toISOString()}: granted=[${[...s.granted]}] waiting=[${[...s.waiting]}]`
      );
    }
    if (s.granted.size > 1) weirdSamples++;
  }
  console.log(`max distinct keys granted simultaneously: ${maxConcurrent}`);
  console.log(`samples with >1 key granted at once: ${weirdSamples}`);
  console.log(
    `samples where a waiter's key differed from the granted key (cross-key wait): ${crossKeyWaits}`
  );
  const crossKeyOk =
    foreignKeys === 0 &&
    maxConcurrent <= 1 &&
    crossKeyWaits === 0 &&
    weirdSamples === 0;
  console.log(
    `cross-key independence: ${crossKeyOk ? 'VERIFIED (no cross-key interaction observed)' : 'ANOMALY'}`
  );
  console.log(
    'Limitation: pg_locks sampled every 1 s; sub-second granted holds may be missed, but lock WAITS (0.4-2.2 s) are well within the sampling window and are captured as granted=false entries.'
  );

  // ── POST state + verdict ──────────────────────────────────────────────────────
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

  const failureBreakdown =
    j.failedStudents > 0
      ? `FAILURES PRESENT (${j.failedStudents}) - see job.error=${j.error ?? 'null'}`
      : '0 failures - no breakdown needed';
  console.log(`FAILURE BREAKDOWN: ${failureBreakdown}`);

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
    ls.otherFailures === 0 &&
    crossKeyOk;
  console.log('--- VERDICT ---');
  console.log(
    pass
      ? 'PHASE 3.2B: PASS'
      : 'PHASE 3.2B: STOP CONDITION (see BLOCKED-3.2B.md)'
  );

  await p.$disconnect();
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
