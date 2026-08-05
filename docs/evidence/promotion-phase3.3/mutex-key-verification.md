# Phase 3.3 — Mutex-Key Verification (STOP-condition check)

**Verdict: PASS — advisory locks are acquired on the strategy-RESOLVED section,
never on `firstSectionId`. STOP condition did NOT fire.**

## What was verified

The Phase 3.3 STOP condition: if a lock were ever acquired with a stale key
(`firstSectionId`) instead of the resolved section, the phase must stop and
produce `BLOCKED-3.3.md`. The harness observes `pg_locks` (500 ms sampling,
granted advisory locks only) and compares **observed lock keys** with the
**hashtext-encoded keys of the sections actually written**, requiring both to be
equal AND more than one concurrent grant (i.e. real per-section parallelism).

Lock key derivation is unchanged from prior phases:

```sql
SELECT hashtext('seed_ay_2627' || 'seed_cls_2627_...' || 'seed_sec_2627_...');
```

## Per-scenario results (raw harness output)

| Scenario                         | observed distinct keys | max concurrently granted | written sections    | check               |
| -------------------------------- | ---------------------- | ------------------------ | ------------------- | ------------------- |
| primary (g07→g08)                | **3**                  | **3**                    | g08_a, g08_b, g08_c | `true`              |
| fallback (g05→g06, C inactive)   | **2**                  | **2**                    | g06_a, g06_b        | `true`              |
| overflow (g03→g04, B capacity 0) | **2**                  | **2**                    | g04_a, g04_c        | `true`              |
| regression (g11→g12)             | **3**                  | **3**                    | g12_a, g12_b, g12_c | `true`              |
| passout (g14, no target writes)  | 0                      | 0                        | (none)              | SKIPPED (by design) |

## 1. Primary — all three expected keys observed

```
observed distinct advisory key2s (unsigned oid): 3 | max concurrently granted: 3
  key2=unsigned 1599965570 (signed 1599965570)   <- g08_a (A)
  key2=unsigned 1607910575 (signed 1607910575)   <- g08_c (C)
  key2=unsigned 2380390157 (signed -1914577139)  <- g08_b (B)
seed_sec_2627_g08_a (A) -> signed 1599965570 | unsigned 1599965570 | observed=true
seed_sec_2627_g08_b (B) -> signed -1914577139 | unsigned 2380390157 | observed=true
seed_sec_2627_g08_c (C) -> signed 1607910575 | unsigned 1607910575 | observed=true
sections WRITTEN: seed_sec_2627_g08_a, seed_sec_2627_g08_b, seed_sec_2627_g08_c
MUTEX-KEY CHECK (lock key == resolved section, NOT firstSectionId): true
```

Under Phase-3.2 behavior this class would show **one** key (section A only).

## 2. Fallback — only the two LIVE target sections

C deactivated ⇒ C must not be locked or written:

```
observed distinct advisory key2s: 2 | max concurrently granted: 2
sections WRITTEN: seed_sec_2627_g06_a, seed_sec_2627_g06_b
MUTEX-KEY CHECK: true
```

## 3. Overflow — the capacitated section never locked

B capacity 0 ⇒ B must not appear as a lock key or a written section:

```
observed distinct advisory key2s: 2 | max concurrently granted: 2
  seed_sec_2627_g04_b (B) -> observed=false
sections WRITTEN: seed_sec_2627_g04_a, seed_sec_2627_g04_c
MUTEX-KEY CHECK: true
```

## 4. Regression — three keys under the roll-collision class

```
observed distinct advisory key2s: 3 | max concurrently granted: 3
sections WRITTEN: seed_sec_2627_g12_a, seed_sec_2627_g12_b, seed_sec_2627_g12_c
MUTEX-KEY CHECK: true
```

## 5. Passout — SKIPPED, correctly

Passed-out students perform no target-section insert, hence acquire no locks
(0 advisory keys observed, 0 written). This is the designed behavior, not a
violation — the harness bypasses the key check when no target-section write
occurred (`wroteTargetSection = writtenKeys.size > 0 && promoted > 0`);
the raw observation is reported and the scenario still PASSes.

## 6. Single resolution point (code audit)

`processOne` resolves the section exactly once:
`const targetSectionId = toSectionId ?? args.strategy.resolveTargetSection(src, targetInfo) ?? null;`
(promotion-service.ts:624), and that single value is used for BOTH the mutex key
and the inserted `section_id` (lines 653, 661, 680). The retry path re-resolves
through the same strategy (line 740) so a retried write locks the same key.
No other code path acquires a per-section advisory lock with `firstSectionId`.
Profiling-only `firstSectionId` references (line 465) never touch locking.

## 7. Lock health across scenarios

All scenarios: `lockTimeouts=0, mutexFailures=0, deadlocks=0`; worst wait during
section-collision scenarios (fallback) waitMax 3,163 ms — within normal range and
never a timeout.

**Mutex-key verification: PASS. The resolved section is locked; concurrent
per-section execution is real (max 3 concurrent grants); firstSectionId is never
used as a lock key.**
