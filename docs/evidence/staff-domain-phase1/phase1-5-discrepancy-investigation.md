# Phase 1.5 Discrepancy Investigation

**Date:** 2026-08-08
**Mode:** Investigation only. No source/schema/API/UI/test files modified.
**Contract references:** Staff Domain Architecture v1 (§5 lifecycle, §15.2 delete policy), `staff-rbac-v1.md`, `permission-matrix-v1.md`, `phase1-4-permission-deltas.md`.

---

## 1. Current Repository State

- Branch: `master` (tracks `origin/master`, "up to date").
- HEAD: `58c8319` — `feat(promotion): implement Phase 3.3 PRESERVE_SECTION with verified evidence` (tag `phase-3.3-frozen`).
- Working tree contains **uncommitted** Phase 1.3/1.4 staff work:
  - `src/services/staff/staff-service.ts` (**untracked**, `?? src/services/staff/`) — contains only `listStaffMembers`, `getStaffMember`, `createStaffMember`, `updateStaffMember` (grep-verified). **No lifecycle methods.**
  - `src/app/api/staff/members/route.ts` + `src/app/api/staff/members/[id]/route.ts` — modified to delegate to the service (thin routes).
  - `src/app/dashboard/staff/page.tsx` — page gate derives from `staff:read`; passes `staff:create`/`staff:update`.
  - `src/lib/permissions/permissions.ts` — `staff` resource + `archive`/`restore` actions added (ACCOUNTANT payroll tightened, TEACHER payroll self-read, PRINCIPAL/VICE_PRINCIPAL/ACCOUNTANT staff read).
  - `docs/evidence/staff-domain-phase1/` — only `investigation-5a`, `investigation-5b-raw-sql.ts/.txt`, `investigation-5b-staff-security-architecture-gate.md`, `phase1-1-teachers-search-verify.ts`, `phase1-4-permission-conformance.ts`, `phase1-4-permission-deltas.md`. **No Phase 1.5 files.**
- `npx tsc --noEmit` exits 0 on current state.

## 2. Git Branch Evidence

- Local branches: `master` only.
- Remote-tracking: `origin/HEAD -> origin/master`, `origin/master` only.
- **No feature branch contains Phase 1.5 work.**

## 3. Commit History Evidence

- `git log --all --oneline --grep="lifecycle\|Phase 1.5\|phase1-5\|LifecycleDialog\|archive\|restore\|deactivate\|reactivate" -i` → **no output**.
- `git log --all --diff-filter=D` on the lifecycle route paths and `LifecycleDialog.tsx` → **no output** (nothing was ever committed then deleted).
- `git rev-list --all --objects` (1,144 objects) filtered for paths `members/[id]/{archive,deactivate,restore,reactivate}`, `LifecycleDialog`, `phase1-5`, `staff-lifecycle` → **no matches**.
- Full commit list (11 commits, initial→HEAD): none reference staff lifecycle. Only staff-adjacent commit is `ef532db` (Phase 1.6/1.6B tenant isolation audit), which shipped the pre-existing staff CRUD surface, not lifecycle.

## 4. Reflog Evidence

- `git reflog --date=iso` → all entries are commits/resets on `master` (Phase 3.3, 1.6C, 1.6/1.6B, evidence framework, student/guardian, Sprint 2, Phase 0, initial).
- **No entry references Phase 1.5, lifecycle, or staff lifecycle work.**
- No branch was checked out/created/destroyed that could have carried lifecycle code.

## 5. Stash Evidence

- `git stash list` → **empty**.
- `git reflog show stash` → fatal: no `stash` ref exists.
- `git fsck --unreachable --no-reflogs` → 28 unreachable commits, ALL identified as stash **WIP/index** entries (e.g. `WIP on master: 58c8319 ...`, `index on master: ...`, `On master: 3b-lint-baseline`). Their trees contain only the pre-existing staff files (route.ts, StaffList.tsx, StaffCreateForm/StaffEditForm, page.tsx) and `prisma/rls-staff-subjects.sql`. **None contain lifecycle routes, `LifecycleDialog.tsx`, or a phase1-5 file.**
- 316 unreachable blobs scanned by content for `archiveStaff|restoreStaff|deactivateStaff|reactivateStaff|LifecycleDialog|staff_archived` → **zero content matches**.

## 6. Repository Artifact Search

Working tree (`grep` across repo, and targeted checks):

