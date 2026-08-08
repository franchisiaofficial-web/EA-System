# Phase 1.5 — Staff Lifecycle (Archive / Restore / Deactivate / Reactivate)

**Date:** 2026-08-08
**Contract:** `staff-domain-architecture-v1.md` §5 (lifecycle states) + §15.2 (delete policy) + `staff-rbac-v1.md` / `permission-matrix-v1.md` (grants)
**Mode:** Code implementation + runtime verification. No schema change (ratification constraint).
**Predecessor:** `phase1-5-discrepancy-investigation.md` — determined the previous "Phase 1.5" report had no corresponding files, commits, or objects (determination `NOT FOUND`). This phase re-implements the lifecycle from the approved contract and verifies it end-to-end.

---

## 1. Scope delivered

| # | Contract item | Delivered |
|---|---|---|
| 1 | Service methods: `archiveStaff`, `restoreStaff`, `deactivateStaff`, `reactivateStaff` | `src/services/staff/staff-service.ts` (lifecycle section) |
| 2 | Thin routes: `POST /api/staff/members/[id]/{archive,restore,deactivate,reactivate}` | 4 route files |
| 3 | Permission actions `deactivate`/`reactivate` + grants | `src/lib/permissions/permissions.ts` |
| 4 | UI: status filter + row actions, `LifecycleDialog.tsx`, permission flags | `StaffList.tsx`, `LifecycleDialog.tsx`, `staff/page.tsx` |
| 5 | Evidence: this document + runtime verifier `phase1-5-staff-lifecycle-verify.ts` | ✅ |

## 2. Lifecycle model (architecture §5)

States use existing enum values only (`MembershipStatus` + `StaffProfile.isDeleted`). No new status enum.

| Transition | from → to | `isDeleted` | sessions revoked | audit action |
|---|---|---|---|---|
| Archive | ACTIVE \| SUSPENDED → REMOVED | true | yes | `staff_archived` |
| Restore | REMOVED → ACTIVE | false | no | `staff_restored` |
| Deactivate | ACTIVE → SUSPENDED | unchanged | yes | `staff_deactivated` |
| Reactivate | SUSPENDED → ACTIVE | unchanged | no | `staff_reactivated` |

Rules implemented in `runLifecycleTransition` (`staff-service.ts`):
- Every transition verifies the target belongs to the caller's school **before any mutation** (`assertLifecycleTarget` → `membership.findFirst({ id, schoolId })`, never `findUnique({ id })`).
- Invalid transitions throw `StaffConflictError` (e.g. archive of an already-REMOVED member).
- Every write is audited **in the same transaction** (rollback-safe, architecture Rule 7).
- Archive/deactivate revoke the target's sessions immediately (`session.deleteMany({ userId })`).
- Lifecycle metadata (`archivedAt/archivedBy/archiveReason` semantics) is captured in the audit-log before/after JSON (architecture §5 / §15.2 — no schema change).
- Historical records are never deleted: class assignments, subject assignments, and attendance records referencing the member are preserved (verified below).
- No DELETE endpoint exists — removal is the archive transition, matching §15.2's soft-delete policy (`check 16` finds zero DELETE handlers under `/api/staff/members`).

## 3. Permission grants (`permissions.ts`)

`deactivate`/`reactivate` added to the `Action` union. Grants (consistent with the Phase 1.4 matrix; PRINCIPAL and below excluded):

| Action | SUPER_ADMIN | SCHOOL_ADMIN | HR | PRINCIPAL | below |
|---|---|---|---|---|---|
| `staff:archive` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `staff:restore` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `staff:deactivate` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `staff:reactivate` | ✓ | ✓ | ✓ | ✗ | ✗ |

`restore` remains SCHOOL_ADMIN/SUPER_ADMIN only (verified `check 07c`). Archive/deactivate/reactivate include HR per the approved matrix.

## 4. Files changed

| File | Change |
|---|---|
| `src/services/staff/staff-service.ts` | Added lifecycle section: transition table, `assertLifecycleTarget`, `writeLifecycleAudit`, `runLifecycleTransition`, 4 public methods; `AuthContext` import added |
| `src/app/api/staff/members/[id]/archive/route.ts` | `POST`, guard `staff:archive`, body → `archiveStaff` (reason required) |
| `src/app/api/staff/members/[id]/restore/route.ts` | `POST`, guard `staff:restore`, body → `restoreStaff` |
| `src/app/api/staff/members/[id]/deactivate/route.ts` | `POST`, guard `staff:deactivate`, body → `deactivateStaff` |
| `src/app/api/staff/members/[id]/reactivate/route.ts` | `POST`, guard `staff:reactivate`, body → `reactivateStaff` |
| `src/lib/permissions/permissions.ts` | `deactivate`/`reactivate` actions + grants (SUPER_ADMIN, SCHOOL_ADMIN, HR) |
| `src/app/dashboard/staff/StaffList.tsx` | Status filter + row lifecycle actions |
| `src/app/dashboard/staff/LifecycleDialog.tsx` | New — confirm-and-call dialog for archive (with reason) / restore / deactivate / reactivate |
| `src/app/dashboard/staff/page.tsx` | Passes `canArchive/canRestore/canDeactivate/canReactivate` from `staff:*` permissions |
| `docs/evidence/staff-domain-phase1/phase1-5-staff-lifecycle-verify.ts` | Runtime verifier (37 checks) |

