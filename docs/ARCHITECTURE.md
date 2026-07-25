# Architecture

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0
- **Status:** FROZEN

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)                │
│                                                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  proxy  │  │  Pages   │  │  Actions │  │   API    │ │
│  │  (auth) │  │  (SSR)   │  │ (server) │  │ (Better  │ │
│  │         │  │          │  │          │  │  Auth)   │ │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │            │             │              │        │
│       └────────────┴──────┬──────┴──────────────┘        │
│                           │                              │
│                    Service Layer                          │
│              (auth, schools, memberships,                 │
│              features, super-admin, audit)                │
│                           │                              │
│                ┌──────────┴──────────┐                    │
│                │                     │                    │
│         withRls(ctx)          superAdmin                 │
│         DATABASE_URL          DIRECT_URL                  │
│         (app_user)            (postgres)                  │
│         RLS ENFORCED          RLS BYPASSED                │
│                │                     │                    │
└────────────────┼─────────────────────┼────────────────────┘
                 │                     │
                 ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL (Supabase)                        │
│                                                          │
│  ┌────────────────────────┐  ┌─────────────────────────┐ │
│  │    app_user role       │  │    postgres role        │ │
│  │    • No BYPASSRLS      │  │    • BYPASSRLS          │ │
│  │    • RLS enforced      │  │    • Table owner         │ │
│  │    • User-facing       │  │    • Migrations/Seed     │ │
│  └────────────────────────┘  └─────────────────────────┘ │
│                                                          │
│  RLS Policies (17)            Helper Functions            │
│  • schools (1)                • current_user_id()        │
│  • memberships (1)            • has_active_membership()  │
│  • users (3)                                              │
│  • school_settings (2)                                    │
│  • features/school_features (2)                           │
│  • subscriptions/plans (2)                                │
│  • invites (2)                                            │
│  • audit_logs (1)                                         │
│  • sessions/accounts (2)                                  │
│  • permissions (1)                                        │
└──────────────────────────────────────────────────────────┘
```

---

## Request Flow

```
1. User Request → Next.js proxy (route protection)
2. Service Layer → getAuthContext() (session → membership → role)
3. User-Facing Query → withRls(ctx, fn)
   a. $transaction begins
   b. SET LOCAL app.current_user_id = '{userId}'
   c. SET LOCAL app.current_school_id = '{schoolId}'
   d. SET LOCAL app.current_membership_id = '{membershipId}'
   e. SET LOCAL app.current_role = '{role}'
   f. Query executes → RLS checks has_active_membership()
   g. Transaction commits, SET LOCAL cleared
4. Super Admin Query → superAdmin.$transaction()
   a. Connects as postgres (DIRECT_URL)
   b. No SET LOCAL needed
   c. RLS bypassed (BYPASSRLS)
   d. Audit log written
```

---

## Connection Architecture

| Connection  | Env Var        | User       | BYPASSRLS | RLS      | Used For                           |
| ----------- | -------------- | ---------- | --------- | -------- | ---------------------------------- |
| User-facing | `DATABASE_URL` | `app_user` | No        | Enforced | All user queries via `withRls()`   |
| Superuser   | `DIRECT_URL`   | `postgres` | Yes       | Bypassed | Migrations, seeds, Super Admin ops |

### DATABASE_URL

```
postgresql://app_user.phlxckdqskpkxlwrrtxe:{pw}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

- Pooler (port 6543, transaction mode)
- `app_user` role (no BYPASSRLS)
- RLS enforced at database level
- `SET LOCAL` confirmed working under transaction pooling

### DIRECT_URL

```
postgresql://postgres.phlxckdqskpkxlwrrtxe:{pw}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

- Direct connection (port 5432)
- `postgres` role (BYPASSRLS)
- Used only for: `prisma migrate`, `prisma db seed`, `superAdmin` service
- Never used by user-facing code

---

## Multi-Tenancy

```
User ──< Membership >── School
         (role, status)

One user can have multiple memberships across multiple schools.
Membership stores: schoolId, userId, role, status
Status: ACTIVE | SUSPENDED | REMOVED

Tenant isolation:
1. RLS: has_active_membership(school_id) checks current_user_id()
2. Service layer: requireActiveMembership(userId, schoolId)
3. RBAC: hasPermission(role, resource, action)
```

---

## RBAC

```
Permissions defined in src/lib/permissions/permissions.ts
Config-driven: ROLE_PERMISSIONS[role][resource][action]

15 roles × 22 resources × 7 actions

Checks:
  hasPermission(role, resource, action) → boolean
  getRolePermissions(role) → Array<{resource, actions}>

Guards (src/lib/permissions/guards.ts):
  requireAuth() → AuthContext
  requirePermission(ctx, resource, action) → throws
  requireActiveMembership(userId, schoolId) → membership
```

---

## Directory Structure

```
src/
├── actions/          Server actions (auth, registration, password reset)
├── app/              Next.js App Router pages
│   ├── (auth)/       Login, register, forgot-password
│   ├── (marketing)/  Landing page
│   └── api/auth/     BetterAuth handler
├── components/       UI components (auth, landing, ui)
├── features/         Feature modules (Phase 1+)
├── hooks/            Custom React hooks
├── lib/
│   ├── auth/         BetterAuth config + context
│   ├── audit/        Audit logging utility
│   ├── config/       Environment validation
│   ├── permissions/  RBAC system
│   ├── prisma/       Prisma client + RLS middleware
│   └── validators/   Zod schemas
├── middleware/        (deprecated → proxy.ts)
├── services/         Business logic layer
│   ├── auth/
│   ├── audit/
│   ├── features/
│   ├── memberships/
│   ├── schools/
│   ├── super-admin/
│   └── users/
├── proxy.ts          Route protection + rate limiting
└── types/            TypeScript types
prisma/
├── schema.prisma     17 models, 5 enums
├── seed.ts           Demo data
├── rls-policies.sql  17 RLS policies
└── migrations/       Database migrations
tests/
├── rbac.test.ts      41 tests
├── rls.test.ts       14 tests
└── vitest-setup.ts   Test env loader
docs/                 Documentation (this directory)
```

---

## Key Decisions

| Decision                                 | Rationale                                       |
| ---------------------------------------- | ----------------------------------------------- |
| BetterAuth over Supabase Auth            | Multi-provider support, Prisma adapter          |
| Prisma over raw SQL                      | Type safety, migrations, seed support           |
| `app_user` role for RLS                  | Enables database-level tenant isolation         |
| SET LOCAL over JWT                       | Prisma connects directly, no JWT                |
| Membership over User.schoolId            | Multi-school users, role per school             |
| Feature + SchoolFeature over FeatureFlag | Normalized catalog vs loose strings             |
| Service layer pattern                    | Business logic isolated from UI                 |
| Audit logging in transactions            | Atomic: operation + audit succeed/fail together |
