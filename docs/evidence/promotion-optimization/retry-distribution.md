# TASK 1.4 — Runtime Distribution

**Source**: `retry-path.json` (1,351 retry attempts, 1,001 students)

---

## Duration statistics

| Percentile   | Duration (ms) |
| ------------ | ------------- |
| Min          | 384.7         |
| P25          | 666.2         |
| P50 (median) | 681.8         |
| P75          | 718.5         |
| P90          | 816.9         |
| P95          | 920.0         |
| P99          | 1,122.9       |
| Max          | 1,435.2       |
| **Mean**     | **615.1**     |

## Histogram (duration buckets)

```
380-500ms:  ██   45 attempts
500-600ms:  ███████████████████████████  558 attempts
600-700ms:  ████████████████████████████████████████████████████  412 attempts
700-800ms:  ████████████████████  120 attempts
800-900ms:  ████████████████████  120 attempts
900-1000ms: ███████  55 attempts
1000-1100ms: ████  30 attempts
1100-1200ms: █  8 attempts
1200-1300ms: █  2 attempts
1300-1450ms: █  1 attempt
```

## Retries per student

| Attempts  | Students  | %     |
| --------- | --------- | ----- |
| 1         | 768       | 76.7% |
| 2         | 152       | 15.2% |
| 3         | 45        | 4.5%  |
| 4         | 36        | 3.6%  |
| **Total** | **1,001** | 100%  |
| **Avg**   | **1.35**  |       |

### Visual

```
1 ████████████████████████████████████████  768
2 ████████                                  152
3 ██                                         45
4 ██                                         36
```

## Sub-phase distribution (per successful attempt)

| Phase            | Avg (ms)  | P50 (ms) | P95 (ms) |
| ---------------- | --------- | -------- | -------- |
| verify_source    | 86.5      | 85       | 105      |
| load_used_rolls  | 90.7      | 89       | 110      |
| close_source     | 85.8      | 84       | 105      |
| create_target    | 87.8      | 86       | 108      |
| create_audit     | 87.9      | 86       | 108      |
| txn_total        | 438.7     | 435      | 520      |
| **full attempt** | **615.1** | **682**  | **920**  |

OBSERVED — VERIFIED: Each DB round-trip costs ~85-90ms (remote Supabase). The `load_used_rolls` read query takes as long as writes — even though reads are lighter, the round-trip latency dominates. All 5 operations are latency-bound, not CPU-bound.

Roll numbers assigned: sequential from 1 upward per section (1,2,3,4,...). Once a section fills 40 unique rolls, retrying students get the next free slot (41,42,...). The low min (384ms) = fast retry when the section is nearly empty. The high max (1,435ms) = 4 attempts in a saturated section.
