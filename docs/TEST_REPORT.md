# Test Report

- **Last Updated:** 2026-07-25
- **Current Version:** 0.3.1

---

## Test Suite Status

| Category                                   | Tests   | Passed  | Failed | Skipped |
| ------------------------------------------ | ------- | ------- | ------ | ------- |
| RBAC — Role Definitions                    | 16      | 16      | 0      | 0       |
| RBAC — Permission Checks                   | 23      | 23      | 0      | 0       |
| RBAC — getRolePermissions                  | 2       | 2       | 0      | 0       |
| RLS — Multi-Tenant Isolation               | 9       | 9       | 0      | 0       |
| RLS — Helper Functions                     | 3       | 3       | 0      | 0       |
| RLS — Infrastructure                       | 2       | 2       | 0      | 0       |
| Academic — RLS                             | 8       | 8       | 0      | 0       |
| Academic — has_class_assignment()          | 2       | 2       | 0      | 0       |
| Academic — Partial Unique Indexes          | 4       | 4       | 0      | 0       |
| Academic — RBAC                            | 5       | 5       | 0      | 0       |
| Academic Service — transferStudent         | 2       | 2       | 0      | 0       |
| Attendance — calculateAttendancePercentage | 5       | 5       | 0      | 0       |
| Attendance — RLS                           | 6       | 6       | 0      | 0       |
| Attendance — Partial Unique Index          | 1       | 1       | 0      | 0       |
| Attendance — RBAC                          | 5       | 5       | 0      | 0       |
| Attendance Service — markAttendance        | 5       | 5       | 0      | 0       |
| Attendance Service — bulkMarkAttendance    | 1       | 1       | 0      | 0       |
| Attendance Service — WITHDRAWN             | 2       | 2       | 0      | 0       |
| Attendance Service — TRANSFERRED           | 2       | 2       | 0      | 0       |
| Attendance Service — calculatePercentage   | 2       | 2       | 0      | 0       |
| **Total**                                  | **105** | **105** | **0**  | **0**   |

---

## Build Verification

| Check                       | Status                  |
| --------------------------- | ----------------------- |
| `npm run lint`              | ✅ 0 errors, 0 warnings |
| `npx tsc --noEmit`          | ✅ Passes               |
| `npm run build`             | ✅ Passes               |
| `npx prisma generate`       | ✅ Passes               |
| `npx prisma migrate deploy` | ✅ Passes               |
| `npx prisma db seed`        | ✅ All records created  |

---

## CI Status

| Step                        | Status |
| --------------------------- | ------ |
| `npm ci`                    | ✅     |
| `npm run lint`              | ✅     |
| `npx tsc --noEmit`          | ✅     |
| `npx prisma generate`       | ✅     |
| `npx prisma migrate deploy` | ✅     |
| `npx prisma db seed`        | ✅     |
| `npm run build`             | ✅     |
| `npm run test`              | ✅     |

---

## Test Infrastructure

| Component     | Detail                                                     |
| ------------- | ---------------------------------------------------------- |
| Framework     | Vitest 4.x                                                 |
| Test Database | Docker postgres:16-alpine (port 5433)                      |
| Connection    | `TEST_DATABASE_URL` env var only                           |
| Isolation     | No fallback to DATABASE_URL or DIRECT_URL                  |
| CI Database   | GitHub Actions postgres service container                  |
| Teardown      | `afterAll` deletes all test data                           |
| Negative Test | Without `TEST_DATABASE_URL`, RLS suite rejects immediately |

---

## RLS Enforcement (Manual Verification)

Performed 2026-07-25 against `app_user` connection.

| Test Category                         | Tests  | Result         |
| ------------------------------------- | ------ | -------------- |
| Cross-Tenant Isolation                | 5      | All passed     |
| Membership Status (SUSPENDED/REMOVED) | 3      | All passed     |
| Forged Session Context                | 4      | All passed     |
| Helper Functions                      | 3      | All passed     |
| Membership & User Visibility          | 4      | All passed     |
| Super Admin                           | 2      | All passed     |
| PgBouncer (port 6543)                 | 5      | All passed     |
| **Total Manual**                      | **26** | **All passed** |

---

## Test Execution

```bash
# Start test database
docker compose up -d postgres-test

# Run migrations + RLS
$env:DIRECT_URL="postgresql://postgres:testpass@localhost:5433/schoolos_test"
npx prisma migrate deploy
npx prisma db execute --file prisma/rls-policies.sql

# Run tests
npm test
```

Last run: **105 passed, 6 test files** on Docker test database.
