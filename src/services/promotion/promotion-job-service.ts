// ============================================
// PromotionJob orchestration (Phase 2 — Promotion Engine architecture)
//
// Architecture:
//   PromotionJob (parent, per promotion run)
//     └── PromotionJobBatch (progress / retry / reporting boundary per
//                            transition — e.g. "Grade 1 → Grade 2")
//           └── Student promotion (per-student atomic transaction — unchanged)
//
// Execution model:
//   - POST /api/promotions creates a PromotionJob and returns HTTP 202 with the
//     jobId immediately. The job is executed in the background by a GLOBAL
//     worker scheduler (in-process, self-hosted Node) — jobs are serialized, so
//     at any time exactly ONE promotion run is active and its per-batch worker
//     pool (PARALLEL_WORKERS from promotion-service) is the global pool.
//   - Each PromotionJobBatch runs through runPromotionBatch with classId =
//     the batch's source class. Per-student atomicity, per-student audit,
//     RLS tenant isolation and the roll-collision retry policy are unchanged.
//   - Retry is idempotent by construction: a retry job re-runs only the FAILED
//     batches, and runPromotionBatch re-derives eligibility from the DB
//     (source enrollment status = ACTIVE). Already-promoted students are
//     naturally excluded — no duplicate enrollments, PassedOutRecords or
//     audits are possible (enforced by the per-student ACTIVE partial unique
//     index + source-status check).
// ============================================

import {
  rlsPrisma,
  withRls,
  type RequestContext,
} from '@/lib/prisma/rls-middleware';
import type { AuthContext } from '@/lib/auth/context';
import { runPromotionBatch } from './promotion-service';

export interface CreatePromotionJobInput {
  schoolId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  classId?: string;
  retryClassIds?: string[];
}

interface JobRuntime {
  ctx: RequestContext;
  authCtx: AuthContext;
}

// ── Global scheduler (one global pool; jobs serialized) ─────────────────────
const jobQueue: string[] = [];
const jobRuntimes = new Map<string, JobRuntime>();
let processing = false;

export function enqueuePromotionJob(
  jobId: string,
  ctx: RequestContext,
  authCtx: AuthContext
): void {
  jobRuntimes.set(jobId, { ctx, authCtx });
  jobQueue.push(jobId);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (jobQueue.length > 0) {
      const jobId = jobQueue.shift()!;
      const rt = jobRuntimes.get(jobId);
      if (!rt) continue;
      try {
        await executePromotionJob(jobId, rt);
      } catch (e) {
        console.error(`[PromotionJob ${jobId}] scheduler error:`, e);
      } finally {
        jobRuntimes.delete(jobId);
      }
    }
  } finally {
    processing = false;
  }
}

