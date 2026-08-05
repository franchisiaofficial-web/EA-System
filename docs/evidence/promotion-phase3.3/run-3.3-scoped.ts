import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type PromotionJob,
  type PromotionJobBatch,
} from '../../../src/generated/prisma/client';
import { createPromotionJob } from '../../../src/services/promotion/promotion-job-service';
import { buildContext } from '../../../src/lib/prisma/rls-middleware';
import {
  resetRollLockStats,
  getRollLockStats,
} from '../../../src/services/promotion/promotion-roll-lock';

// Phase 3.3 scoped verification harness (section preservation + mutex-key proof).
// Scenario-driven (SCENARIO env): primary | fallback | overflow | passout
//   - primary:  Grade 5 -> Grade 6 (seed_cls_2526_g07, 40/40/40 -> empty g08)
//   - fallback: Grade 3 -> Grade 4 (g05 -> g06) with g06_c deactivated (no matching name)
//   - overflow: Grade 1 -> Grade 2 (g03 -> g04) with g04_b capacity=0 (at capacity)
//   - passout:  Grade 12 -> Passed Out (seed_cls_2526_g14)
// Runs the class-scoped PromotionJob (production path, global scheduler),
// observes pg_locks advisory keys during the run, then prints raw evidence.

const SCHOOL = 'seed_school_ea';
const AY2526 = 'seed_ay_2526';
const AY2627 = 'seed_ay_2627';
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SCENARIO = process.env.SCENARIO ?? 'primary';
const RUN_CLASS = process.env.RUN_CLASS!;
const TARGET_CLASS = process.env.TARGET_CLASS!;
const DEACTIVATE_SEC = process.env.DEACTIVATE_SEC; // fallback: section to set INACTIVE before run
const CAPACITY_ZERO_SEC = process.env.CAPACITY_ZERO_SEC; // overflow: section to set capacity=0 before run

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

const asNum = (v: string | number | null) => Number(v ?? 0);
const toNum = (v: unknown): number =>
  typeof v === 'bigint' ? Number(v) : Number(v as number);

