# Phase 1.4 — Ratified Permission Deltas Applied (Staff Domain)

**Date:** 2026-08-07
**Contract:** `docs/architecture/permission-matrix-v1.md` (Approved v1), `staff-rbac-v1.md`, `payroll-rbac-v1.md`, `staff-domain-architecture-v1.md` §15
**Mode:** Code implementation (permission-map + guards + page gates). No schema changes (ratification constraint).

---

## 1. Summary

Applied the Phase 1.2‑ratified permission deltas:

- Introduced the dedicated **`staff`** permission resource (D1 — Option B).
- Added **`archive`** and **`restore`** to the `Action` union.
- Migrated all staff API guards from `teachers` → `staff`.
- Derived the staff page gates from `staff:read` / `staff:create` / `staff:update`, removing the hardcoded role lists (architecture §15.3 parity rule).
- Tightened **`payroll`** per §9.2 / `payroll-rbac-v1.md`: ACCOUNTANT loses manage/approve (read+export only), HR loses manage/export/approve (read/create/update), employee staff roles gain own-view `payroll:read`.

During this pass the **Phase 1.3 route refactor was also completed**: the two staff route files had not yet been wired to `StaffService` on disk (they still contained the old inline Prisma). Both `GET/POST /api/staff/members` and `GET/PATCH /api/staff/members/[id]` are now thin service consumers, eliminating the `STAFF_ROLES` duplication (architecture §3.2) and a `@typescript-eslint/no-explicit-any` in the `[id]` route.

## 2. Files changed

| File | Change |
|---|---|
| `src/lib/permissions/permissions.ts` | Added `staff` resource, `archive`/`restore` actions; per-role `staff` grants; `payroll` tightening |
| `src/app/api/staff/members/route.ts` | Guards → `staff:read` / `staff:create`; body → `StaffService` (`listStaffMembers`, `createStaffMember`) |
| `src/app/api/staff/members/[id]/route.ts` | Guards → `staff:read` / `staff:update`; body → `StaffService` (`getStaffMember`, `updateStaffMember`) |
| `src/services/staff/staff-service.ts` | Fixed `updateStaffMember` profile-typing (TS2322 ×4) with a plain `profileFields` object valid for both update and create |
| `src/app/dashboard/staff/page.tsx` | Gate from hardcoded role list → `hasPermission(role,'staff','read')`; `canCreate`/`canUpdate` from `staff:create`/`staff:update` |
| `src/app/dashboard/staff/create/page.tsx` | Removed hardcoded list; gate → `staff:create` |
| `src/app/dashboard/staff/[id]/edit/page.tsx` | Removed hardcoded list; gate → `staff:update` |
| `docs/evidence/staff-domain-phase1/phase1-4-permission-conformance.ts` | New — matrix conformance assertion script |

`/api/teachers` remains on `teachers:read` (teaching reader; §6.3) — verified unchanged.

## 3. Approved `staff` grants applied (per role)

| Role | read | create | update | archive | restore | export |
|---|---|---|---|---|---|---|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SCHOOL_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| PRINCIPAL | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| VICE_PRINCIPAL | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| ACCOUNTANT | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| LIBRARIAN | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TRANSPORT_MANAGER | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| NON_TEACHING | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TEACHER / CLASS_TEACHER / DRIVER / CAFETERIA_STAFF | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| STUDENT / PARENT | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**HR `manage` nuance (documented divergence):** `permission-matrix-v1.md §2` lists `staff:manage` ✓ for HR, but §4 (delete policy) lists `staff:restore` ✗ (SCHOOL_ADMIN only). Since `manage` = all actions by definition, HR is implemented with **explicit actions** (`read/create/update/archive/export`) and **no `manage` key** — so `hasPermission(HR, staff, restore)` and `hasPermission(HR, staff, manage)` are both false. This honors the binding delete-policy rule over the shorthand cell.

## 4. `payroll` tightening applied (per `payroll-rbac-v1.md`)

| Role | read | create | update | approve | export | manage |
|---|---|---|---|---|---|---|
| SUPER_ADMIN / SCHOOL_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR | ✓ (others) | ✓ (entry) | ✓ (entry) | ✗ | ✗ | ✗ |
| ACCOUNTANT | ✓ (others) | ✗ | ✗ | ✗ | ✓ | ✗ |
| PRINCIPAL | ✓ (View Basic) | ✗ | ✗ | ✗ | ✗ | ✗ |
| VICE_PRINCIPAL | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TEACHER / CLASS_TEACHER / NON_TEACHING / LIBRARIAN / TRANSPORT_MANAGER / DRIVER / CAFETERIA_STAFF | ✓ (own) | ✗ | ✗ | ✗ | ✗ | ✗ |
| STUDENT / PARENT | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

Own/others/basic scoping is enforced at the future payroll reader (service-level, architecture §9.4), not by the permission map.

## 5. API contract preservation

Refactoring the routes to the service preserved the exact current wire contract:

- `GET /api/staff/members` — defaults `pageSize=10` (max 100), `status='ACTIVE'`, `search=''`; response `{ success, data: { items, total, page, pageSize, totalPages } }`.
- `POST /api/staff/members` — `201 Created` on success; `400` validation; `409` duplicate email; `403` unauthorized.
- `GET /api/staff/members/[id]` — `404` when missing; full detail shape (`profile`, `assignments`) unchanged.
- `PATCH /api/staff/members/[id]` — `200` with `{ user, membership, profile }`; `400`/`404`/`409` unchanged.

## 6. Verification

- ✅ `npx tsc --noEmit` — clean (0 errors).
- ✅ `npx eslint` on all 7 changed source files — clean (0 errors/warnings).
- ✅ `npm run build` — exit 0.
- ✅ Conformance: `phase1-4-permission-conformance.ts` — **197 assertions, 0 failures** (full staff matrix across 15 roles × 7 actions + payroll matrix × 6 actions + `teachers:read` retention checks).

## 7. Next steps (per architecture §17 order)

Feature-by-feature implementation, each additive + ownership-checked + audited (§7 service table):
archive/restore endpoints (D3 delete policy), employment history (§11), documents (§12), activity timeline (§13), then payroll (§9) and leave (§10).
