# Known Issues

- **Last Updated:** 2026-07-26
- **Current Version:** 0.1.0

---

## Resolved Issues

### BetterAuth RLS Violation (Session Creation) — RESOLVED 2026-07-26

**Root Cause:** BetterAuth was configured to use the application Prisma client (`DATABASE_URL` / `app_user`), which is subject to RLS. During sign-in, session creation, and credential verification, no `current_user_id()` is available because authentication occurs before any request context exists. This caused `new row violates row-level security` errors on `sessions`, `accounts`, and `verifications`.

**Temporary Debugging Policies Applied:** Script `fix-rls.ts` added permissive policies to bypass RLS on auth tables:

- `WITH CHECK (true)` on sessions INSERT
- `current_user_id() IS NULL` on sessions DELETE/UPDATE
- `WITH CHECK (true)` on accounts INSERT
- `current_user_id() IS NULL` on accounts UPDATE/DELETE
- `USING (true)` / `WITH CHECK (true)` on verifications (all operations)

**Why They Were Removed:** These policies created unauthenticated access paths on the `app_user` connection. Any connection using `app_user` could bypass RLS on auth tables, weakening the security model.

**Final Architecture (Decision 13):**

- **BetterAuth** → `authPrisma` client (connects via `DIRECT_URL` as postgres superuser, bypasses RLS)
- **`getAuthContext()`** → `authPrisma` for user/membership reads (runs after session validation, before request context is established)
- **Application business queries** → `prisma` client (connects via `DATABASE_URL` as `app_user`, RLS enforced via `withRls()`)
- All temporary debugging policies removed via `fix-rls.ts` cleanup script and `prisma/rls-auth-cleanup.sql`

**Verification Performed:**

- TypeScript compilation: passed (no errors in source files)
- RLS policy audit: all SQL files confirmed free of `USING (true)`, `WITH CHECK (true)`, and `current_user_id() IS NULL` bypasses
- `rls-policies.sql` updated with cleanup DROPs for idempotent deployment

---

## Open Bugs

None currently identified.

---

## Technical Debt

| Issue                         | Severity | Detail                                                            | Resolution |
| ----------------------------- | -------- | ----------------------------------------------------------------- | ---------- |
| In-memory rate limiter        | Medium   | Per-process, lost on restart. Upgrade to Redis for multi-instance | Phase 1    |
| No CSP/HSTS headers           | Medium   | Missing security headers                                          | Phase 1    |
| No "logout everywhere"        | Low      | Single-session logout only                                        | Phase 1    |
| Audit log no retention policy | Low      | Logs grow indefinitely                                            | Phase 2    |
| Permissions table not seeded  | Low      | Empty table, all permissions are code-based                       | Optional   |

---

## Deferred Features

| Feature                    | Reason                                       | Planned Phase  |
| -------------------------- | -------------------------------------------- | -------------- |
| School switching           | Architecture supports it, UI not built       | Phase 1        |
| Email templates (Resend)   | RESEND_API_KEY not configured                | Phase 1        |
| Feature flag management UI | Super Admin dashboard not built              | Phase 1        |
| Invite acceptance UI       | Flow defined, no UI yet                      | Phase 1        |
| Google OAuth               | GOOGLE_CLIENT_SECRET missing                 | Pre-production |
| E2E tests (Playwright)     | Test infrastructure exists, no tests written | Phase 1        |
| API keys for integrations  | Not required until Phase 2                   | Phase 2        |
| Multi-language (i18n)      | Not required for MVP                         | Phase 2        |

---

## Performance Notes

| Item                | Status | Notes                                      |
| ------------------- | ------ | ------------------------------------------ |
| Database connection | ✅     | Pooler (port 6543) for user-facing queries |
| Session cache       | ✅     | 5-min cookie cache (BetterAuth)            |
| RBAC checks         | ✅     | In-memory config lookup, no DB query       |
| RLS overhead        | ✅     | Single JOIN to memberships per query       |
| Rate limiting       | ✅     | In-memory Map, 60s window                  |

---

## Security Notes

| Item                 | Status     | Notes                                                        |
| -------------------- | ---------- | ------------------------------------------------------------ |
| GOOGLE_CLIENT_SECRET | ❌ Missing | OAuth button non-functional                                  |
| RESEND_API_KEY       | ❌ Missing | Email verification uses console.log                          |
| Rate limiting bypass | Low        | x-forwarded-for can be spoofed; acceptable for current scale |

---

## Design System Decisions

### Orphan Colour #8EF24A — RESOLVED 2026-07-26

**Decision:** Option A — Replace every occurrence with existing semantic token `--cli-emerald`.

**Rationale:** `#8EF24A` (lime green, `oklch(0.89 0.18 143)`) appeared 22 times across the `DashboardShell` and all four attendance pages but was not defined as a design token. The EA System specification uses emerald (`#10B981`, `oklch(0.568 0.158 155)`) as the green accent. Replacing the orphan with `cli-emerald` aligns the dashboard with the unified brand palette. The attendance "present" status indicator maps semantically to the success/emerald accent — the slight colour shift from lime to emerald improves readability against light backgrounds while maintaining the functional purpose.

**Verification:** All 22 occurrences replaced with `bg-cli-emerald`, `text-cli-emerald`, `border-cli-emerald`, `fill="var(--cli-emerald)"`, `ring-cli-emerald`. Search for `#8EF24A` returns 0 matches.

### Removed Token — cli-yellow (Restored)

The `--cli-yellow` token was briefly removed from the `@theme inline` mapping and CSS variable definitions during the Sprint 1 palette alignment. It had zero consumers in source code or documentation. The token has been restored with value `oklch(0.71 0.17 95)` (light) / `oklch(0.62 0.15 95)` (dark) to preserve the public styling API contract.