// ── Job creation ────────────────────────────────────────────────────────────
export async function createPromotionJob(
  input: CreatePromotionJobInput,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  const existing = await withRls(ctx, (tx) =>
    tx.promotionJob.findFirst({
      where: {
        schoolId: input.schoolId,
        fromAcademicYearId: input.fromAcademicYearId,
        toAcademicYearId: input.toAcademicYearId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })
  );
  if (existing) {
    return { job: existing, duplicate: true as const };
  }

  const job = await withRls(ctx, (tx) =>
    tx.promotionJob.create({
      data: {
        schoolId: input.schoolId,
        fromAcademicYearId: input.fromAcademicYearId,
        toAcademicYearId: input.toAcademicYearId,
        classId: input.classId ?? null,
        retryClassIds: input.retryClassIds ?? [],
        createdBy: authCtx.userId,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    })
  );
  enqueuePromotionJob(job.id, ctx, authCtx);
  return { job, duplicate: false as const };
}

// ── Progress view (GET /api/promotions/jobs/:jobId) ─────────────────────────
export async function getPromotionJob(jobId: string, ctx: RequestContext) {
  return withRls(ctx, async (tx) => {
    const job = await tx.promotionJob.findUnique({ where: { id: jobId } });
    if (!job) return null;
    const batches = await tx.promotionJobBatch.findMany({
      where: { promotionJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });

    const eligible = job.eligibleStudents;
    const processed = job.processedStudents;
    const percentage =
      eligible > 0
        ? Math.min(100, Math.round((processed / eligible) * 100))
        : 0;

    const current =
      batches.find((b) => b.status === 'RUNNING') ??
      batches.find((b) => b.status === 'PENDING') ??
      null;

    let etaMs: number | null = null;
    if (
      job.status === 'RUNNING' &&
      job.startedAt &&
      eligible > 0 &&
      processed > 0
    ) {
      const elapsed = Date.now() - job.startedAt.getTime();
      etaMs = Math.round((elapsed / processed) * (eligible - processed));
    }

    return {
      id: job.id,
      status: job.status,
      fromAcademicYearId: job.fromAcademicYearId,
      toAcademicYearId: job.toAcademicYearId,
      eligible,
      processed,
      promoted: job.promotedStudents,
      passedOut: job.passedOutStudents,
      failed: job.failedStudents,
      percentage,
      currentBatch: current
        ? {
            id: current.id,
            transition: current.transition,
            status: current.status,
            promoted: current.promoted,
            processed: current.processed,
            eligible: current.eligible,
          }
        : null,
      batches: batches.map((b) => ({
        id: b.id,
        transition: b.transition,
        status: b.status,
        eligible: b.eligible,
        processed: b.processed,
        promoted: b.promoted,
        passedOut: b.passedOut,
        failed: b.failed,
      })),
      etaMs,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs: job.durationMs,
      error: job.error,
    };
  });
}

// ── Batch planning ──────────────────────────────────────────────────────────
interface BatchPlanItem {
  sourceClassId: string | null;
  sourceClassName: string;
  targetClassId: string | null;
  targetClassName: string;
  transition: string;
  eligible: number;
}

async function buildBatchPlan(
  job: {
    schoolId: string;
    fromAcademicYearId: string;
    toAcademicYearId: string;
    classId: string | null;
    retryClassIds: string[];
  },
  ctx: RequestContext
): Promise<BatchPlanItem[]> {
  return withRls(ctx, async (tx) => {
    const settings = await tx.schoolSettings.findUnique({
      where: { schoolId: job.schoolId },
    });
    const grades: string[] = Array.isArray(settings?.grades)
      ? (settings!.grades as string[])
      : [];

    const [sourceClasses, targetClasses] = await Promise.all([
      tx.class.findMany({
        where: {
          schoolId: job.schoolId,
          academicYearId: job.fromAcademicYearId,
          isDeleted: false,
        },
        orderBy: { sortOrder: 'asc' },
      }),
      tx.class.findMany({
        where: {
          schoolId: job.schoolId,
          academicYearId: job.toAcademicYearId,
          isDeleted: false,
        },
      }),
    ]);
    const targetByGrade = new Map<string, { id: string; name: string }>();
    for (const c of targetClasses) {
      if (c.gradeLevel)
        targetByGrade.set(c.gradeLevel, { id: c.id, name: c.name });
    }

    const plan: BatchPlanItem[] = [];
    for (const c of sourceClasses) {
      if (job.classId && c.id !== job.classId) continue;
      if (job.retryClassIds.length > 0 && !job.retryClassIds.includes(c.id))
        continue;

      const grade = c.gradeLevel ?? null;
      let target: { id: string | null; name: string } = { id: null, name: '—' };
      if (grade && grades.length > 0) {
        const idx = grades.indexOf(grade);
        if (idx === grades.length - 1) {
          target = { id: null, name: 'Passed Out' };
        } else if (idx >= 0) {
          const t = targetByGrade.get(grades[idx + 1]);
          target = t
            ? { id: t.id, name: t.name }
            : { id: null, name: 'Not configured' };
        }
      }

      const eligible = await tx.enrollment.count({
        where: {
          schoolId: job.schoolId,
          academicYearId: job.fromAcademicYearId,
          status: 'ACTIVE',
          classId: c.id,
        },
      });
      if (eligible === 0) continue;

      plan.push({
        sourceClassId: c.id,
        sourceClassName: c.name,
        targetClassId: target.id,
        targetClassName: target.name,
        transition: `${c.name} → ${target.name}`,
        eligible,
      });
    }
    return plan;
  });
}

// ── Execution ───────────────────────────────────────────────────────────────
async function executePromotionJob(
  jobId: string,
  rt: JobRuntime
): Promise<void> {
  const { ctx } = rt;
  const job = await rlsPrisma.promotionJob.findUnique({ where: { id: jobId } });
  if (
    !job ||
    job.status === 'COMPLETED' ||
    job.status === 'FAILED' ||
    job.status === 'RUNNING'
  )
    return;

  const started = Date.now();
  await withRls(ctx, (tx) =>
    tx.promotionJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    })
  );

  try {
    const plan = await buildBatchPlan(job, ctx);
    const totalEligible = plan.reduce((a, b) => a + b.eligible, 0);

    const batches = await withRls(ctx, (tx) =>
      Promise.all(
        plan.map((p) =>
          tx.promotionJobBatch.create({
            data: {
              promotionJobId: jobId,
              sourceClassId: p.sourceClassId,
              sourceClassName: p.sourceClassName,
              targetClassId: p.targetClassId,
              targetClassName: p.targetClassName,
              transition: p.transition,
              eligible: p.eligible,
            },
          })
        )
      )
    );
    await withRls(ctx, (tx) =>
      tx.promotionJob.update({
        where: { id: jobId },
        data: { eligibleStudents: totalEligible },
      })
    );

    const jobCounters = { processed: 0, promoted: 0, passedOut: 0, failed: 0 };

    const persistJob = () =>
      withRls(ctx, (tx) =>
        tx.promotionJob.update({
          where: { id: jobId },
          data: {
            processedStudents: jobCounters.processed,
            promotedStudents: jobCounters.promoted,
            passedOutStudents: jobCounters.passedOut,
            failedStudents: jobCounters.failed,
          },
        })
      );

    for (const batch of batches) {
      await withRls(ctx, (tx) =>
        tx.promotionJobBatch.update({
          where: { id: batch.id },
          data: { status: 'RUNNING', startedAt: new Date() },
        })
      );

      const batchCounters = {
        processed: 0,
        promoted: 0,
        passedOut: 0,
        failed: 0,
      };
      let timer: NodeJS.Timeout | null = null;
      const jobBase = { ...jobCounters };

      const persistProgress = () => {
        void withRls(ctx, (tx) =>
          tx.promotionJobBatch.update({
            where: { id: batch.id },
            data: {
              processed: batchCounters.processed,
              promoted: batchCounters.promoted,
              passedOut: batchCounters.passedOut,
              failed: batchCounters.failed,
            },
          })
        ).catch((e) =>
          console.error(
            `[PromotionJob ${jobId}] batch progress persist failed:`,
            e
          )
        );
        jobCounters.processed = jobBase.processed + batchCounters.processed;
        jobCounters.promoted = jobBase.promoted + batchCounters.promoted;
        jobCounters.passedOut = jobBase.passedOut + batchCounters.passedOut;
        jobCounters.failed = jobBase.failed + batchCounters.failed;
        void persistJob().catch((e) =>
          console.error(
            `[PromotionJob ${jobId}] job progress persist failed:`,
            e
          )
        );
      };

      try {
        const summary = await runPromotionBatch(
          {
            schoolId: job.schoolId,
            fromAcademicYearId: job.fromAcademicYearId,
            toAcademicYearId: job.toAcademicYearId,
            classId: batch.sourceClassId ?? undefined,
            items: [],
            onProgress: (p) => {
              batchCounters.processed = p.processed;
              batchCounters.promoted = p.promoted;
              batchCounters.passedOut = p.passedOut;
              batchCounters.failed = p.failed;
              if (!timer) {
                timer = setTimeout(() => {
                  timer = null;
                  persistProgress();
                }, 800);
              }
            },
          },
          rt.authCtx,
          ctx
        );

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        persistProgress();

        const status = summary.failed.length > 0 ? 'FAILED' : 'COMPLETED';
        await withRls(ctx, (tx) =>
          tx.promotionJobBatch.update({
            where: { id: batch.id },
            data: {
              status,
              completedAt: new Date(),
              processed:
                summary.promoted +
                summary.passedOut +
                summary.skipped +
                summary.failed.length,
              promoted: summary.promoted,
              passedOut: summary.passedOut,
              failed: summary.failed.length,
            },
          })
        );
        await persistJob();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await withRls(ctx, (tx) =>
          tx.promotionJobBatch.update({
            where: { id: batch.id },
            data: { status: 'FAILED', completedAt: new Date() },
          })
        ).catch(() => {});
        throw new Error(`Batch "${batch.transition}" failed: ${msg}`);
      }
    }

    await withRls(ctx, (tx) =>
      tx.promotionJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          durationMs: Date.now() - started,
        },
      })
    );
    console.log(
      `[PromotionJob ${jobId}] completed in ${Date.now() - started}ms (${totalEligible} eligible)`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await withRls(ctx, (tx) =>
      tx.promotionJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs: Date.now() - started,
          error: msg.slice(0, 2000),
        },
      })
    ).catch((err) =>
      console.error(`[PromotionJob ${jobId}] mark FAILED failed:`, err)
    );
    console.error(`[PromotionJob ${jobId}] FAILED: ${msg}`);
  }
}
