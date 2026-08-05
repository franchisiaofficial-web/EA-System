# TASK 0.5 — Restore Procedure

**Status**: OBSERVED — VERIFIED

## Step 1: Run the restore script

```bash
npx tsx docs/evidence/tmp-1.1-restore.ts
```

The script runs in a single `$transaction` (atomic — all or nothing).

### What it does (in order):

1. **Delete kept students' source rows** — The 103 "pre-existing" 2026-2027 students have their 2025-2026 enrollment rows removed (they are enrolled for 2026-2027).
2. **Delete full-run target rows** — All 2026-2027 rows created after `FULL_RUN_CUTOFF` (2026-08-03T09:00:00Z) are deleted.
3. **Restore source rows** — All PROMOTED/PASSED_OUT rows in 2025-2026 are set back to ACTIVE, left_at = NULL.
4. **Delete PassedOutRecords** — All `passed_out_records` for the school are deleted.
5. **Restore student statuses** — Students with `status='PASSED_OUT'` are set back to `ACTIVE`.
6. **Restore academic year flags**:
   - `seed_ay_2526` → `status='ACTIVE', is_active=true, is_current=true`
   - `seed_ay_2627` → `status='INACTIVE', is_active=false, is_current=false`
7. **Remove stray year** — Any stray academic year created during testing is deleted (no classes/sections).

## Step 2: Verify

```bash
npx tsx docs/evidence/tmp-0.3-baseline.ts
```

### Expected post-restore values:

| Metric               | Expected |
| -------------------- | -------- |
| 2025-2026 ACTIVE     | 1,457    |
| 2025-2026 PROMOTED   | 0        |
| 2025-2026 PASSED_OUT | 0        |
| 2026-2027 ACTIVE     | 103      |
| PassedOutRecords     | 0        |
| Students PASSED_OUT  | 0        |
| 2025-2026 is_active  | true     |
| 2025-2026 is_current | true     |
| 2026-2027 is_active  | false    |
| 2026-2027 is_current | false    |

## Alternative: Full reseed

If the database has structural issues:

```bash
# Drop and recreate from seed (requires supabase CLI configured)
npx prisma db seed
```

The seed creates:

- 1,560 students (15 grades: Pre-KG through Grade 12)
- 1,560 ACTIVE enrollments in 2025-2026
- 520 PROMOTED historical enrollments in 2024-2025 (~30% of students)
- 0 enrollments in 2026-2027

**Note**: After a fresh seed, the 103 pre-existing 2026-2027 rows are gone. The restore script recreates the exact 103-row baseline used in testing. Use the restore script (not reseed) for test repeatability.

## Prisma datasource

```
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

All restore operations use `DIRECT_URL` (session connection, not pooler).
