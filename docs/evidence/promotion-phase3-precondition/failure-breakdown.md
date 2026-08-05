# Phase 3 Precondition — Task 1: Failure Breakdown of the 241 Failed Students

> Source of truth: persisted evidence only — `promotion_jobs` / `promotion_job_batches` (counters),
> `audit_logs` (per-student success), the retry job's persisted `error` text, and the controlled
> reproduction runs described below. Date: 2026-08-05.

## 1. What was actually persisted

- **Per-student success** — `audit_logs` (entity `enrollment`, action `promote`), verified 1:1 against job counters (FULL: 1093, RETRY: 157, exactly one audit per student, 0 duplicates).
- **Per-batch counters** — `promotion_job_batches` (eligible / processed / promoted / failed per class transition, start/end times).
- **Per-student failure reasons — NOT persisted.** Batches are counter-only; `promotion_jobs.error` holds only the _final batch crash_ string of a FAILED job. The FULL job completed (error `null`), so it carries **no** failure text at all. Only the RETRY job has an error string:
  `Batch "Grade 10 → Grade 11" failed: Connection terminated unexpectedly`.

**Addendum disclosure:** per-student failure reasons for the 241 are unrecoverable from persisted
data. The categorization below is therefore derived from (a) the persisted per-batch/counter
pattern, (b) the one persisted error string, and (c) controlled reproduction on the identical
restored seed — not from per-student records that do not exist.

## 2. The FULL job (cmsecmf8t0000t8u8efiv4tws) — persisted per-batch failures

eligible=1454, promoted=1093, passedOut=120, **failed=241**, duration 1,632,090 ms (27.2 min), started 07:40:44Z, completed 08:07:56Z.

| Batch                 | started (Z) | elapsed | ms/student | failed    |
| --------------------- | ----------- | ------- | ---------- | --------- |
| LKG → UKG             | 07:40:54    | 15s     | 1547       | 2         |
| UKG → Grade 1         | 07:41:10    | 17s     | 1720       | 3         |
| Grade 1 → Grade 2     | 07:41:30    | 115s    | 997        | 20        |
| Grade 2 → Grade 3     | 07:43:26    | 103s    | 857        | 25        |
| Grade 3 → Grade 4     | 07:45:15    | 187s    | 1562       | 19        |
| Grade 4 → Grade 5     | 07:48:23    | 99s     | 826        | 19        |
| Grade 5 → Grade 6     | 07:50:03    | 87s     | 723        | 28        |
| Grade 6 → Grade 7     | 07:51:32    | 228s    | 1898       | 20        |
| Grade 7 → Grade 8     | 07:55:21    | 152s    | 1270       | 21        |
| Grade 8 → Grade 9     | 07:57:59    | 97s     | 808        | 19        |
| Grade 9 → Grade 10    | 07:59:41    | 301s    | 2511       | 24        |
| Grade 10 → Grade 11   | 08:04:43    | 96s     | 811        | 19        |
| Grade 11 → Grade 12   | 08:06:20    | 64s     | 530        | 22        |
| Grade 12 → Passed Out | 08:07:26    | 29s     | 238        | 0         |
| **Sum**               |             |         |            | **241** ✓ |

Observations from the persisted pattern alone:

1. **No time ramp.** Failures are flat (~19–28 per batch) from 07:41 onward; the slowest batch (Grade 9→10, 2.5 s/student) failed no more than the fastest (Grade 11→12, 0.53 s/student, 22 failures). Progressive environment degradation would show a ramp; it does not.
2. **Small classes fail less.** LKG→UKG (2) and UKG→Grade 1 (3) are the smallest cohorts (~20–35 students). Failure count tracks class size — the signature of a concurrency race, not a per-connection failure.
3. The one **persisted error string** (RETRY job) is a batch-level crash: `Connection terminated unexpectedly` — environment, but at the _batch_ layer, not per student.

## 3. The RETRY job (cmsedqybq00002gu8uw8hjwxw) — persisted counters

