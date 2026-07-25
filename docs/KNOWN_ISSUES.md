# Known Issues

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

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
