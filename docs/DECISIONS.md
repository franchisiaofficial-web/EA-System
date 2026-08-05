# Architectural Decisions

- **Last Updated:** 2026-07-26
- **Current Version:** 0.1.0

---

## Decision 1: app_user Role for RLS

- **Context:** Need database-level tenant isolation with Prisma direct connection
- **Decision:** Create `app_user` role with NOBYPASSRLS, grant table privileges
- **Reason:** Enables RLS enforcement at database level while Prisma connects directly
- **Alternatives:** Use Supabase PostgREST (Path A) — rejected for complexity; rely on application checks alone — rejected for defense-in-depth
- **Consequences:** Two connection strings needed; pooler compatible with role.project-ref format

---

## Decision 2: DATABASE_URL vs DIRECT_URL Split

- **Context:** Need both RLS-enforced user queries and privileged admin operations
- **Decision:** `DATABASE_URL` → `app_user` (RLS enforced), `DIRECT_URL` → `postgres` (RLS bypassed)
- **Reason:** User-facing queries need RLS; migrations/seeds/Super Admin need full access
- **Alternatives:** Single user with FORCE RLS — rejected (breaks migrations); Single user with application checks only — rejected (no defense-in-depth)
- **Consequences:** `withRls()` uses DATABASE_URL; Super Admin services use DIRECT_URL

---

## Decision 3: RLS via SET LOCAL

