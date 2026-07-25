# Deployment

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

---

## Environment Variables

| Variable               | Required  | Purpose                                                  | Server-Only |
| ---------------------- | --------- | -------------------------------------------------------- | ----------- |
| `DATABASE_URL`         | Yes       | app_user pooler connection (RLS enforced)                | Yes         |
| `DIRECT_URL`           | Yes       | postgres direct connection (migrations/seed/Super Admin) | Yes         |
| `BETTER_AUTH_SECRET`   | Yes       | Session token signing key                                | Yes         |
| `BETTER_AUTH_URL`      | Yes       | BetterAuth base URL                                      | No          |
| `NEXT_PUBLIC_APP_URL`  | No        | Public app URL for client auth                           | No          |
| `GOOGLE_CLIENT_ID`     | No        | Google OAuth client ID                                   | No          |
| `GOOGLE_CLIENT_SECRET` | No        | Google OAuth client secret                               | Yes         |
| `RESEND_API_KEY`       | No        | Resend API key for emails                                | Yes         |
| `TEST_DATABASE_URL`    | Test only | Isolated test database                                   | Yes         |

---

## Docker

### Development

```
docker compose up -d postgres    # Dev database (port 5432)
docker compose up -d postgres-test  # Test database (port 5433)
docker compose up -d app         # Application (port 3000)
```

### Production Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Supabase Setup

### 1. Create Project

Create a Supabase project and note the project reference.

### 2. Connection Strings

```
# Pooler (user-facing, RLS enforced)
DATABASE_URL=postgresql://app_user.[ref]:[pw]@[pooler-host]:6543/postgres?pgbouncer=true

# Direct (migrations/seed/Super Admin)
DIRECT_URL=postgresql://postgres.[ref]:[pw]@[pooler-host]:5432/postgres
```

### 3. Create app_user Role

```sql
CREATE ROLE app_user LOGIN PASSWORD 'strong-password';
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
```

### 4. Apply RLS Policies

```bash
npx prisma db execute --file prisma/rls-policies.sql
```

### 5. Run Migrations & Seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

---

## GitHub Actions CI

### Required Secrets

| Secret              | Purpose                                |
| ------------------- | -------------------------------------- |
| `TEST_DATABASE_URL` | Connection string for CI test database |

### Workflow Steps

1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npx prisma generate`
5. `npx prisma migrate deploy`
6. `npx prisma db seed`
7. `npm run build`
8. `npm run test`

---

## Production Checklist

- [ ] Set `GOOGLE_CLIENT_SECRET` in `.env`
- [ ] Set `RESEND_API_KEY` in `.env`
- [ ] Configure `sendVerificationEmail` callback with Resend
- [ ] Add CSP/HSTS security headers
- [ ] Set `NODE_ENV=production`
- [ ] Rotate ALL secrets before production deploy
- [ ] Verify RLS policies are applied
- [ ] Verify `app_user` role exists with NOBYPASSRLS
- [ ] Confirm DATABASE_URL uses pooler
- [ ] Confirm DIRECT_URL uses direct connection
- [ ] Run full test suite
- [ ] Verify CI pipeline passes
- [ ] Set up monitoring/alerting
- [ ] Configure backup strategy for database

---

## Rollback Plan

1. Revert to previous migration: `npx prisma migrate reset --force`
2. Restore database from backup
3. Re-deploy previous commit
4. Re-run seed if needed
