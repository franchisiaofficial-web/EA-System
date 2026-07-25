# Next Tasks

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

---

## Critical

| Task                               | Priority | Est. Time | Dependencies         | Status      |
| ---------------------------------- | -------- | --------- | -------------------- | ----------- |
| Configure GOOGLE_CLIENT_SECRET     | High     | 15 min    | Google Cloud Console | Not Started |
| Configure RESEND_API_KEY           | High     | 15 min    | Resend account       | Not Started |
| Wire Resend email sending callback | High     | 1 hour    | RESEND_API_KEY       | Not Started |

---

## High — Phase 1 Start

| Task                                     | Priority | Est. Time | Dependencies    | Status      |
| ---------------------------------------- | -------- | --------- | --------------- | ----------- |
| Student Management CRUD                  | Critical | 2 days    | Phase 0         | Not Started |
| Teacher Management CRUD                  | Critical | 2 days    | Phase 0         | Not Started |
| Classes & Sections                       | Critical | 2 days    | Student/Teacher | Not Started |
| Attendance Module                        | Critical | 3 days    | Classes         | Not Started |
| Role-specific dashboards (11 roles)      | High     | 5 days    | Phase 0         | Not Started |
| School switching UI                      | High     | 2 days    | Phase 0         | Not Started |
| School selector page                     | High     | 1 day     | Phase 0         | Not Started |
| Feature flag management UI (Super Admin) | Medium   | 1 day     | Phase 0         | Not Started |

---

## Medium

| Task                              | Priority | Est. Time | Dependencies   | Status      |
| --------------------------------- | -------- | --------- | -------------- | ----------- |
| Upgrade rate limiter to Redis     | Medium   | 1 day     | Redis instance | Not Started |
| Add CSP headers                   | Medium   | 2 hours   | None           | Not Started |
| Audit log retention strategy      | Medium   | 2 hours   | None           | Not Started |
| Seed permissions table            | Medium   | 1 hour    | None           | Not Started |
| Invite acceptance flow UI         | Medium   | 1 day     | Phase 0        | Not Started |
| "Logout everywhere" functionality | Medium   | 2 hours   | Phase 0        | Not Started |

---

## Low

| Task                              | Priority | Est. Time | Dependencies   | Status      |
| --------------------------------- | -------- | --------- | -------------- | ----------- |
| Subscription enforcement          | Low      | 1 day     | Phase 1        | Not Started |
| Email notification templates      | Low      | 1 day     | RESEND_API_KEY | Not Started |
| Loading states & error boundaries | Low      | 2 days    | Phase 1        | Not Started |
| Accessibility audit               | Low      | 1 day     | Phase 1        | Not Started |
| E2E tests (Playwright)            | Low      | 3 days    | Phase 1        | Not Started |

---

## Future

| Task                          | Priority | Est. Time | Dependencies | Status      |
| ----------------------------- | -------- | --------- | ------------ | ----------- |
| Mobile PWA                    | Future   | 2 weeks   | Phase 2      | Not Started |
| API keys for integrations     | Future   | 1 week    | Phase 2      | Not Started |
| Multi-language support (i18n) | Future   | 2 weeks   | Phase 2      | Not Started |
| On-premise deployment option  | Future   | 1 week    | Phase 3      | Not Started |