eligible=241, processed=200, promoted=157, **failed=43**, duration 410,861 ms, started 08:12:15Z, `error` = the batch crash above, `retryClassIds` = all 13 grades (g01…g13).

- 157 of 241 recovered (65%) — retries of the same race-prone engine on a now-partially-filled target succeed at a much higher rate (fewer workers contending per section).
- The batch **Grade 10 → Grade 11 crashed mid-run** (promoted=0, failed=0, processed=0) — 41 students were never touched. 43 failed + 41 unprocessed = **84 unresolved** (Task 2).

## 4. Controlled reproduction — the decisive evidence

On the **identical restored seed** (1,457 ACTIVE / 103 ACTIVE / 0 passed-out), single class `seed_cls_2526_g04` (Grade 3 → Grade 4, 120 students), `PROMOTION_WORKERS=6` — same engine, same pooler, healthy environment (387 ms/student):

| Path                                | promoted | failed | fail % | wall   |
| ----------------------------------- | -------- | ------ | ------ | ------ |
| Direct `runPromotionBatch`          | 97       | **23** | 19.2%  | 46.4 s |
| PromotionJob scheduler              | 99       | **21** | 17.5%  | 49.1 s |
| FULL job's Grade 3→4 batch (07:45Z) | —        | **19** | 15.8%  | 187 s  |

- **100% of the direct-run failures were one reason:** `Roll collision retry exhausted (4 attempts): Unique constraint failed on the fields: (school_id, academic_year_id, class_id, section_id, roll_number)` — with **zero** connectivity/timeout errors.
- The FULL run's Grade 3→4 batch failed 19/120 ≈ the 19–23 reproduced today. Same mechanism.

### Root cause (engine defect, `promotion-service.ts:731-739`)

`withRlsForRetry` computes the target roll by **read-then-write race**: every worker loads the used roll set, scans `free = "1"; while (used.has(free)) free++`, then inserts. With 6 workers in the same section:

1. Two+ workers read the same `used` set (neither committed yet).
2. Both compute the same `free` roll.
3. One insert wins; the rest hit the partial unique index `enrollments_target_roll_active_key` (23505/P2002).
4. Each retry re-reads → same race → after 4 attempts the student **FAILS with action RETRY**.

Workers=1 (Gap A trial, prior evidence): **0 roll collisions** in 1,200 students — sequential allocation is race-free. This isolates the defect to _concurrency in roll allocation_, not the pooler.

## 5. Category estimate for the 241

| Category                                                            | Basis                                                                                                                                                                                                       | Est. share              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **C1 — Roll-collision race exhaustion** (engine concurrency defect) | Reproduced 19.2% on healthy env at the same worker count and seed; flat failure pattern; size-correlated; absent at workers=1                                                                               | **~88–94%** (≈ 211–226) |
| **C2 — Environment** (connection drops / statement timeouts)        | Persisted retry batch crash (`Connection terminated unexpectedly`); `statement_timeout = 2 min`; Gap A workers=1 baseline ~1% connectivity failures; degraded per-student latencies (0.5–2.5 s) during FULL | **~6–12%** (≈ 15–30)    |

Exact per-student attribution is impossible (reasons not persisted — see §1). The dominant cause is
**C1**: the engine's concurrent roll-number allocation, independent of the pooler, the scheduler, and
the environment. The environment added a minority of timeouts/connection failures (C2) — proven by
the retry job's batch crash and the 84 students it left behind.

## 6. Implications for PRESERVE_SECTION

- The collision unique key includes `section_id` — PRESERVE_SECTION spreads students across preserved sections instead of funneling every student into `firstSectionId`, which **reduces** per-section contention (fewer workers per section) but does **not** eliminate the race.
- Any PRESERVE_SECTION run at workers=6 on the current engine will still produce C1 failures, contaminating section-preservation verification. **Roll allocation must be made concurrency-safe first** (see phase3-readiness.md).