## 5. Runtime verification

Run: `npx tsx docs/evidence/staff-domain-phase1/phase1-5-staff-lifecycle-verify.ts`

**Result: 37 checks, 0 failures — ALL PHASE 1.5 CHECKS PASS**

The verifier creates a temporary staff member + user under the seed school (School A), then exercises, in order:

- **Deactivate (ACTIVE→SUSPENDED):** status persisted; member excluded from the ACTIVE teacher list (`check 11`); pre-existing class assignment preserved (`check 14`); sessions revoked (`15`) and `resolveAuthUser` returns `NO_ACTIVE_MEMBERSHIP` (`15b`); audit row `staff_deactivated` written with before/after status (`08`, `08b`); invalid transition (deactivate a suspended member) throws `StaffConflictError` (`05`).
- **Reactivate (SUSPENDED→ACTIVE):** status persisted; audit row `staff_reactivated`; auth restored (`resolveAuthUser` OK); invalid transition (reactivate an active member) throws (`05c`).
- **Archive (ACTIVE→REMOVED):** status persisted (`01b`); `StaffProfile.isDeleted = true` (`01c`); audit row `staff_archived` with `reason`, `previousStatus=ACTIVE`, `newStatus=REMOVED` (`08d`, `08e`); excluded from active list (`11b`); class assignment **and** attendance records preserved (`14b`, `14c`); session created immediately before archive is revoked (`15d`); auth blocked (`15e`); invalid transition (reactivate an archived member) throws (`05b`).
- **Restore (REMOVED→ACTIVE):** status persisted (`04b`); `isDeleted` reset to **false** (`04c` — regression fixed this phase: the initial implementation never cleared `isDeleted` on restore); audit row `staff_restored` (`08f`); invalid transition (restore an active member) throws (`05c`).
- **Tenant isolation:** a School-B-admin context attempting archive on the School-A member throws `AuthorizationError` (403) (`06`).
- **Role matrix:** deactivate/reactivate grants match the approved matrix; restore remains SCHOOL_ADMIN-only (`07`, `07b`, `07c`).
- **No-delete policy:** zero DELETE handlers exist under `/api/staff/members` (`16`).
- **Read path unaffected:** `GET /api/staff/members/[id]` still returns the member profile after the lifecycle toggles (`17`).
- **Assignment resolver unchanged:** the ACTIVE-scoped teacher reader (`/api/teachers`) returns the restored ACTIVE member — the resolver filter was NOT altered by lifecycle (`18`).

Cleanup: all fixture rows (temp user, membership, assignment, attendance, sessions, audit rows) are deleted in the verifier's rollback.

### Regression fixed during verification

`check 04c` initially failed: restoring a member left `StaffProfile.isDeleted = true`. Root cause: `runLifecycleTransition` only updated `isDeleted` when `spec.setsDeleted` was truthy, so restore (which sets it to `false`) never touched the profile. Fix: the profile update runs when `spec.setsDeleted || spec.from.includes('REMOVED')` (`staff-service.ts:629`), so archive sets `true` and restore sets `false`. Re-run: 37/37 PASS.

## 6. Static verification

- `npx tsc --noEmit` → exit 0.
- `npx eslint` on all changed files → 0 errors (1 pre-existing unused-var warning in `StaffList.tsx:50`).
- `npx next build` → completes; staff dashboard routes build (`/dashboard/staff`, `/dashboard/staff/create`, `/dashboard/staff/[id]/edit`).
- `npx tsx docs/evidence/staff-domain-phase1/phase1-4-permission-conformance.ts` → **227 assertions, 0 failures** (matrix extended with `deactivate`/`reactivate`).

## 7. Files modified

- Source: `staff-service.ts`, 4 lifecycle route files, `permissions.ts`, `StaffList.tsx`, `LifecycleDialog.tsx` (new), `staff/page.tsx`.
- Evidence: `phase1-5-staff-lifecycle-verify.ts` (new), this document (new).
- **No schema or migration files changed** (ratification constraint).
