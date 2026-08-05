# Aborted Run Documentation (retroactive — prior full-school attempts)

Short record so future reviewers don't have to guess why full-school runs were aborted
before Phase 3.2B finally ran to completion.

## 1. Full-school workers=1 attempts (×3) — pre-3.2B session

```
Run: full-school promotion, workers=1 (attempted three times, earlier in the 3.2A session)
Status: Aborted
Progress at abort: none captured (aborted at the terminal before/in the first minutes of each attempt;
         no RUN_ID assigned; the harness teardown existed only as the class-scoped run harness)
Reason: Operator time constraint at the terminal; expected runtime ~10 min per attempt exceeded
         the working-session budget. Focus shifted to class-scoped verification
         (the same g04→g05 class used to reproduce the pre-fix 23/120), which produces
         equivalent mutex-correctness evidence in 1–3 min.
Correctness anomaly observed before abort: no (0 failures observed; every scoped run that
         completed was clean)
```

## 2. Full-school workers=6 attempt — `RUN_ID full-school-w6`

```
Run: full-school-w6 (operator-aborted, 2026-08-05 ~05:58Z)
Status: Aborted (STOP by operator at the terminal)
Progress at abort: 862/1,454 processed (774 promoted, 88 passed out) — per next-run restore:
         BEFORE = ay2627_total=877 (103 pre-existing + 774), ay2526_active=595,
         promoted=774, passed_out_records=88
Reason: operator time constraint; shifted focus to completing the class-scoped worker-count
         matrix (1/3/6/12) that Phase 3.2B would later consolidate. Run was not restarted
         in that session because the full-school run was deferred to the dedicated 3.2B task.
Correctness anomaly observed before abort: no (0 failures had surfaced in the 862 students
         processed; the certified baseline restore fully cleaned the partial state and
         re-verified 1457/103/0/0 before the next run)
```

Full-school evidence was ultimately produced by the dedicated Phase 3.2B run (see
`full-school-validation.md` / `BLOCKED-3.2B.md`).
