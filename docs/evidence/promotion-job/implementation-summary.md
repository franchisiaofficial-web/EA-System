# Promotion Engine — Phase 2 Implementation Summary

> Implementation summary for the frozen "EA System / Phase 2 — Promotion Engine Architecture" mandate.
> Date: 2026-08-04. Scope: `POST /api/promotions` → background job + progress + idempotent retry.

## 1. Architecture (as implemented)

```
PromotionJob (parent, status: PENDING → RUNNING → COMPLETED/FAILED)
   └── PromotionJobBatch (one per class transition; progress / retry / reporting boundary ONLY,
                          NEVER a transaction boundary)
         └── Per-student promotion (unchanged: atomic per student, per-student audit,
                                   tenant-isolated via RLS)
```

- **One global worker pool**, never per batch: `PARALLEL_WORKERS = Number(process.env.PROMOTION_WORKERS) || 6` (src/services/promotion/promotion-service.ts).
- **In-process scheduler** serializes jobs (one at a time per process) — `enqueuePromotionJob` / `drainQueue` (src/services/promotion/promotion-job-service.ts).
- **Idempotent retry**: eligibility is always re-derived from the DB (`sourceEnrollment.status == 'ACTIVE'`); already-promoted students are skipped. Retry targets only `FAILED` batches (`retryClassIds`).
- Promotion rules, section assignment, audit, tenant isolation, and per-student atomicity were **not** redesigned; `runPromotionBatch` is reused unchanged except an optional `onProgress` callback.

## 2. Schema (applied migration `prisma/migrations/20260804070000_add_promotion_job_models/migration.sql`)

| Table                   | Purpose                 | Key fields                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promotion_jobs`        | Job lifecycle + rollups | `school_id`, `from_academic_year_id`, `to_academic_year_id`, `class_id` (optional single-class run), `retry_class_ids` (text[]), `status` (PENDING/RUNNING/COMPLETED/FAILED), `eligible_students`, `processed_students`, `promoted_students`, `passed_out_students`, `failed_students`, `started_at`, `completed_at`, `duration_ms`, `error`, `created_by` |
| `promotion_job_batches` | Per-transition progress | `promotion_job_id` (cascade), `source_class_id`, `source_class_name`, `target_class_id`, `target_class_name`, `transition` (e.g. `Grade 3 → Grade 4`), `eligible`, `processed`, `promoted`, `passed_out`, `failed`, `status`, `started_at`, `completed_at`                                                                                                 |

Enums `PromotionJobStatus` / `PromotionJobBatchStatus`. Indexes: `(school_id, status)`, `(school_id, created_at)`, `(school_id, from_academic_year_id)` on jobs; `(promotion_job_id)`, `(promotion_job_id, status)` on batches.

Migration workflow note: `prisma migrate dev` cannot replay the manual `20260803090000_add_target_roll_active_key` migration against the shadow DB (P3006/P3018) and this database has no `_prisma_migrations` table, so the new DDL was generated with `prisma migrate diff --from-config-datasource --to-schema` and applied with `npx prisma db execute --file`.

**RLS**: `prisma/rls-promotion-jobs.sql` + `scripts/security/apply-rls-promotion-jobs.ts` (applied) — `promotion_jobs` policies via `has_active_membership(school_id)`; `promotion_job_batches` policies via subquery through `promotion_jobs` (school scoping).

## 3. API

| Endpoint                                 | Behavior                                                                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/promotions`                   | Validates (zod), creates job, **returns HTTP 202** `{ success, data: { jobId, status, duplicate } }` immediately. Background worker executes. Deduplicates while a PENDING/RUNNING job exists for the school/year pair (`duplicate: true`). |
| `GET /api/promotions/jobs/:jobId`        | Job progress: status, eligible, processed, promoted, passedOut, failed, `percentage`, `etaMs`, `currentBatch`, per-batch breakdown, error. 404 when unknown.                                                                                |
| `GET /api/promotions/jobs?pageSize=n`    | Most recent jobs (used by the Academic Years page to detect an in-flight promotion).                                                                                                                                                        |
| `POST /api/promotions/jobs/:jobId/retry` | Re-runs only the FAILED batches of a job (new job with `retryClassIds`). HTTP 202 with the new `jobId`; HTTP 409 when there is nothing to retry.                                                                                            |

