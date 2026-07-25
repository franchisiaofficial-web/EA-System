# Changelog

- **Last Updated:** 2026-07-25
- **Current Version:** 0.3.0

---

## v0.3.0 — Sprint 2 (Attendance Backend + Rebrand)

### Added

- Attendance backend: `markAttendance`, `bulkMarkAttendance`, `updateAttendanceRecord`
- Attendance RLS policies (6 policies covering teacher/student/parent/admin access)
- `validateEnrollmentEligibility()` with date-range-only check
- `ATTENDANCE_BACKDATE_LIMIT_DAYS = 3`
- `calculateAttendancePercentage()` utility
- Partial unique index `attendance_records_student_date_key`
- `has_parent_link()` RLS helper function
- Academic service: `transferStudent()` with audit logging
- Decision 10: Bulk audit logging (summary entry per operation)
- Decision 11: Historical enrollment eligibility correction
- Decision 12: Product rebrand (SchoolOS → EA System)
- Production function test suite (12 tests for attendance service)
- Academic service test suite (2 tests for transfer atomicity)
- 105 permanent automated tests

### Changed

- Product rebrand: "SchoolOS" → "EA System" across all user-facing branding, metadata, seed data, and documentation
- `validateEnrollmentEligibility()`: removed `status='ACTIVE'` and `isDeleted=false` filters; relies on `joinedAt`/`leftAt` date range only
- `validateEnrollmentEligibility()`: fixed `WHERE id` → `WHERE student_membership_id` bug
- `withRls()`: replaced `$executeRaw` tagged templates (SET LOCAL) with parameterized `SELECT set_config()` calls
- Updated `docs/DECISIONS.md` (Decisions 10, 11, 12)
- Updated `docs/CHANGELOG.md` (this file)

### Security

- `withRls()` uses parameterized queries via `set_config()` — no SQL interpolation
- Verified `current_setting()` lifecycle: NULL on fresh session, `''` after GUC registration, `nullif(..., '')` normalizes at `current_user_id()` helper
- All 27 RLS policies route through `current_user_id()` → safe for all unset/empty/NULL states

### Fixed

- `validateEnrollmentEligibility()` bug: queried `class_enrollments.id` instead of `student_membership_id`
- `validateEnrollmentEligibility()` bug: blocked historical attendance for TRANSFERRED/WITHDRAWN students
- `withRls()` bug: `$executeRaw` tagged templates incompatible with SET LOCAL (parameter `$1` not supported)
- Missing permanent test for transfer atomicity (added `academic-service.test.ts`)
- DECISIONS.md missing bulk audit logging decision (added Decision 10)

### Preserved (unchanged by rebrand)

- Database names (`schoolos`, `schoolos_test`)
- CI database name
- npm package name
- All Prisma identifiers, migration history
- Environment variable names
- Supabase project identifiers
- OAuth callback URLs
- BetterAuth configuration
- API routes
- Internal service identifiers

---

## 2026-07-25 (Phase 0 Freeze)

### Added

- Multi-tenant database schema (17 models, 15 roles, 5 enums)
- BetterAuth authentication with email/password + Google OAuth scaffold
- Config-driven RBAC system (15 roles × 22 resources × 7 actions)
- RLS policies on all 14 tenant tables (17 policies)
- `withRls()` middleware for Prisma (SET LOCAL transaction context)
- Next.js 16 proxy for route protection
- Service layer (auth, schools, memberships, features, super-admin, audit)
- Audit logging utility integrated into all service operations
- Rate limiting on auth endpoints (10 req/min per IP)
- Registration flow (`/register`)
- Password reset flow (`/forgot-password`)
- Logout component
- Landing page (11 sections, CLI-themed)
- Docker Compose test database service (`postgres-test`)
- Permanent test suite (55 tests: 41 RBAC + 14 RLS)
- GitHub Actions CI with test execution

### Fixed

- SQL injection vulnerability in `withRls()` (string interpolation → tagged template)
- Test database isolation (removed fallback to DIRECT_URL)
- `auth.uid()` incompatibility (replaced with `current_user_id()` + SET LOCAL)
- FeatureFlag replaced with normalized Feature + SchoolFeature tables
- Schema drift between Prisma and migration files
- Lint errors (Link component, theme provider, unused imports)
- Prisma 7 datasource.url deprecation

### Security

- RLS enforcement verified with `app_user` role (no BYPASSRLS)
- PgBouncer transaction pooling verified (port 6543)
- Super Admin operations routed through DIRECT_URL (never withRls)
- All three secrets rotated (BETTER_AUTH_SECRET, app_user password, Supabase password)
- Tenant isolation confirmed: cross-tenant reads blocked, SUSPENDED/REMOVED memberships denied, forged context rejected

### Changed

- `app_user` role created with restricted privileges (no BYPASSRLS)
- DATABASE_URL → `app_user` via pooler (port 6543)
- DIRECT_URL → `postgres` for migrations/seeds only
- `withRls()` now accepts full `RequestContext` (userId, schoolId, membershipId, role)
- Seed script updated for Membership-based schema
- `.env.example` simplified (removed stale Supabase vars)
- CI workflow expanded with test steps