| Artifact | Working tree | Any git object (commit/tree/blob/reflog/stash) |
|---|---|---|
| `archiveStaff` / `restoreStaff` / `deactivateStaff` / `reactivateStaff` | Not found | Not found |
| `LifecycleDialog.tsx` | Not found (path absent) | Not found |
| `phase1-5*` (md/ts) in `docs/evidence/staff-domain-phase1/` | Not found | Not found |
| `members/[id]/{archive,deactivate,restore,reactivate}/route.ts` | Not found (`[id]/` contains only `route.ts`) | Not found |
| `staff_archived` / `staff_restored` / `staff_deactivated` / `staff_reactivated` | Only in design docs (§5/§14/§15.2 of `staff-domain-architecture-v1.md`, `staff-rbac-v1.md`) — **no code** | Not found |
| `archivedAt` / `archivedBy` / `archiveReason` | Not found | Not found |
| `deactivate` / `reactivate` actions in `permissions.ts` | **Not present** (only `archive`/`restore` were added) | — |
| `staff-service.ts` | Exists, untracked, 4 CRUD methods only | Never committed (`git ls-files src/services/staff/` → empty) |

The only "lifecycle" matches in the entire repo are unrelated: `e2e/scenarios/e1-student-lifecycle.spec.ts`, `e2e/scenarios/e2-guardian-lifecycle.spec.ts`, and `docs/architecture/canonical-academic-year-lifecycle-v1.md`.

## 7. What Was Actually Found

- The **Phase 1.3/1.4** work described in the previous session summary IS present: staff service layer (4 CRUD methods), thin routes, `staff` permission resource with `archive`/`restore`, page-gate parity, and the Phase 1.4 evidence package (`phase1-4-permission-conformance.ts` = **197 assertions, 0 failures**; `phase1-4-permission-deltas.md`).
- The **Phase 1.5** lifecycle work (archive/restore/deactivate/reactivate service methods, four lifecycle routes, `LifecycleDialog.tsx`, `staff:deactivate`/`staff:reactivate` permission actions, phase1-5 evidence + runtime verifier) is **absent everywhere**: not in the current branch, not in any other branch, not in reflog, not in stash (list empty), not in any unreachable/dangling commit, tree, or blob.
- The Phase 1.4 conformance matrix deliberately covers only `read/create/update/archive/restore/export/manage` — deactivate/reactivate were never part of the ratified implementation.
- `staff-service.ts` itself has never been committed (untracked), so even the Phase 1.4 service layer has no committed snapshot.

## 8. Determination

**NOT FOUND**

No evidence that the Phase 1.5 implementation ever existed. It is not in the current branch (A), not in another branch (B), not in reflog (C), not in stash (D), and not in a reset/rebased commit (E). The prior session's Phase 1.5 report does not correspond to any file, commit, or object in this repository — the Phase 1.5 implementation never actually existed (F). The current repository state is: Phase 1.3/1.4 service-layer + permission work complete and uncommitted; Phase 1.5 not started.

## 9. Recommended Next Action

Phase 1.5 must be **reimplemented from the approved contract** (`staff-domain-architecture-v1.md` §5 lifecycle + §15.2 delete policy + `staff-rbac-v1.md`). No recovery source exists.

Required Phase 1.5 scope (per contract):
1. Service methods on `staff-service.ts`: `archiveStaff` (ACTIVE/SUSPENDED → REMOVED, reason required), `restoreStaff` (REMOVED → ACTIVE, SCHOOL_ADMIN only), `deactivateStaff` (ACTIVE → SUSPENDED), `reactivateStaff` (SUSPENDED → ACTIVE) — each ownership-checked (`findFirst({ id, schoolId })`), same-transaction audited, sessions revoked on archive/deactivate.
2. Thin routes: `POST /api/staff/members/[id]/archive`, `/restore`, `/deactivate`, `/reactivate`.
3. Permission map: add `deactivate`/`reactivate` actions + grants (SCHOOL_ADMIN, SUPER_ADMIN, HR; PRINCIPAL and below excluded), and extend the conformance matrix.
4. UI: status filter + row actions in `StaffList.tsx`, `LifecycleDialog.tsx`, permission flags via `staff/page.tsx`.
5. Evidence: `phase1-5-staff-lifecycle.md` + runtime verifier.

This investigation's determination is `NOT FOUND`; no recovery approval is requested. Proceeding to implementation requires explicit user approval.

## 10. Files Modified

- **No source, schema, migration, API, UI, permission, or test files were modified.**
- **No branches checked out; no reset/rebase; no stash applied; no cherry-pick; nothing fixed.**
- Only file created: `docs/evidence/staff-domain-phase1/phase1-5-discrepancy-investigation.md` (this document).
