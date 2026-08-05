# PromotionJob / PromotionJobBatch / Retry Regression (workers=6)

- **RUN**: `JOB REGRESSION` — started `2026-08-05T06:15:51.123Z`
- **Path**: full production job orchestration — `createPromotionJob` (global scheduler)
  → `buildBatchPlan` → `PromotionJobBatch` → `runPromotionBatch` (the same wrapped
  allocators) → status COMPLETED → idempotent re-run → retry route branch.
- **Scope**: class-scoped job on `seed_cls_2526_g04` (120 eligible); workers=6.
- Baseline 1457 / 103 / 0 / 0.

## 1. Job lifecycle

```
created: PENDING (duplicate=false)
poll → RUNNING → COMPLETED in 74846 ms (75 s)
status: COMPLETED | eligible: 120 | processed: 120 | promoted: 120 | passedOut: 0 | failed: 0 | error: null | durationMs: 74641
processed==promoted+passedOut+failed: true | eligible==processed: true
batches: [{ transition: "Grade 2 → Grade 3", status: COMPLETED, eligible: 120, processed: 120, promoted: 120, failed: 0 }]
```

Lock stats (through the JOB path — proves the mutex is active inside the scheduler too):

```
acquisitions=217 waitMinMs=101 waitAvgMs=1130 waitMaxMs=2115 waitP95Ms=1640
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=97
```

Raw rows:

```
promotion_job:       {"status":"COMPLETED","eligible":120,"processed":120,"promoted":120,"failed":0,"durationMs":74641}
promotion_job_batch: {"transition":"Grade 2 → Grade 3","status":"COMPLETED","eligible":120,"processed":120,"promoted":120,"failed":0}
```

## 2. Idempotent re-run (same class, after COMPLETED)

```
rerun created (duplicate=false) → COMPLETED in 2254 ms (0 eligible)
rerun final: COMPLETED eligible=0 processed=0 promoted=0 failed=0
```

Eligibility is re-derived from the DB (source ACTIVE); 0 double-promotions.

## 3. Retry route branch (retry ONLY FAILED batches)

```
FAILED batches in job: 0
retry branch taken: 409 NOTHING_TO_RETRY (no failed batches)
```

The `POST /api/promotions/jobs/[jobId]/retry` guard (0 FAILED batches → HTTP 409
`NOTHING_TO_RETRY`) is exercised directly: with zero failed batches the branch is the
409 path. (A FAILED-batch retry cannot be forced here — that is the point of the fix:
0 allocator failures.)

## 4. Correctness & isolation checks

- DUPLICATE-ROLL PASS=true; NULL ROLL COUNT=0
- `audit_logs` (entity=enrollment, action=promote) created during job: **120** (exactly
  1:1 with promoted)
- attendance=46,927 and guardians=3,132 — unchanged vs PRE (promotion touches no
  attendance/guardian rows)
- tenant isolation: fixture school total enrollments untouched=1

## 5. Pre-existing observation (not a Phase 3.2 regression)

The job's live progress polling (`getPromotionJob` during RUNNING) showed `processed=0/120`
throughout the run while the batch counters were actually advancing; the final snapshot
persists exact counts on completion. This is the pre-existing 800 ms-debounced,
fire-and-forget progress persistence in `promotion-job-service.ts` (unchanged by Phase
3.2 — no job-service edits). Final-state correctness is exact and verified above.

**Result: JOB REGRESSION PASSED.**
