// ============================================
// Promotion Profiling Instrumentation
// DISABLED BY DEFAULT: PROMOTION_PROFILE=true
// REMOVABLE: delete this file + references in promotion-service.ts
// ============================================

import * as fs from 'fs';
import * as path from 'path';

export function profilingEnabled(): boolean {
  return process.env.PROMOTION_PROFILE === 'true';
}

interface PhaseTiming {
  start: number;
  end: number;
  durationMs: number;
  rows?: number;
  queries?: number;
  metadata?: Record<string, unknown>;
}

interface PerStudentTiming {
  studentId: string;
  totalMs: number;
  closeSourceMs: number;
  createTargetMs: number;
  auditLogMs: number;
  rollRetries: number;
  outcome: string;
  rollNumber: string | null;
  sectionId: string | null;
}

interface RetrySubPhase {
  name: string;
  durationMs: number;
  rowsAffected?: number;
}

interface RetryAttempt {
  studentId: string;
  attemptNumber: number;
  workerId: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  outcome: 'success' | 'exhausted';
  rollAssigned: string | null;
  subPhases: RetrySubPhase[];
}

interface CollisionEvent {
  studentId: string;
  sourceSectionId: string | null;
  targetSectionId: string | null;
  sourceRollNumber: string | null;
  requestedTargetRoll: string | null;
  retryAttempt: number;
  phase: 'first_create' | 'retry_create';
  timestamp: number;
  errorCode: string;
}

interface SectionMapping {
  sourceGrade: string;
  sourceClass: string;
  targetGrade: string;
  targetClass: string;
  targetSection: string;
  studentCount: number;
}

class ProfileCollector {
  private readonly phases = new Map<
    string,
    {
      start: number;
      end: number;
      rows?: number;
      queries?: number;
      meta?: Record<string, unknown>;
    }
  >();
  private readonly perStudent: PerStudentTiming[] = [];
  private readonly retryAttempts: RetryAttempt[] = [];
  private readonly collisions: CollisionEvent[] = [];
  private totalMs = 0;
  private startedAt = '';

  startPhase(name: string) {
    if (!profilingEnabled()) return;
    this.phases.set(name, { start: performance.now(), end: 0 });
  }
  endPhase(
    name: string,
    opts?: { rows?: number; queries?: number; meta?: Record<string, unknown> }
  ) {
    if (!profilingEnabled()) return;
    const p = this.phases.get(name);
    if (p) {
      p.end = performance.now();
      if (opts?.rows !== undefined) p.rows = opts.rows;
      if (opts?.queries !== undefined) p.queries = opts.queries;
      if (opts?.meta) p.meta = opts.meta;
    }
  }
  addStudentTiming(t: PerStudentTiming) {
    if (!profilingEnabled()) return;
    this.perStudent.push(t);
  }
  addRetryAttempt(r: RetryAttempt) {
    if (!profilingEnabled()) return;
    this.retryAttempts.push(r);
  }
  addCollision(c: CollisionEvent) {
    if (!profilingEnabled()) return;
    this.collisions.push(c);
  }
  patchLastRetryAttempt(attemptNumber: number, workerId: number) {
    if (!profilingEnabled() || this.retryAttempts.length === 0) return;
    const last = this.retryAttempts[this.retryAttempts.length - 1];
    last.attemptNumber = attemptNumber;
    last.workerId = workerId;
  }
  setTotal(ms: number, startedAt: string) {
    if (!profilingEnabled()) return;
    this.totalMs = ms;
    this.startedAt = startedAt;
  }

  flush(counts: {
    total: number;
    promoted: number;
    passedOut: number;
    skipped: number;
    failed: number;
    retryable: number;
  }) {
    if (!profilingEnabled()) return;
    const data: Record<string, unknown> & { phases: Record<string, unknown> } =
      {
        runId: `promo-${Date.now()}`,
        startedAt: this.startedAt,
        totalMs: this.totalMs,
        phases: {},
        perStudent: this.perStudent,
        retryAttempts: this.retryAttempts,
        collisionCount: this.collisions.length,
        studentCounts: counts,
        metadata: {
          envFlag: 'PROMOTION_PROFILE=true',
          note: 'Instrumented execution.',
        },
      };
    for (const [name, p] of this.phases)
      data.phases[name] = {
        start: p.start,
        end: p.end,
        durationMs: p.end - p.start,
        rows: p.rows,
        queries: p.queries,
        metadata: p.meta,
      };
    const dir = path.resolve(
      process.cwd(),
      'docs',
      'evidence',
      'promotion-profile'
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'latest.json'),
      JSON.stringify(data, null, 2)
    );
    console.log(
      `[PROFILE] Flushed latest.json (${this.perStudent.length} first-pass, ${this.retryAttempts.length} retries, ${this.collisions.length} collisions, ${this.totalMs.toFixed(0)}ms)`
    );
  }

  flushRetryPath() {
    if (!profilingEnabled() || this.retryAttempts.length === 0) return;
    const data = {
      runId: `retry-${Date.now()}`,
      totalRetryStudents: new Set(this.retryAttempts.map((r) => r.studentId))
        .size,
      totalRetryAttempts: this.retryAttempts.length,
      attempts: this.retryAttempts,
    };
    const dir = path.resolve(
      process.cwd(),
      'docs',
      'evidence',
      'promotion-optimization'
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'retry-path.json'),
      JSON.stringify(data, null, 2)
    );
    console.log(
      `[PROFILE] Flushed retry-path.json (${data.totalRetryStudents} students, ${data.totalRetryAttempts} attempts)`
    );
  }

  flushCollisions(sectionMappings?: SectionMapping[]) {
    if (!profilingEnabled()) return;
    const data = {
      runId: `collision-${Date.now()}`,
      totalCollisions: this.collisions.length,
      collisions: this.collisions,
      sectionMappings: sectionMappings || [],
    };
    const dir = path.resolve(
      process.cwd(),
      'docs',
      'evidence',
      'promotion-optimization'
    );
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'retry-root-cause.json'),
      JSON.stringify(data, null, 2)
    );
    console.log(
      `[PROFILE] Flushed retry-root-cause.json (${this.collisions.length} collisions)`
    );
  }
}

export const profile = new ProfileCollector();
