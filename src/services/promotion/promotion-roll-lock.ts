import type { PrismaTransactionClient } from '@/lib/prisma/rls-middleware';

// ============================================
// Phase 3.2 — Section-level mutual exclusion for roll allocation
// (Approved ADR: Option A — Serialize Per Section)
//
// Every roll ALLOCATION path in the promotion engine must acquire the section
// mutex before determining/inserting a roll number. The mutex guarantees that
// exactly one transaction allocates a roll for a target section at any moment,
// across concurrent workers, database sessions, Node.js processes, and
// application instances (the primitive is database-resident).
//
// Primitive: PostgreSQL transaction-scoped advisory lock
//   pg_advisory_xact_lock(hashtext(school_id), hashtext(to_year + class + section))
// - Released automatically at transaction COMMIT/ABORT — the earliest point at
//   which the allocated roll is durable and visible to concurrent allocators.
//   A naive "release right after INSERT" would be incorrect: the used-rolls
//   read of a following allocator could run before our COMMIT and compute a
//   stale value. Holding to commit is as small as correctness allows; the
//   per-student transaction is short (≈0.4–2.5 s, runtime-regression-analysis.md §6).
// - Safe under transaction-mode pooling (Supabase pooler): the lock is bound
//   to the transaction, which pins the backend session for its duration.
// - Deadlock-free: each transaction acquires exactly one lock key; no lock
//   ordering exists. Waiters are queued FIFO by PostgreSQL.
// - lock_timeout is set transaction-locally so an unacquirable mutex FAILS
//   (55P03) instead of waiting forever; the error aborts the per-student
//   transaction and the existing retry logic continues (no leaked locks, no
//   orphaned transactions, no partial roll allocation — the insert is atomic
//   with the transaction).
// ============================================

export const SECTION_LOCK_TIMEOUT_MS = 20_000;

interface LockStatsState {
  waits: number[];
  acquisitions: number;
  lockTimeouts: number;
  deadlocks: number;
  otherFailures: number;
  retryAttempts: number;
}

const stats: LockStatsState = {
  waits: [],
  acquisitions: 0,
  lockTimeouts: 0,
  deadlocks: 0,
  otherFailures: 0,
  retryAttempts: 0,
};

export interface RollLockStats {
  acquisitions: number;
  waitMinMs: number;
  waitAvgMs: number;
  waitMaxMs: number;
  waitP95Ms: number;
  lockTimeouts: number;
  deadlocks: number;
  otherFailures: number;
  retryAttempts: number;
}

export function resetRollLockStats(): void {
  stats.waits = [];
  stats.acquisitions = 0;
  stats.lockTimeouts = 0;
  stats.deadlocks = 0;
  stats.otherFailures = 0;
  stats.retryAttempts = 0;
}

export function getRollLockStats(): RollLockStats {
  const waits = [...stats.waits].sort((a, b) => a - b);
  const n = waits.length;
  const sum = waits.reduce((acc, w) => acc + w, 0);
  const p95 = n > 0 ? waits[Math.min(n - 1, Math.ceil(n * 0.95) - 1)] : 0;
  return {
    acquisitions: stats.acquisitions,
    waitMinMs: n > 0 ? waits[0] : 0,
    waitAvgMs: n > 0 ? Math.round(sum / n) : 0,
    waitMaxMs: n > 0 ? waits[n - 1] : 0,
    waitP95Ms: p95,
    lockTimeouts: stats.lockTimeouts,
    deadlocks: stats.deadlocks,
    otherFailures: stats.otherFailures,
    retryAttempts: stats.retryAttempts,
  };
}

/** Records one retry attempt of the collision-recovery path (metric only). */
export function countRollRetryAttempt(): void {
  stats.retryAttempts++;
}

/**
 * Acquires the section mutex (transaction-scoped advisory lock) and runs the
 * critical work. The lock is released at transaction commit/abort.
 *
 * MUST be the ONLY path through which a roll number is allocated.
 *
 * @throws the underlying database error if acquisition fails (55P03 lock
 *         timeout, 40P01 deadlock, connection errors, ...) — the caller's
 *         transaction aborts atomically and existing retry logic continues.
 */
export async function withSectionRollLock<T>(
  tx: PrismaTransactionClient,
  schoolId: string,
  toAcademicYearId: string,
  classId: string,
  sectionId: string | null,
  fn: () => Promise<T>
): Promise<T> {
  if (!sectionId) {
    // Roll numbers are unique per (school, year, class, section) — there is no
    // roll namespace to serialize without a section. Upstream resolution
    // already fails such students before the insert; this is a hard guard so no
    // roll is EVER inserted without holding the mutex.
    throw new Error(
      `withSectionRollLock: cannot allocate a roll without a target section (school=${schoolId}, class=${classId})`
    );
  }

  // Application timestamps (required measurement method): before → acquire → after.
  const acquired = Date.now();
  try {
    // $executeRaw (not $queryRaw): pg_advisory_xact_lock returns a void column,
    // which $queryRaw cannot deserialize; $executeRaw runs the statement and
    // returns only the affected row count.
    await tx.$executeRaw`
      SELECT set_config('lock_timeout', ${String(SECTION_LOCK_TIMEOUT_MS)}, true),
             pg_advisory_xact_lock(hashtext(${schoolId}), hashtext(${toAcademicYearId + classId + sectionId}))
    `;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('55P03') || msg.includes('lock timeout')) {
      stats.lockTimeouts++;
    } else if (msg.includes('40P01') || msg.includes('deadlock')) {
      stats.deadlocks++;
    } else {
      stats.otherFailures++;
    }
    throw err;
  }
  stats.waits.push(Date.now() - acquired);
  stats.acquisitions++;
  return fn();
}
