# Database

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

---

## Schema Overview

17 models, 5 enums, 14 RLS-protected tables.

### Enums

| Enum               | Values                                                                                                                                                                             | Used In                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Role               | SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, VICE_PRINCIPAL, HR, ACCOUNTANT, TEACHER, CLASS_TEACHER, NON_TEACHING, LIBRARIAN, TRANSPORT_MANAGER, DRIVER, CAFETERIA_STAFF, STUDENT, PARENT | Membership, Invite, Permission |
| MembershipStatus   | ACTIVE, SUSPENDED, REMOVED                                                                                                                                                         | Membership                     |
| SchoolStatus       | ACTIVE, SUSPENDED, ARCHIVED                                                                                                                                                        | School                         |
| SubscriptionStatus | TRIALING, ACTIVE, PAST_DUE, CANCELED                                                                                                                                               | Subscription                   |
| InviteStatus       | PENDING, ACCEPTED, EXPIRED, REVOKED                                                                                                                                                | Invite                         |

### Core Tenant Models

| Model      | Table       | RLS | Purpose                       |
| ---------- | ----------- | --- | ----------------------------- |
| School     | schools     | ✅  | Tenant entity                 |
| User       | users       | ✅  | Platform-wide identity        |
| Membership | memberships | ✅  | Join: User ↔ School with Role |

### BetterAuth Models

| Model        | Table         | RLS | Purpose                   |
| ------------ | ------------- | --- | ------------------------- |
| Session      | sessions      | ✅  | Authentication sessions   |
| Account      | accounts      | ✅  | OAuth/credential accounts |
| Verification | verifications | ✅  | Email/token verification  |

### Foundation Models

| Model          | Table           | RLS | Purpose                       |
| -------------- | --------------- | --- | ----------------------------- |
| SchoolSettings | school_settings | ✅  | Per-school configuration      |
| Plan           | plans           | ✅  | Subscription tier definitions |
| Subscription   | subscriptions   | ✅  | School-plan assignment        |
| Feature        | features        | ✅  | Platform feature catalog      |
| SchoolFeature  | school_features | ✅  | Per-school feature toggle     |
| Invite         | invites         | ✅  | School invitation tokens      |
| AuditLog       | audit_logs      | ✅  | Immutable audit trail         |
| Permission     | permissions     | ✅  | Optional custom permissions   |

---

## Relationships

```
School 1──< Membership >──1 User
School 1──< SchoolSettings
School 1──< Subscription >──1 Plan
School 1──< SchoolFeature >──1 Feature
School 1──< Invite >──1 User (invitedBy)
School 1──< AuditLog

User 1──< Session
User 1──< Account
User 1──< Membership
User 1──< AuditLog
```

---

## RLS Policies

### Helper Functions

```sql
current_user_id() → text
-- Reads app.current_user_id session variable

has_active_membership(school_id) → boolean
-- Checks ACTIVE membership for current_user_id in given school
-- SECURITY DEFINER (runs as postgres, bypasses RLS)
```

### Policy Matrix

| Table           | SELECT                           | INSERT      | UPDATE                   | DELETE |
| --------------- | -------------------------------- | ----------- | ------------------------ | ------ |
| schools         | has_active_membership(id)        | —           | —                        | —      |
| memberships     | has_active_membership(school_id) | —           | —                        | —      |
| school_settings | has_active_membership            | —           | SCHOOL_ADMIN/SUPER_ADMIN | —      |
| features        | via school_features              | —           | —                        | —      |
| school_features | has_active_membership            | —           | —                        | —      |
| subscriptions   | has_active_membership            | —           | —                        | —      |
| plans           | authenticated                    | —           | —                        | —      |
| invites         | admins only                      | admins only | —                        | —      |
| audit_logs      | admins only                      | —           | —                        | —      |
| users           | own row / shared school          | —           | own row                  | —      |
| sessions        | own sessions                     | —           | —                        | —      |
| accounts        | own accounts                     | —           | —                        | —      |
| verifications   | —                                | —           | —                        | —      |
| permissions     | authenticated                    | —           | —                        | —      |

---

## Key Indexes

| Table           | Index                    | Type   |
| --------------- | ------------------------ | ------ |
| schools         | slug                     | UNIQUE |
| schools         | status                   | BTREE  |
| users           | email                    | UNIQUE |
| memberships     | schoolId, userId, status | BTREE  |
| memberships     | (schoolId, userId, role) | UNIQUE |
| sessions        | token                    | UNIQUE |
| accounts        | (accountId, providerId)  | UNIQUE |
| features        | key                      | UNIQUE |
| school_features | (schoolId, featureId)    | UNIQUE |
| invites         | token                    | UNIQUE |
| audit_logs      | (entity, recordId)       | BTREE  |

---

## Cascade Behavior

| Relationship            | On Delete |
| ----------------------- | --------- |
| School → Membership     | CASCADE   |
| School → SchoolSettings | CASCADE   |
| School → Subscription   | CASCADE   |
| School → SchoolFeature  | CASCADE   |
| School → Invite         | CASCADE   |
| School → AuditLog       | SET NULL  |
| User → Membership       | CASCADE   |
| User → Session          | CASCADE   |
| User → Account          | CASCADE   |
| User → AuditLog         | SET NULL  |
| Feature → SchoolFeature | CASCADE   |
| Plan → Subscription     | RESTRICT  |

---

## Test Database

| Property | Value                        |
| -------- | ---------------------------- |
| Image    | postgres:16-alpine           |
| Port     | 5433                         |
| Database | schoolos_test                |
| Username | postgres                     |
| Password | testpass                     |
| RLS      | Applied via rls-policies.sql |
| app_user | Created with NOBYPASSRLS     |

---

## Migration Strategy

1. Schema changes in `prisma/schema.prisma`
2. `npx prisma migrate dev --name <description>` (dev)
3. `npx prisma migrate deploy` (CI/test/production)
4. Re-apply `prisma/rls-policies.sql` if functions change
5. Re-run `prisma/db seed` on dev

---

## Seed Strategy

- `prisma/seed.ts` creates demo data: 1 school, 3 users, 3 plans, 12 features
- All upserts (idempotent, safe to re-run)
- Test accounts: admin/teacher/student@easystem.dev, password123
- Seed uses DIRECT_URL (superuser connection, no RLS)
