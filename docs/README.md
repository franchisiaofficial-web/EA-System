# EA System

**The Operating System for Modern Schools**

A cloud-based, multi-tenant School ERP built for schools of every size.

---

## Overview

EA System centralizes admissions, academics, attendance, finance, transport, communication, HR, examinations, and analytics into one secure SaaS platform.

### Architecture Highlights

- **Multi-Tenant:** One user per school via Membership model (many-to-many)
- **Row-Level Security:** Database-enforced tenant isolation via PostgreSQL RLS
- **Role-Based Access:** 15 roles × 22 resources × 7 actions
- **Secure by Default:** RLS on all tenant tables, rate-limited auth, audit logging

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma 7
- **Auth:** BetterAuth (email/password + Google OAuth)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Testing:** Vitest, Playwright

---

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start dev database
docker compose up -d postgres

# Run migrations
npx prisma migrate dev

# Apply RLS policies
npx prisma db execute --file prisma/rls-policies.sql

# Seed demo data
npx prisma db seed

# Start development server
npm run dev
```

### Test Accounts (after seed)

| Email                | Password    | Role        |
| -------------------- | ----------- | ----------- |
| admin@easystem.dev   | password123 | SUPER_ADMIN |
| teacher@easystem.dev | password123 | TEACHER     |
| student@easystem.dev | password123 | STUDENT     |

---

## Development Workflow

```bash
# Start dev server
npm run dev

# Run tests (requires Docker test DB)
docker compose up -d postgres-test
npx prisma migrate deploy
npx prisma db execute --file prisma/rls-policies.sql
npm test

# Lint
npm run lint

# Build
npm run build

# Database changes
npx prisma migrate dev --name <description>
npx prisma generate
```

---

## Folder Structure

```
easystem/
├── docs/                    # Documentation
├── prisma/                  # Schema, migrations, seed, RLS policies
├── src/
│   ├── actions/             # Server actions
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   ├── lib/                 # Libraries (auth, RBAC, audit, Prisma)
│   ├── services/            # Business logic service layer
│   └── proxy.ts             # Route protection + rate limiting
├── tests/                   # Vitest test suite
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment template
├── .env.test                # Test database URL (gitignored)
├── docker-compose.yml       # Docker services (dev + test DBs)
└── vitest.config.ts         # Test configuration
```

---

## Testing

```bash
# Start test database
docker compose up -d postgres-test

# Run migrations on test DB
$env:DIRECT_URL="postgresql://postgres:testpass@localhost:5433/schoolos_test"
npx prisma migrate deploy
npx prisma db execute --file prisma/rls-policies.sql

# Run test suite
npm test
```

**Test Coverage:** 55 tests (41 RBAC + 14 RLS). All passing.

---

## Documentation

| Document                                    | Purpose                                      |
| ------------------------------------------- | -------------------------------------------- |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current project status and module completion |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)     | Full architecture documentation              |
| [PHASE_STATUS.md](docs/PHASE_STATUS.md)     | Phase-by-phase feature tracking              |
| [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | Security review and audit history            |
| [TEST_REPORT.md](docs/TEST_REPORT.md)       | Test results and CI status                   |
| [CHANGELOG.md](docs/CHANGELOG.md)           | Chronological change history                 |
| [NEXT_TASKS.md](docs/NEXT_TASKS.md)         | Prioritized task backlog                     |
| [DECISIONS.md](docs/DECISIONS.md)           | Architectural decision records               |
| [DATABASE.md](docs/DATABASE.md)             | Schema, RLS, migrations documentation        |
| [AUTHENTICATION.md](docs/AUTHENTICATION.md) | Auth flows and configuration                 |
| [API.md](docs/API.md)                       | API routes and server actions                |
| [FEATURES.md](docs/FEATURES.md)             | Feature catalog and permission matrix        |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)         | Deployment and environment setup             |
| [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)     | Bugs, debt, deferred features                |

---

## Review Workflow

For project reviews, read these five files first:

1. [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)
2. [CHANGELOG.md](docs/CHANGELOG.md)
3. [NEXT_TASKS.md](docs/NEXT_TASKS.md)
4. [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md)
5. [TEST_REPORT.md](docs/TEST_REPORT.md)
