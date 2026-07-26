# Security Guidelines

- **Last Updated:** 2026-07-26
- **Current Version:** 0.1.0

---

## RLS Policy Rules

### Never Use

The following patterns must never appear in production RLS policy definitions:

| Pattern                     | Why It Is Dangerous                                                   |
| --------------------------- | --------------------------------------------------------------------- |
| `USING (true)`              | Grants unrestricted read access to all rows regardless of RLS context |
| `WITH CHECK (true)`         | Grants unrestricted write access — any row can be inserted/updated    |
| `current_user_id() IS NULL` | Creates an unauthenticated access path when no user context exists    |
| `auth.uid() IS NULL`        | Same as above, but for Supabase JWT-based authentication              |
| `OR TRUE`                   | Short-circuits any preceding condition, making it always pass         |
| `WHERE TRUE`                | Matches all rows unconditionally                                      |

### Suppression

If a dangerous pattern is genuinely required (e.g., for a migration compatibility step), use:

```sql
-- security-linter-ignore
-- justification: [explain why this is required and what risk mitigations exist]
```

The `-- security-linter-ignore` comment applies only to the immediately following SQL statement and must include a justification.

### Debugging Policy

- Never apply temporary RLS bypass policies to a production database.
- Test RLS changes on a local or staging database first.
- If debugging requires relaxed policies, use a separate test database.
- Run `npm run lint:rls` before committing any SQL files.

### CI Enforcement

```bash
npm run lint:rls
```

Scans all `.sql` and `.psql` files under `prisma/`, `supabase/`, and `migrations/`. Fails the build if any dangerous pattern is detected.

---

## Privileged Prisma Clients

The project maintains two clients that bypass RLS via `DIRECT_URL` (postgres superuser):

### `authPrisma` (`src/lib/prisma/auth-client.ts`)

**Purpose:** Used by BetterAuth and `getAuthContext()` for authentication infrastructure operations (users, accounts, sessions, verifications).

**Allowed imports:** `src/lib/auth/**` only.

**Reason:** Authentication occurs before any request-specific security context exists. BetterAuth needs to create sessions, verify credentials, and read/write authentication tables without an active `current_user_id()`.

### Super Admin Client (`src/services/super-admin/super-admin-service.ts`)

**Purpose:** Used for cross-tenant administrative operations (creating schools, toggling features, managing subscriptions).

**Allowed imports:** Contained within `src/services/super-admin/` only.

**Reason:** Super Admin operations span all tenants and must not be constrained by RLS.

### Rules for New Privileged Clients

No new privileged Prisma client may be introduced without:

1. A new Architecture Decision Record in `docs/DECISIONS.md`
2. Justification explaining why `withRls()` cannot be used
3. Explicit import restrictions enforced in `scripts/security/check-auth-client-imports.ts`
4. A security integration test verifying the client does not leak data across tenants

### CI Enforcement

```bash
npm run lint:architecture
```

Scans all `.ts` and `.tsx` files for unauthorized imports of `auth-client`. Any import outside `src/lib/auth/` fails the build.

---

## Password Hash Protection

- Password hashes are stored in the `password` field on the `accounts` table.
- Only BetterAuth (via `authPrisma`) may read or write password hashes.
- Application services must use explicit `select` when querying `users` or `accounts`. Never use `select *` or implicit field selection on these tables.
- If a new query on `accounts` is needed, it must use `authPrisma` and be placed in `src/lib/auth/`.

### Audit

```bash
npx tsx scripts/security/check-password-exposure.ts
```

Scans application source code for queries that could expose password hashes. Reports SAFE/AUDIT/DANGER classifications for every query site.

---

## Security Incident Policy

Any confirmed security issue affecting:

- Authentication
- Authorization
- Tenant isolation
- RLS enforcement
- Sensitive data exposure
- Password hash leakage

immediately pauses feature development. Before resuming:

1. Root cause identified and documented
2. Mitigation implemented and verified
3. Automated guardrails added to prevent recurrence (CI check, audit script, import restriction)
4. Regression tests pass (`npm run test:security` and `npm run test`)
5. Post-incident review documented in `KNOWN_ISSUES.md`

---

## CI Security Pipeline

The CI workflow runs these checks in order before the build:

```
npm run lint                  # ESLint
npm run lint:rls              # SQL policy linter
npm run lint:architecture     # Auth client import guard
npx tsc --noEmit              # TypeScript compilation
npm run test:security         # Cross-tenant integration tests
npm run test                  # Full test suite
```

Any failure stops the pipeline immediately.

---

## Multi-Tenant Isolation Verification

- Every RLS-enabled table must have at least one policy that scopes access to the user's school.
- Cross-tenant access tests must verify that:
  - User from School A cannot see School B
  - User from School A cannot see School B's memberships
  - User from School A cannot see School B's students
- These tests run as part of `npm run test:security`.

---

## Related Documents

- `docs/DECISIONS.md` — Architecture Decision Records (especially Decisions 13 and 14)
- `docs/ARCHITECTURE.md` — System architecture overview
- `docs/KNOWN_ISSUES.md` — Known issues and resolutions
- `prisma/rls-policies.sql` — Canonical RLS policy definitions
- `prisma/rls-auth-cleanup.sql` — Auth table policy cleanup script

---

## Quick Reference

| Script                                                | Purpose                                  |
| ----------------------------------------------------- | ---------------------------------------- |
| `npm run lint:rls`                                    | Scan SQL for dangerous RLS patterns      |
| `npm run lint:architecture`                           | Verify authPrisma import restrictions    |
| `npx tsx scripts/security/check-password-exposure.ts` | Audit queries for password hash exposure |
| `npm run test:security`                               | Cross-tenant isolation integration tests |