(async () => {
  console.log(
    `=== PHASE 3.3 SCOPED VERIFICATION ${new Date().toISOString()} | SCENARIO=${SCENARIO} ===`
  );
  console.log(
    `PROMOTION_WORKERS=${process.env.PROMOTION_WORKERS ?? '(unset -> default 6)'}`
  );
  console.log(`RUN_CLASS=${RUN_CLASS} TARGET_CLASS=${TARGET_CLASS}`);
  if (DEACTIVATE_SEC) console.log(`TWEAK: DEACTIVATE_SEC=${DEACTIVATE_SEC}`);
  if (CAPACITY_ZERO_SEC)
    console.log(`TWEAK: CAPACITY_ZERO_SEC=${CAPACITY_ZERO_SEC}`);

  // ── PRE state (certified baseline check) ────────────────────────────────────
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

  // ── Apply scenario tweak (recorded for restore in the caller) ───────────────
  if (DEACTIVATE_SEC) {
    const before = await p.section.findUnique({
      where: { id: DEACTIVATE_SEC },
      select: { status: true },
    });
    console.log(
      `TWEAK applied: ${DEACTIVATE_SEC} status ${before?.status} -> INACTIVE`
    );
    await p.section.update({
      where: { id: DEACTIVATE_SEC },
      data: { status: 'INACTIVE' },
    });
  }
  if (CAPACITY_ZERO_SEC) {
    const before = await p.section.findUnique({
      where: { id: CAPACITY_ZERO_SEC },
      select: { capacity: true },
    });
    console.log(
      `TWEAK applied: ${CAPACITY_ZERO_SEC} capacity ${before?.capacity} -> 0`
    );
    await p.section.update({
      where: { id: CAPACITY_ZERO_SEC },
      data: { capacity: 0 },
    });
  }

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

  // ── Create class-scoped job + start pg_locks advisory observer ──────────────
  const tStart = new Date();
  const tStartMs = Date.now();
  resetRollLockStats();
  const { job, duplicate } = await createPromotionJob(
    {
      schoolId: SCHOOL,
      fromAcademicYearId: AY2526,
      toAcademicYearId: AY2627,
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
    console.log('ABORT: duplicate job returned');
    await p.$disconnect();
    process.exit(1);
  }
  const jobId = job.id;

  // pg_locks observer (granted advisory locks only, 500 ms sampling).
  const observedKeys = new Map<number, string>(); // unsigned objid -> first seen iso
  let maxConcurrentKeys = 0;
  let samples = 0;
  let obsStopped = false;
  void (async () => {
    while (!obsStopped) {
      try {
        const rows =
          (await p.$queryRaw`SELECT classid, objid, database, pid, granted FROM pg_locks WHERE locktype='advisory' AND granted`) as {
            classid: number;
            objid: number;
            database: string;
            pid: number;
          }[];
        samples++;
        const granted = new Set<number>();
        for (const r of rows) {
          const objid = toNum(r.objid);
          const unsignedObjid = objid < 0 ? objid + 4294967296 : objid;
          observedKeys.set(unsignedObjid, new Date().toISOString());
          granted.add(unsignedObjid);
        }
        if (granted.size > maxConcurrentKeys) maxConcurrentKeys = granted.size;
      } catch {
        /* ignore transient errors */
      }
      await sleep(500);
    }
  })();

  // ── Poll job to terminal (2 s) ──────────────────────────────────────────────
  let terminal: { job: PromotionJob; batches: PromotionJobBatch[] } | null =
    null;
  for (let i = 0; i < 240; i++) {
    await sleep(2000);
    const jobRow = await p.promotionJob.findUnique({ where: { id: jobId } });
    const batchRows = await p.promotionJobBatch.findMany({
      where: { promotionJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
    if (!jobRow) {
      console.log('job row missing from DB');
      break;
    }
    if (
      i % 5 === 0 ||
      jobRow.status === 'COMPLETED' ||
      jobRow.status === 'FAILED'
    ) {
      console.log(
        `poll ${i}: status=${jobRow.status} processed=${jobRow.processedStudents}/${jobRow.eligibleStudents} promoted=${jobRow.promotedStudents} passedOut=${jobRow.passedOutStudents} failed=${jobRow.failedStudents}`
      );
    }
    if (jobRow.status === 'COMPLETED' || jobRow.status === 'FAILED') {
      terminal = { job: jobRow, batches: batchRows };
      break;
    }
  }
  obsStopped = true;
  const wallMs = Date.now() - tStartMs;
  if (!terminal) {
    console.log('ABORT: no terminal state');
    await p.$disconnect();
    process.exit(1);
  }
  console.log(
    `--- JOB TERMINAL: ${terminal.job.status} (wall ${(wallMs / 1000).toFixed(1)} s; pg_locks samples=${samples}) ---`
  );

  // ── Raw job/batch rows ──────────────────────────────────────────────────────
  console.log('--- PROMOTION_JOBS ROW (raw) ---');
  const j = terminal.job;
  console.log(
    JSON.stringify({
      id: j.id,
      status: j.status,
      eligibleStudents: j.eligibleStudents,
      processedStudents: j.processedStudents,
      promotedStudents: j.promotedStudents,
      passedOutStudents: j.passedOutStudents,
      failedStudents: j.failedStudents,
      error: j.error,
      durationMs: j.durationMs,
    })
  );
  console.log('--- PROMOTION_JOB_BATCHES ROWS (raw) ---');
  for (const b of terminal.batches) {
    const d =
      b.startedAt && b.completedAt
        ? `${new Date(b.completedAt).getTime() - new Date(b.startedAt).getTime()}ms`
        : '(no timestamps)';
    console.log(
      `${b.transition} | eligible=${b.eligible} processed=${b.processed} promoted=${b.promoted} passedOut=${b.passedOut} failed=${b.failed} | ${d}`
    );
  }

  // ── Mutex-key verification (Phase 3.3 STOP check) ───────────────────────────
  console.log(
    '--- MUTEX-KEY VERIFICATION (pg_locks advisory keys observed) ---'
  );
  console.log(
    `observed distinct advisory key2s (unsigned oid): ${observedKeys.size} | max concurrently granted: ${maxConcurrentKeys}`
  );
  for (const [k, when] of [...observedKeys.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    console.log(
      `  key2=unsigned ${k} (signed ${k >= 2147483648 ? k - 4294967296 : k}) firstSeen=${when}`
    );
  }
  const secRows = (await p.$queryRawUnsafe(
    `SELECT id, name FROM sections WHERE class_id='${TARGET_CLASS}' AND status='ACTIVE' ORDER BY name`
  )) as { id: string; name: string }[];
  console.log(
    `expected lock key2s for target class ${TARGET_CLASS} (hashtext('${AY2627}' || classId || sectionId)):`
  );
  const expectedKeySet = new Set<number>();
  for (const s of secRows) {
    const h = (await p.$queryRawUnsafe(
      `SELECT hashtext($1::text) AS h`,
      `${AY2627}${TARGET_CLASS}${s.id}`
    )) as { h: number }[];
    const signed = toNum(h[0].h);
    const unsigned = signed < 0 ? signed + 4294967296 : signed;
    expectedKeySet.add(unsigned);
    console.log(
      `  ${s.id} (${s.name}) -> signed ${signed} | unsigned ${unsigned} | observed=${observedKeys.has(unsigned)}`
    );
  }
  // Sections actually written (must equal the locked sections).
  const written = (await p.$queryRawUnsafe(
    `SELECT DISTINCT section_id FROM enrollments WHERE school_id='${SCHOOL}' AND academic_year_id='${AY2627}' AND class_id='${TARGET_CLASS}'`
  )) as { section_id: string }[];
  const writtenKeys = new Set<number>();
  for (const w of written) {
    const h = (await p.$queryRawUnsafe(
      `SELECT hashtext($1::text) AS h`,
      `${AY2627}${TARGET_CLASS}${w.section_id}`
    )) as { h: number }[];
    const signed = toNum(h[0].h);
    const unsigned = signed < 0 ? signed + 4294967296 : signed;
    writtenKeys.add(unsigned);
  }
  console.log(
    `sections WRITTEN in ${TARGET_CLASS}: ${written
      .map((w) => w.section_id)
      .sort()
      .join(', ')}`
  );
  const keyOk =
    observedKeys.size === writtenKeys.size &&
    [...writtenKeys].every((k) => observedKeys.has(k)) &&
    maxConcurrentKeys > 1;
  const wroteTargetSection = writtenKeys.size > 0 && j.promotedStudents > 0;
  const keyVerdict = !wroteTargetSection
    ? 'SKIPPED (no target-section writes this run — e.g. passout-only: no inserts, hence no locks, by design)'
    : `PASS requires observed==written & >1 concurrent: ${keyOk}`;
  console.log(`MUTEX-KEY CHECK (lock key == resolved section, NOT firstSectionId): ${keyOk}
  (observed distinct keys=${observedKeys.size}, written distinct keys=${writtenKeys.size}, max concurrent granted=${maxConcurrentKeys}; ${keyVerdict})`);

  // ── Section-distribution evidence (raw SQL: target class by section) ───────
  console.log('--- SECTION DISTRIBUTION (target class raw SQL) ---');
  console.log('SQL EXECUTED:');
  console.log(`SELECT sec.name AS section_letter, sec.id AS section_id, COUNT(e.id)::int AS students
FROM enrollments e JOIN sections sec ON sec.id = e.section_id
WHERE e.school_id='${SCHOOL}' AND e.academic_year_id='${AY2627}' AND e.class_id='${TARGET_CLASS}'
GROUP BY sec.name, sec.id ORDER BY sec.name;`);
  const distRows = (await p.$queryRawUnsafe(
    `SELECT sec.name AS section_letter, sec.id AS section_id, COUNT(e.id)::int AS students
     FROM enrollments e JOIN sections sec ON sec.id = e.section_id
     WHERE e.school_id='${SCHOOL}' AND e.academic_year_id='${AY2627}' AND e.class_id='${TARGET_CLASS}'
     GROUP BY sec.name, sec.id ORDER BY sec.name`
  )) as { section_letter: string; section_id: string; students: number }[];
  console.log('--- RAW DATABASE OUTPUT ---');
  for (const r of distRows.length
    ? distRows
    : [{ section_letter: '(none)', section_id: '(none)', students: 0 }]) {
    console.log(
      `${TARGET_CLASS} | Section ${r.section_letter} : ${r.students} students (${r.section_id})`
    );
  }

  // ── Source->target per-student mapping (raw) ────────────────────────────────
  console.log('--- SOURCE->TARGET SECTION MAPPING (per student, raw) ---');
  const mapping = (await p.$queryRawUnsafe(
    `SELECT tgt.student_id AS student_id,
            src_s.name AS source_section, src.roll_number AS source_roll,
            tgt_s.name AS target_section, tgt.roll_number AS target_roll
     FROM enrollments tgt
     JOIN enrollments src ON src.student_id = tgt.student_id AND src.academic_year_id='${AY2526}' AND src.status='PROMOTED'
     JOIN sections src_s ON src_s.id = src.section_id
     JOIN sections tgt_s ON tgt_s.id = tgt.section_id
     WHERE tgt.academic_year_id='${AY2627}' AND tgt.class_id='${TARGET_CLASS}'
     ORDER BY src_s.name, src.roll_number`
  )) as {
    student_id: string;
    source_section: string;
    source_roll: string;
    target_section: string;
    target_roll: string;
  }[];
  for (const m of mapping)
    console.log(
      `${m.student_id} | source=${m.source_section} roll=${m.source_roll} -> target=${m.target_section} roll=${m.target_roll}`
    );

  // ── Roll preservation ───────────────────────────────────────────────────────
  const srcRollRows = (await p.$queryRawUnsafe(
    `SELECT src_s.name AS source_section, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE src.roll_number = tgt.roll_number)::int AS preserved
     FROM enrollments tgt
     JOIN enrollments src ON src.student_id = tgt.student_id AND src.academic_year_id='${AY2526}' AND src.status='PROMOTED'
     JOIN sections src_s ON src_s.id = src.section_id
     WHERE tgt.academic_year_id='${AY2627}' AND tgt.class_id='${TARGET_CLASS}'
     GROUP BY src_s.name ORDER BY src_s.name`
  )) as { source_section: string; n: number; preserved: number }[];
  console.log('--- ROLL-NUMBER PRESERVATION (source roll == target roll) ---');
  for (const r of srcRollRows)
    console.log(`source ${r.source_section}: preserved ${r.preserved}/${r.n}`);

  // ── Audit markers (sectionFallback / sectionOverflowFallback) ──────────────
  console.log('--- AUDIT MARKERS (raw counts in run window) ---');
  const markers = (await p.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote'
        AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}'
        AND COALESCE(after->>'sectionOverflowFallback','false')='true' AND created_at >= $1::timestamptz) AS overflow_markers,
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote'
        AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}'
        AND after->>'sectionFallback'='no_matching_section' AND created_at >= $1::timestamptz) AS nomatch_markers`,
    tStart
  )) as { overflow_markers: number; nomatch_markers: number }[];
  console.log(
    `sectionOverflowFallback=true audits: ${markers[0].overflow_markers}`
  );
  console.log(
    `sectionFallback='no_matching_section' audits: ${markers[0].nomatch_markers}`
  );

  // ── Duplicate-roll + NULL-roll + tenant + reconciliation ────────────────────
  console.log('--- DUPLICATE ROLL CHECK: SQL EXECUTED ---');
  console.log(DUP_SQL);
  const dupRows = (await p.$queryRawUnsafe(DUP_SQL)) as {
    section_id: string;
    assigned_rolls: string | number;
    unique_rolls: string | number;
  }[];
  console.log(
    `--- RAW DATABASE OUTPUT @ ${new Date().toISOString()} | scenario=${SCENARIO} ---`
  );
  let dupOk = true;
  for (const r of dupRows) {
    const assigned = asNum(r.assigned_rolls);
    const unique = asNum(r.unique_rolls);
    const ok = assigned === unique;
    if (!ok) dupOk = false;
    console.log(
      `${r.section_id} | assigned_rolls=${assigned} | unique_rolls=${unique} | ${ok ? 'OK' : 'VIOLATION'}`
    );
  }
  console.log(`DUPLICATE-ROLL PASS=${dupOk}`);
  console.log('--- NULL ROLL CHECK: SQL EXECUTED ---');
  console.log(NULL_SQL);
  const nullRows = (await p.$queryRawUnsafe(NULL_SQL)) as {
    count: string | number;
  }[];
  const nullCount = asNum(nullRows[0]?.count);
  console.log(
    `NULL ROLL COUNT (raw): ${nullCount} @ ${new Date().toISOString()} | scenario=${SCENARIO}`
  );

  const ls = getRollLockStats();
  console.log('--- LOCK STATS (application timing) ---');
  console.log(
    `acquisitions=${ls.acquisitions} waitMinMs=${ls.waitMinMs} waitAvgMs=${ls.waitAvgMs} waitP95Ms=${ls.waitP95Ms} waitMaxMs=${ls.waitMaxMs} lockTimeouts=${ls.lockTimeouts} mutexFailures=${ls.otherFailures} deadlocks=${ls.deadlocks} retryAttempts=${ls.retryAttempts}`
  );

  const countsOk = j.eligibleStudents === j.processedStudents;
  const totalsOk =
    j.processedStudents ===
    j.promotedStudents + j.passedOutStudents + j.failedStudents;
  const auditRows = (await p.$queryRawUnsafe(
    `SELECT
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='enrollment' AND action='promote' AND after->>'fromAcademicYearId'='${AY2526}' AND after->>'toAcademicYearId'='${AY2627}' AND created_at >= $1::timestamptz) AS promote_audits,
       (SELECT COUNT(*)::int FROM audit_logs WHERE school_id='${SCHOOL}' AND entity='student' AND action='pass_out' AND created_at >= $1::timestamptz) AS passout_audits`,
    tStart
  )) as { promote_audits: number; passout_audits: number }[];
  const auditOk =
    auditRows[0].promote_audits === j.promotedStudents &&
    auditRows[0].passout_audits === j.passedOutStudents;
  console.log(
    `RECONCILIATION: eligible==processed=${countsOk} | processed==promoted+passedOut+failed=${totalsOk} | audits 1:1=${auditOk} (promote=${auditRows[0].promote_audits} vs ${j.promotedStudents} | passout=${auditRows[0].passout_audits} vs ${j.passedOutStudents})`
  );

  // ── Tenant + verdict ────────────────────────────────────────────────────────
  const tenant = (await p.$queryRawUnsafe(
    `SELECT (SELECT COUNT(*) FROM enrollments WHERE school_id='fixture_school_b') AS enrollments,
            (SELECT COUNT(*) FROM attendance_records WHERE school_id='fixture_school_b') AS attendance,
            (SELECT COUNT(*) FROM guardians WHERE school_id='fixture_school_b') AS guardians`
  )) as { enrollments: string; attendance: string; guardians: string }[];
  console.log(
    `TENANT (fixture_school_b): enrollments=${tenant[0].enrollments} attendance=${tenant[0].attendance} guardians=${tenant[0].guardians}`
  );

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
    '--- VERDICT (correctness only; timing incidental, not evaluated) ---'
  );
  console.log(
    `wall=${(wallMs / 1000).toFixed(1)} s (incidental) | job.durationMs=${j.durationMs}`
  );
  const passed =
    j.status === 'COMPLETED' &&
    j.failedStudents === 0 &&
    countsOk &&
    totalsOk &&
    auditOk &&
    dupOk &&
    nullCount === 0 &&
    ls.lockTimeouts === 0 &&
    ls.deadlocks === 0 &&
    ls.otherFailures === 0 &&
    (!wroteTargetSection || keyOk);
  console.log(
    passed
      ? `SCENARIO ${SCENARIO}: PASS`
      : `SCENARIO ${SCENARIO}: STOP CONDITION (see BLOCKED-3.3.md)`
  );
  await p.$disconnect();
  process.exit(passed ? 0 : 2);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
