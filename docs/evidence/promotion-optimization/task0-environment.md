# TASK 0 — Environment & Preconditions

**Date**: 2026-08-03
**Investigators**: EA System Engineering

---

## TASK 0.1 — Restore Capability

**Status**: OBSERVED — VERIFIED

Restore mechanism: **Automated restore script** (`docs/evidence/tmp-1.1-restore.ts`).

The script connects via `DIRECT_URL` pooler to Supabase PostgreSQL, runs in a single `$transaction` (atomic), and restores the database to a clean pre-test state.

Reseed command: `npx prisma db seed` (creates 1,560 students across 15 grades, each with one ACTIVE enrollment in 2025-2026).

Priority: 4 — Seed + Reset workflow

---

## TASK 0.2 — Environment

### Application

| Property          | Value                 |
| ----------------- | --------------------- |
| Branch            | `master`              |
| Commit SHA        | `33904af`             |
| Node version      | v24.18.0              |
| Package manager   | npm 11.16.0           |
| Prisma version    | 7.9.0                 |
| Next.js version   | 16.2.11               |
| Database provider | PostgreSQL (Supabase) |
| Environment       | `development`         |

### Database

| Property             | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| Database name        | `postgres`                                               |
| Host                 | aws-1-ap-south-1.pooler.supabase.com                     |
| Connection type      | Pooler (PgBouncer on 6543), DIRECT_URL (session on 5432) |
| Connection pool size | 6 (rlsPrisma, PRISMA_POOL_MAX env)                       |
| Prisma datasource    | `db` (pg adapter)                                        |
| Migration mechanism  | `prisma db execute --file` (raw SQL, manually baselined) |

### Promotion Configuration (from `src/services/promotion/promotion-service.ts`)

| Parameter                  | Value                                                                                             | Line                     |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| PARALLEL_WORKERS           | 6                                                                                                 | :113                     |
| retryWithFreeRoll attempts | 3                                                                                                 | :430                     |
| Roll-number policy         | AUTO-ASSIGN (Policy A, Phase 1.3)                                                                 | :327                     |
| withRls timeout            | 60,000ms                                                                                          | rls-middleware.ts:47     |
| withRls maxWait            | 30,000ms                                                                                          | rls-middleware.ts:47     |
| Roll-collision index       | `enrollments_target_roll_active_key` (partial, WHERE roll_number IS NOT NULL AND status='ACTIVE') | migration 20260803090000 |
| Current academic year      | `seed_ay_2526` (2025-2026, status=ACTIVE, is_active=true, is_current=true)                        | —                        |
| Target academic year       | `seed_ay_2627` (2026-2027, status=INACTIVE, is_active=false, is_current=false)                    | —                        |