- **Context:** Prisma connects directly to PostgreSQL, no JWT available
- **Decision:** Use `SET LOCAL app.current_user_id` within `$transaction` to set RLS context
- **Reason:** `auth.uid()` (Supabase JWT claim) not available with Prisma; SET LOCAL is transaction-scoped and safe
- **Alternatives:** Use Supabase client for all queries — rejected (two ORMs); Connect as restricted user only — rejected (can't create roles in Supabase pooler)
- **Consequences:** Must always use `withRls()` wrapper for user-facing queries; SET LOCAL must be within explicit transaction

---

## Decision 4: BetterAuth over Supabase Auth

- **Context:** Need authentication with multi-provider support
- **Decision:** Use BetterAuth with Prisma adapter
- **Reason:** Supports email/password, Google OAuth, session management; works with Prisma; no vendor lock-in
- **Alternatives:** Supabase Auth — rejected (GoTrue complexity, JWT dependency); NextAuth — rejected (less flexible, V5 migration)
- **Consequences:** Session stored in database (sessions table); cookie-based session tokens

---

## Decision 5: Membership Model over User.schoolId

- **Context:** Users must belong to multiple schools with different roles
- **Decision:** `User` —< `Membership` >— `School` with role and status on Membership
- **Reason:** One user can be SUPER_ADMIN at School A and STUDENT at School B simultaneously
- **Alternatives:** User.schoolId + User.role — rejected (single school only); Array of schoolIds — rejected (no role per school, harder to query)
- **Consequences:** Role lookup always goes through Membership; RLS policy checks `has_active_membership(school_id)`

---

## Decision 6: Feature + SchoolFeature over FeatureFlag

- **Context:** Need per-school feature toggles with a centralized feature catalog
- **Decision:** `Feature` (platform catalog) + `SchoolFeature` (per-school toggle, junction table)
- **Reason:** Normalized design; Feature table is the system of record for available features; SchoolFeature enables per-school toggles
- **Alternatives:** Flat `feature_flags` table with key strings — rejected (no catalog, data integrity issues)
- **Consequences:** Two queries needed to check feature availability; cleaner for subscription-based feature gating

---

## Decision 7: Service Layer Pattern

- **Context:** Need clean separation between UI (React), transport (Server Actions), and business logic
- **Decision:** Service layer between Server Actions and database
- **Reason:** Business rules in one place; reusable across Server Actions, API routes, background jobs; testable independently
- **Alternatives:** Logic in Server Actions directly — rejected (mixed concerns); Logic in React components — rejected (security risk)
- **Consequences:** Additional indirection; clear separation of concerns

---

## Decision 8: Proxy over Legacy Middleware

- **Context:** Next.js 16 deprecates middleware.ts in favor of proxy.ts
- **Decision:** Use `src/proxy.ts` with `export function proxy()`
- **Reason:** Follows Next.js 16 conventions; same functionality, different file name
- **Alternatives:** Keep middleware.ts — rejected (deprecated, generates warnings)
- **Consequences:** Minor rename; no functional changes

---

## Decision 9: Docker Test Database

- **Context:** Tests must never touch real databases
- **Decision:** Docker `postgres:16-alpine` on port 5433 for local testing; GitHub Actions service container for CI
- **Reason:** Complete isolation; reproducible; no risk of dev/production data corruption
- **Alternatives:** Separate Supabase project — rejected (cost, complexity); Skip test DB — rejected (security risk)
- **Consequences:** Requires Docker running locally; CI configured with service container

---

## Decision 10: Bulk Audit Logging — Summary Entry per Operation

- **Context:** `bulkMarkAttendance()` processes multiple attendance records in a single database transaction. The audit trail needs to record who performed the operation and what was affected without generating excessive audit rows.
- **Decision:** Write **one summary audit entry per bulk operation** (Option B), not one per record (Option A).
- **Reason:** A bulk operation is a single user action. One summary entry captures the actor, timestamp, scope (classId, date, record count), and is sufficient for traceability. Option A (per-record audit entries) would produce N audit rows for every bulk operation — disproportionate to the decision being audited, and would bloat the audit_logs table for high-volume daily attendance marking.
- **Alternatives:** Option A (one audit entry per record) — rejected for audit log bloat and redundancy; No audit logging for bulk — rejected (unacceptable for compliance).
- **Consequences:** Individual record-level changes within a bulk operation are not independently audited at the audit_logs level. The database's partial unique index and transaction atomicity provide integrity guarantees. The summary entry uses `action = 'bulk_create'`, `entity = 'attendance_record'`, and the `after` JSONB payload contains `{ count, date, classId }`.

---

## Decision 11: Historical Enrollment Eligibility — Correction (Clarification 6)

- **Context:** Sprint 2 originally specified enrollment eligibility as:
  `joinedAt <= attendanceDate AND (leftAt IS NULL OR leftAt >= attendanceDate) AND status = ACTIVE`.
  Verification Item 4 (Historical Enrollment Eligibility) revealed this incorrectly rejects legitimate historical attendance after an enrollment has later become `TRANSFERRED` or `WITHDRAWN`.
- **Decision:** Remove `status` and `isDeleted` from the eligibility check. The `joinedAt` / `leftAt` date range is authoritative. Current enrollment status is not part of historical eligibility.
- **Reason:** When a student transfers out of a class, the enrollment record's status changes to `TRANSFERRED` and `isDeleted` becomes `true`. However, the student was legitimately enrolled on dates between `joinedAt` and `leftAt`. Requiring `status = ACTIVE` blocks all historical attendance for transferred/withdrawn students, even for dates when they were actively enrolled. The `joinedAt`/`leftAt` range already captures the temporal window of enrollment — no additional status filter is needed.
- **Alternatives:** Keep status filter and create a separate historical attendance path — rejected (adds complexity without benefit); Require caller to provide the original enrollment ID — already the case, status filter is redundant with date range.
- **Consequences:** `validateEnrollmentEligibility()` in `attendance-service.ts` now checks only `joinedAt`/`leftAt` date range. `TRANSFERRED` and `WITHDRAWN` enrollments behave identically — attendance is allowed for dates within `[joinedAt, leftAt)`. Attendance on or after `leftAt` is rejected for any enrollment status. The partial unique index on `attendance_records(student_membership_id, date) WHERE is_deleted = false` remains the definitive guard against duplicates.

---

## Decision 12: Product Rebrand — SchoolOS → EA System

- **Context:** Project renamed from "SchoolOS" to "EA System" (Educational & Academics System). This is a branding-only change, treated as a separate engineering change from Sprint 2b (Attendance UI) to preserve clean regression attribution.
- **Decision:** Rename all user-facing branding strings, metadata, page content, seed data account emails, and documentation. Preserve all infrastructure identifiers unchanged.
- **Reason:** Branding and infrastructure are separate concerns. If an issue appears later, it should be immediately obvious whether it came from branding changes or UI implementation.
- **Alternatives:** Combine rebrand with Attendance UI — rejected (breaks regression attribution).
- **Consequences — Changed:**
  - Page metadata (title/description)
  - Landing page content (hero, features, FAQ, testimonials, footer, navbar)
  - Auth pages (login, register, forgot-password branding)
  - Auth illustration component
  - Seed data account emails (`@schoolos.dev` → `@easystem.dev`)
  - Documentation headings and test account references
  - `AGENTS.md` heading
- **Consequences — Preserved (unchanged):**
  - Database names (`schoolos`, `schoolos_test` in docker-compose.yml)
  - CI database name (`schoolos_test` in ci.yml)
  - npm package name (`schoolos` in package.json)
  - Prisma model names, migration history, schema identifiers
  - Environment variable names (DATABASE_URL, DIRECT_URL, etc.)
  - Supabase project identifiers
  - OAuth callback URLs
  - BetterAuth configuration
  - API route paths
  - Internal service identifiers

---

## Decision 13: Authentication Infrastructure Isolation

- **Context:** BetterAuth (session creation, credential verification, email verification) needs to read/write `users`, `accounts`, `sessions`, and `verifications` before any authenticated request exists. The application Prisma client connects as `app_user` (RLS enforced) and requires `current_user_id()` to be set via `SET LOCAL` — which is not possible during authentication because no user is logged in yet.
- **Decision:** BetterAuth uses a dedicated trusted Prisma client (`authPrisma`) connecting via `DIRECT_URL` (postgres superuser, RLS bypassed). The application's `getAuthContext()` also uses `authPrisma` for reading the authenticated user's own row and memberships, since RLS on the memberships table requires an already-established school context (circular dependency). All application business queries (attendance, classes, schools, etc.) continue to use the `app_user` Prisma client with `withRls()`.
- **Reason:** Authentication is a trusted internal system operation that occurs before request-specific security context exists. It is fundamentally different from tenant-scoped business logic and must not be subject to the same RLS enforcement. Using the privileged database connection for auth infrastructure while maintaining RLS for all business operations provides defense-in-depth without crippling the authentication flow.
- **Alternatives:**
  - Add `current_user_id() IS NULL` bypasses to RLS policies — rejected (creates unauthenticated access paths and weakens the security model)
  - Use `USING (true)` / `WITH CHECK (true)` on auth tables — rejected (opens auth tables to all users on the `app_user` connection)
  - Have BetterAuth use Supabase's `service_role` API instead of direct SQL — rejected (Prisma adapter requires direct database connection)
- **Consequences:**
  - `authPrisma` (`DIRECT_URL`) — used exclusively by BetterAuth and `getAuthContext()` for auth infrastructure reads/writes
  - `prisma` (`DATABASE_URL`, `app_user`) — used exclusively by application business logic via `withRls()`
  - The two clients are never interchanged; auth infrastructure and business logic are cleanly separated at the database connection level
  - `rls-policies.sql` is updated to include cleanup DROPs for any temporary debugging policies
  - Temporary debugging policies (`fix-rls.ts`) are replaced with a cleanup-only script
  - `sessions`, `accounts`, `verifications` RLS policies for `app_user` are limited to `SELECT` on own rows only — all writes go through `authPrisma`
  - `users` RLS policies for `app_user` remain: own-row `SELECT`/`UPDATE`, and shared-school `SELECT` for application queries through `withRls()`

---

## Decision 14: Privileged Prisma Clients

- **Context:** The project maintains two privileged Prisma clients that bypass RLS via `DIRECT_URL` (postgres superuser): `authPrisma` and the Super Admin client. Without enforcement, any developer could import these clients anywhere, silently bypassing tenant isolation.
- **Decision:** Privileged Prisma clients are governed by architectural guardrails:
  1. **Import restrictions** — `authPrisma` may only be imported from `src/lib/auth/`. The Super Admin client is only used in `src/services/super-admin/super-admin-service.ts`. A CI script (`lint:architecture`) enforces this.
  2. **No new privileged clients without an ADR** — Any new Prisma client connecting via `DIRECT_URL` or bypassing RLS must first be documented in a new Decision Record, with explicit justification, import restrictions, and testing requirements.
  3. **Testing** — All privileged client imports are verified in CI. Security integration tests verify cross-tenant isolation at the application level.
  4. **Password exposure prevention** — A dedicated audit script (`scripts/security/check-password-exposure.ts`) scans application code for queries that could expose password hashes. Only `authPrisma` (used by BetterAuth) may access the `password` field on `accounts`.
- **Reason:** The authentication architecture fix (Decision 13) corrected a critical defect where BetterAuth used the RLS-enforced application client, requiring temporary RLS bypass policies. Without permanent guardrails, this failure mode could recur — either through accidental imports of privileged clients into business code, or through new temporary bypass polices applied during debugging.
- **Alternatives:**
  - Trust code review alone — rejected (does not scale, misses refactors)
  - Make `DIRECT_URL` RLS-enforced — rejected (breaks BetterAuth, migrations, seeds)
  - Add runtime checks in Prisma middleware — rejected (performance overhead, late detection)
- **Consequences:**
  - CI fails immediately on unauthorized `authPrisma` imports or dangerous RLS patterns
  - CI runs `lint:rls`, `lint:architecture`, and `test:security` before build
  - SQL policy linter scans `prisma/`, `supabase/`, `migrations/` for `USING (true)`, `WITH CHECK (true)`, `current_user_id() IS NULL`
  - Architecture guard rejects any import of `auth-client` outside `src/lib/auth/`
  - Password audit script verifies no application code exposes password hashes
  - Extending the allowlist requires an ADR update in the same PR
  - Security guidelines document (`SECURITY_GUIDELINES.md`) codifies these rules

---

## Decision 15: Navigation Policy — No Raw 404s via In-App Navigation

- **Context:** The navigation system routes users through `NAV_ITEMS` (sidebar links visible based on role filtering) and `ROLE_REDIRECTS` (post-login dashboard redirect targets). As of Sprint 2 Objective 3 Phase A inspection, 11 routes were reachable through normal in-app navigation but produced raw Next.js 404 pages: three universal links (`/dashboard/students`, `/dashboard/academics`, `/dashboard/staff`) visible to every authenticated user, and eight role-specific dashboard targets (SUPER_ADMIN, SCHOOL_ADMIN, VICE_PRINCIPAL, ACCOUNTANT, HR, TRANSPORT_MANAGER, DRIVER, LIBRARIAN).
- **Decision:** Routes reachable through `NAV_ITEMS` or `ROLE_REDIRECTS` must never expose users to a raw 404. Until implemented, unfinished modules render a shared `ComingSoon` experience inside `DashboardShell`. A single presentation component (`src/components/dashboard/ComingSoon.tsx`) provides the shared UI. Each missing route gets a thin `page.tsx` that imports and renders it with the appropriate page title and description.
- **Reason:** Raw 404s break the dashboard shell, remove navigation access (sidebar, header, logout), and communicate failure rather than intentional roadmap. A Coming Soon experience retains the shell, preserves all navigation affordances, and communicates intent. The raw 404 is acceptable for completely unknown URLs — not for routes the application itself links to.
- **Alternatives:**
  - Hide unfinished NAV_ITEMS entries — rejected (hides product roadmap, requires role-filtering changes, prevents users from discovering planned features)
  - Catch-all `[...slug]` route — rejected (overly broad; could mask legitimate routing errors; conflicts with explicit route definitions)
  - Per-page custom placeholder — rejected (duplicates presentation logic across 11 files)
- **Consequences:**
  - 12 new files: 1 shared `ComingSoon.tsx` component + 11 per-route `page.tsx` files
  - All files are purely additive — no existing files modified
  - Each `page.tsx` matches the existing dashboard index page pattern: no role-specific authorization check (auth handled by `dashboard/layout.tsx`)
  - As real modules are built, individual `page.tsx` files are replaced with full implementations
  - The `ComingSoon.tsx` component remains available for any future modules added to NAV_ITEMS before implementation

---

## Decision 16: Status Colour Decision — Domain-Semantic, Not Theme Tokens

- **Context:** Status indicators throughout the attendance UI use colour to communicate meaning: emerald for present, amber for late/warning, rose for absent/destructive, slate for excused/neutral. During the Sprint 2 Objective 2 semantic token migration, these were intentionally excluded from the migration scope.
- **Decision:** Status colours (`slate`, `amber`, `rose`, and their numeric variants) remain domain-semantic colours and are intentionally outside the structural theme token system. They are applied via Tailwind utility classes (e.g., `text-amber-500`, `bg-rose-50`, `dark:text-amber-400`) directly in status-related components.
- **Reason:** These colours carry domain meaning (status = present/late/absent/excused) rather than structural meaning (text/background/border). They are not interchangeable with theme tokens. A `--status-present`, `--status-late`, etc. architecture would be the correct abstraction, but introduces complexity (consistency across light/dark modes, future additional statuses) that is premature at this stage.
- **Alternatives:**
  - Migrate to theme tokens — rejected (status colours are not structural; a warning yellow is not semantic-equivalent to a border grey)
  - Create `--status-*` tokens now — deferred (appropriate abstraction but out of scope; adds design tokens with no clear spec for all future status types)
- **Consequences:**
  - Status colours remain as Tailwind utility classes
  - A future `--status-*` token architecture may replace them
  - No migration is planned at this time
  - Status components are visually consistent within their domain — the emerald/amber/rose/slate palette is stable

---

## Decision 17: Role Navigation — Current State Matrix

- **Context:** Sprint 2 Objective 3 implements Coming Soon placeholders for all unfinished dashboard routes. This decision documents the complete role-to-route mapping as of implementation completion.
- **Decision:** The following matrix defines the current state for every role. Unfinished routes render Coming Soon. Live routes render full implementations.

### Super Admin

| Route                                       | Status      |
| ------------------------------------------- | ----------- |
| `/dashboard/super-admin`                    | Coming Soon |
| `/dashboard/principal/attendance` (via nav) | Live        |

### School Admin

| Route                                       | Status      |
| ------------------------------------------- | ----------- |
| `/dashboard/admin`                          | Coming Soon |
| `/dashboard/principal/attendance` (via nav) | Live        |

### Principal

| Route                             | Status                |
| --------------------------------- | --------------------- |
| `/dashboard/principal`            | Redirect → attendance |
| `/dashboard/principal/attendance` | Live                  |

### Vice Principal

| Route                                       | Status      |
| ------------------------------------------- | ----------- |
| `/dashboard/vice-principal`                 | Coming Soon |
| `/dashboard/principal/attendance` (via nav) | Live        |

### Teacher / Class Teacher

| Route                           | Status                |
| ------------------------------- | --------------------- |
| `/dashboard/teacher`            | Redirect → attendance |
| `/dashboard/teacher/attendance` | Live                  |

### Student

| Route                           | Status                |
| ------------------------------- | --------------------- |
| `/dashboard/student`            | Redirect → attendance |
| `/dashboard/student/attendance` | Live                  |

### Parent

| Route                          | Status                |
| ------------------------------ | --------------------- |
| `/dashboard/parent`            | Redirect → attendance |
| `/dashboard/parent/attendance` | Live                  |

### Accountant

| Route                   | Status      |
| ----------------------- | ----------- |
| `/dashboard/accountant` | Coming Soon |

### HR

| Route           | Status      |
| --------------- | ----------- |
| `/dashboard/hr` | Coming Soon |

### Transport Manager

| Route                  | Status      |
| ---------------------- | ----------- |
| `/dashboard/transport` | Coming Soon |

### Driver

| Route               | Status      |
| ------------------- | ----------- |
| `/dashboard/driver` | Coming Soon |

### Librarian

| Route                | Status      |
| -------------------- | ----------- |
| `/dashboard/library` | Coming Soon |

### Non-Teaching / Cafeteria Staff

| Route              | Status      |
| ------------------ | ----------- |
| `/dashboard/staff` | Coming Soon |

### All Roles (universal NAV_ITEMS entries)

| Route                  | Status      |
| ---------------------- | ----------- |
| `/dashboard/students`  | Coming Soon |
| `/dashboard/academics` | Coming Soon |
| `/dashboard/staff`     | Coming Soon |

- **Reason:** This documents the complete navigation surface so future implementers know which routes are live, which are redirect stubs, and which are Coming Soon placeholders. It also serves as a checklist for incremental module rollout.
- **Alternatives:** None — this is documentation, not an architectural decision. It records the state created by the architectural decision (Decision 15).
- **Consequences:** This matrix must be updated whenever a Coming Soon placeholder is replaced with a full implementation. The list of live routes grows monotonically — routes transition from Coming Soon to Live but never in reverse.

## Decision 18: Multi-Tenant Scheduler Isolation — Global Worker Pool (Phase 3 Precondition Note)

- **Context:** The PromotionJob scheduler (`promotion-job-service.ts`) is a single in-process FIFO queue with **one global worker pool**: `PARALLEL_WORKERS = Number(process.env.PROMOTION_WORKERS) || 6` (promotion-service.ts:134). Jobs are serialized one at a time per process across **all schools**; the only cross-tenant boundary is RLS (`has_active_membership`).
- **Decision:** For the current single-school seed this is acceptable and documented as a known single-tenant simplification. When multi-tenancy ships (more than one school with promotion activity), the global queue and global pool become a correctness-and-fairness liability: one school's long job blocks every other school's jobs (queue head-of-line), and the pool is shared with no per-tenant concurrency budget.
- **Reason:** Verified during Phase 3 precondition work that the 6-worker pool saturates the 6-connection RLS pool and drives the roll-allocation race failures (see `docs/evidence/promotion-phase3-precondition/`); adding tenants to the same pool multiplies contention without isolation.
- **Alternatives considered:** (a) per-tenant worker pools (`PROMOTION_WORKERS` scoped by schoolId at job-plan time) — recommended; (b) per-tenant FIFO queues with a global fairness scheduler — more complex, needed only at scale; (c) keep global pool — rejected for multi-tenant, retained for the current single-tenant deployment.
- **Consequences:** Multi-tenant rollout must add per-tenant pool isolation before promoting tenants concurrently. Until then, the scheduler serializes all tenants, and the 241-failure roll-race finding (fixed per phase3-readiness.md) applies per-tenant once the allocator is made concurrency-safe.
