# Runtime Comparison

## The runs (same class g04→g05, 120 eligible, single target section)

| Workers          | Wall (s) | Students/s | Lock acquisitions | Lock wait avg (ms) | max (ms) | p95 (ms) | Retries | Failed |
| ---------------- | -------- | ---------- | ----------------- | ------------------ | -------- | -------- | ------- | ------ |
| 1                | 164.6    | 0.73       | 210               | 104                | 409      | 108      | 90      | 0      |
| 3                | 77.0     | 1.56       | 210               | 387                | 1023     | 719      | 90      | 0      |
| 6                | 67.2     | 1.79       | 210               | 1149               | 1866     | 1842     | 90      | 0      |
| 12               | 66.9     | 1.79       | 208               | 1160               | 2156     | 1740     | 88      | 0      |
| PASSED_OUT (g14) | 17.6     | 6.81       | **0**             | —                  | —        | —        | 0       | 0      |
| Job @ 6          | 74.6     | 1.61       | 217               | 1130               | 2115     | 1640     | 97      | 0      |

## Reading

1. **The mutex eliminates the defect, not the work.** 90 of 120 students carry a
   structural carry-over roll collision every run; each needs a second (retry)
   transaction. Before Phase 3.2, ~19–23% of those raced (P2002) and failed at workers=6.
   Now every one of them is serialized, so all recover — at every worker count.

2. **Scaling is capped by the single-section funnel.** In this fixture all 120 students
   promote into _one_ target section (`seed_sec_2627_g05_a`), i.e. one mutex key. That is
   the hard serialization point:
   - workers 1 → 3: **2.1×** speedup (77 s): app-level parallelism opens up while lock
     contention is still cheap (avg 0.39 s).
   - workers 3 → 6: **1.15×** (67 s).
   - workers 6 → 12: **flat** (~67 s): >6 workers on a one-section funnel only lengthen
     the wait queue (avg wait plateaus ~1.15 s; p95 rises slightly, max 2.2 s).
   - A full school has up to 3 sections per grade transition, i.e. up to 3 mutex keys per
     target class — contention amortizes over a real workload (see §5).

3. **Lock overhead is small and measured.** Uncontended acquisition is ~100 ms (the
   local round trip). Even at 6–12 contested workers, worst observed wait is **2.2 s ≪
   20 s `lock_timeout`** — no timeouts (0 in every run). The g14 pass-out control
   (6.81 students/s, 0 lock acquisitions) shows the no-lock baseline throughput — the
   lock's cost appears only where roll allocation actually needs serialization.

4. **Job path adds ~7-8%** (74.6 vs 67.2 s at workers=6): batch planning + progress
   persistence per batch, not lock cost.

## Pre-fix contrast (same class, workers=6, `failure-breakdown.md` §4)

|                                | Pre-fix                    | Post-fix                   |
| ------------------------------ | -------------------------- | -------------------------- |
| direct-path failures           | 23/120                     | 0/120                      |
| roll collisions reaching P2002 | ~19%                       | 0 (serialized under mutex) |
| duplication observed           | none (index backstop held) | none                       |
| wall                           | ~68 s                      | ~67 s                      |

Correctness cost of the mutex at this scale is effectively zero; the throughput floor is
the unavoidable per-section serialization, which pool tuning (Phase 5) cannot remove for a
single-section roll space — it only flattens the wait queue.

## Note on the operator-aborted full-school run

Two full-school run attempts were aborted at the terminal by the operator before the
dedicated 3.2B task: workers=1 (×3 attempts) and `full-school-w6` (one attempt, which had
processed 862 of 1,454 students cleanly before abort). The certified baseline restore
fully cleaned the partial state each time (re-verified 1457/103/0/0). Documented with
stated reasons in `aborted-runs.md`. Full-school coverage is otherwise supplied per-class
(three scoped promotion runs, the g14 PASSED_OUT control, the production PromotionJob run)
and by the dedicated full-school 3.2B run (`full-school-validation.md`,
`BLOCKED-3.2B.md`).

## Full-school runs (1,457 eligible, 15 batches, workers=6)

| Metric                   | Original pre-fix         | 3.2B attempt 1 (harness-heavy) | 3.2B attempt 2 (connection-light, PASS) |
| ------------------------ | ------------------------ | ------------------------------ | --------------------------------------- |
| wall                     | 1,632,090 ms (~27.2 min) | 956,734 ms (~15.9 min)         | **521,180 ms (~8.7 min)**               |
| promoted / passed out    | 1,093 / 120              | 1,336 / 120                    | **1,337 / 120**                         |
| failed                   | **241 (16.6%)**          | 1 (0.07%)                      | **0**                                   |
| lock wait avg / max (ms) | n/a (no mutex)           | 1,366 / 20,480                 | **748 / 1,940**                         |
| lock timeouts            | n/a                      | 1                              | **0**                                   |
| retry attempts recovered | 157/241                  | 1,062/1,063                    | **1,059/1,059 (100%)**                  |

Reading: per-120-batch pace improved from the STOP run's 101–130 s (pool-saturation
window) to a flat **42.6–45.4 s** with the harness quiet — the shipping config at
workers=6 sustains full-school volume without pressing the session-mode pooler's
15-client cap. The 1 failure / 1 timeout in attempt 1 was harness-induced
(`BLOCKED-3.2B.md` §"Resolution").
