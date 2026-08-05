# Proposed Promotion Engine Architecture (Pending Approval)

This document contains **proposals only**. No implementation has begun.  
Every section is labeled `Status: PROPOSED — NOT IMPLEMENTED`.

---

## Proposed atomicity model

**Status: PROPOSED — NOT IMPLEMENTED**

Current model (OBSERVED): each student gets a separate `withRls` transaction.

**Proposal**: Keep per-student atomicity but batch writes within a single transaction per worker-buffer:

- Each worker accumulates N students (e.g., 50) into a single `withRls` transaction.
- All close-source updates, target creates, and audit logs are batched as bulk INSERT/UPDATE statements within one BEGIN/COMMIT boundary.
- If any student in the batch collides (roll P2002), the batch splits: successful students commit, colliding students are retried in the next batch.
- N = batch size tuned to keep transaction duration under 30s.

**Rationale**: Reduces round trips from 3 per student (close + create + audit) to 3 per batch. For 1,457 students with batch size 50: 30 batches × 3 round trips = 90 round trips vs. 4,371 round trips currently — a 48× reduction.

---

## Proposed failure handling

**Status: PROPOSED — NOT IMPLEMENTED**

Current model: retry roll collisions in fresh transactions (3 attempts). 47/1,457 students failed retryable.

**Proposal**: Pre-compute roll numbers during snapshot phase, eliminating collisions entirely:

- In the snapshot transaction, compute per-section roll counters (max existing roll + 1).
- Assign each target student a slot: roll = nextFree, increment counter.
- The per-student transaction then uses the pre-assigned roll — no collision possible.
- Retry path (`retryWithFreeRoll`) becomes dead code (kept as safety net for race on student-year uniqueness).

**Rationale**: Zero collision-driven retries. Reduces process phase from ~400s to an estimated ~45s (1,457 students × 0.3s / 6 workers × 1.0 scaling, since no retries and reduced connection pool contention).

---

## Proposed audit strategy

**Status: PROPOSED — NOT IMPLEMENTED**

Current audit cost: ~35% of runtime (~100ms per auditLog.create).

**Proposal**: Batch audit writes in the per-worker transaction:

- Audit logs bundled with the promotion batch (one `auditLog.createMany` per worker-batch).
- `recordId` maps to the new enrollment.id (available after create).
- Accept that audit granularity is per-batch, not per-student (batch-level "promoted 48 students from 2025-2026 to 2026-2027" record).
- Per-student promotion history is preserved in the enrollment chain (source.status=PROMOTED, target.status=ACTIVE) — the audit log complements this, not replaces it.

**Rationale**: Reduces ~2,359 audit writes to ~30 batch-level audit records. Audit cost drops from 35% to < 1% of runtime.

---

## Proposed async job architecture

**Status: PROPOSED — NOT IMPLEMENTED**

Current model: synchronous HTTP request (blocking, ~6-7 minutes for full school).

**Proposal**: Enqueue promotion as a background job:

- `POST /api/promotions` creates a `PromotionJob` record (status=QUEUED) and returns 202 Accepted with `jobId`.
- The request handler spawns the processing in the background (no HTTP timeout).
- `GET /api/promotions/:jobId` polls job status (QUEUED → PROCESSING → COMPLETED/FAILED).
- The per-class progress is tracked via periodic batch-level counter updates to the `PromotionJob` record.
- Alternative: use Supabase Edge Functions or a BullMQ-backed worker for true async processing.

**Rationale**: Eliminates 6-minute HTTP timeouts. Enables live progress polling for the UI (Phase 2.8 requirement). Separates promotion compute from the request-response lifecycle.

---

## Proposed batching strategy

**Status: PROPOSED — NOT IMPLEMENTED**

Current model: 6 worker × sequential per-student transactions (1 connection per worker, pool = 6).

**Proposal**: Tiered batching:

1. **Snapshot**: Unchanged (single read transaction for planning data).
2. **Bulk close source**: Single `UPDATE enrollments SET status='PROMOTED', left_at=NOW() WHERE school_id=$1 AND academic_year_id=$2 AND status='ACTIVE'` — all 1,457 source enrollments closed in 1 round trip (~100ms).
3. **Bulk create targets**: Single `INSERT INTO enrollments (...) VALUES (...), (...), ...` — all 1,457 target rows in 1 round trip (~200ms).
4. **Bulk audit**: Single `INSERT INTO audit_logs (...) VALUES (...), (...), ...` — all in 1 round trip (~150ms).
5. **Pass-out batch**: Separate bulk operations for the 120 graduating students (student.update + PassedOutRecord.create + audit).

**Total round trips**: 4 (snapshot + bulk close + bulk create + bulk audit) + 2 (pass-out). Estimated total: ~1 second.

**Trade-offs**: Looses per-student rollback granularity (roll collisions would abort the entire bulk insert). Mitigation: pre-compute rolling in the snapshot phase (see failure handling proposal).

---

## Instrumentation gaps noted

**Status: OBSERVED — VERIFIED**

The current instrumentation does not time:

- `retryWithFreeRoll` and `withRlsForRetry` (roll-collision recovery path — ~949 students in the test run)
- Pass-out student sub-steps separately (`student.update`, `passedOutRecord.create` are lumped into `createTargetMs`)

This means ~66% of per-student timings were not captured in `latest.json`. Future profiling should add timing to the retry path.