All routes: `requirePermission(..., 'students', 'update')` (POST/retry) / `'read'` (GETs), school-scoped via `withRls`.

## 4. Frontend

- **Promotion page** (`PromotionClient.tsx`): "Run Promotion" → POST (202) → polls `GET /api/promotions/jobs/:jobId` every 2s → live progress bar (%), current batch + counts, ETA, per-batch status table, "Retry Failed Batches (n)" when any failures, auto-toast + count refresh on completion. No more long blocking request.
- **Academic Years page** (`AcademicYearList.tsx`): detects an in-flight job on mount, shows a "Promotion Running" banner with live progress/current batch/ETA, and refreshes year counts **only after** the job reaches a terminal state.

## 5. Files changed / added

Modified:

- `prisma/schema.prisma` (enums + 2 models + back-relations; Enrollment partial-unique index already declared)
- `src/services/promotion/promotion-service.ts` (`PARALLEL_WORKERS` env-configurable; `onProgress` on `PromotionBatchInput`)
- `src/app/api/promotions/route.ts` (202 + job creation)
- `src/app/dashboard/academics/promotion/PromotionClient.tsx`
- `src/app/dashboard/academics/academic-years/AcademicYearList.tsx`

Added:

- `prisma/migrations/20260804070000_add_promotion_job_models/migration.sql` (applied)
- `prisma/rls-promotion-jobs.sql`, `scripts/security/apply-rls-promotion-jobs.ts` (applied)
- `src/services/promotion/promotion-job-service.ts` (scheduler, create/get, batch plan, execution)
- `src/app/api/promotions/jobs/route.ts`, `src/app/api/promotions/jobs/[jobId]/route.ts`, `src/app/api/promotions/jobs/[jobId]/retry/route.ts`

Untouched (per mandate): promotion rules/section assignment/audit/atomicity logic, `close-year` route, unrelated files.

## 6. Verification (live run against seed data, Supabase pooler)

Scripts: `docs/evidence/tmp-1.10-job-e2e.ts`, `tmp-1.10-full.ts`, `tmp-1.10-retry.ts` (service-level; same code path as the API routes).

1. **Single class e2e**: POST-equivalent → job PENDING → RUNNING → COMPLETED (10.1s, 3/3 promoted); counts consistent (`processed == promoted+passedOut+failed`); percentage reached 100; batch row COMPLETED.
2. **Idempotent re-run**: same class after COMPLETED → second job found 0 eligible, promoted 0 — no double promotions.
3. **Full-school run** (1,454 eligible, 14 batches): COMPLETED in ~27 min → 1,093 promoted + 120 passed out + 241 failed; per-batch FAILED marking worked; progress/percentage/current-batch/ETA reported live; `processed == eligible`, batch sums equal job totals (0 lost/double).
4. **Retry of FAILED batches only**: retry job eligible = **241 (exactly the failed set)** — the 1,093 already-promoted students were excluded by the idempotent ACTIVE-source check; 157 promoted before a hard pooler outage (`Connection terminated unexpectedly`) correctly marked the retry job FAILED with the error persisted.
5. All failures during runs were environment connectivity/`57014 statement timeout` (known pooler behavior); failed students remain ACTIVE in the source year and are picked up by the next job/retry (self-healing, per-student atomicity preserved).

Baseline restored after verification: 1,457 ACTIVE `seed_ay_2526` / 103 ACTIVE `seed_ay_2627` / 0 passed out (`docs/evidence/tmp-1.1-restore.ts`).

Checks: `npx prisma validate` ✓, `npx tsc --noEmit` clean for `src/` ✓, `eslint` on touched files — no new issues ✓.
