# Architectural Decisions

- **Last Updated:** 2026-07-25
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
