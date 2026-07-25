# API Reference

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

---

## Routes

| Route                | Type    | Auth   | Purpose                |
| -------------------- | ------- | ------ | ---------------------- |
| `/`                  | Static  | Public | Marketing landing page |
| `/login`             | Static  | Public | Sign in form           |
| `/register`          | Static  | Public | Registration form      |
| `/forgot-password`   | Static  | Public | Password reset request |
| `/api/auth/[...all]` | Dynamic | Public | BetterAuth handler     |

Protected routes (future): `/dashboard/*`, `/select-school`

---

## Server Actions

### `src/actions/auth.ts`

| Action                        | Method | Auth    | Input                       | Output                |
| ----------------------------- | ------ | ------- | --------------------------- | --------------------- |
| `getAuthRedirect()`           | Server | Session | —                           | `{ redirect, error }` |
| `registerUser(data)`          | Server | None    | `{ name, email, password }` | `{ success, error }`  |
| `requestPasswordReset(email)` | Server | None    | `string`                    | `{ success }`         |
| `resetPassword(data)`         | Server | None    | `{ newPassword, token }`    | `{ success, error }`  |

---

## Service Layer

### Auth Service (`src/services/auth/`)

| Function                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `getUserMemberships(userId)`    | Get all active memberships for a user |
| `getActiveSchools(userId)`      | Get schools with ACTIVE memberships   |
| `recordLogin(userId, ip?, ua?)` | Update lastLoginAt + audit log        |

### School Service (`src/services/schools/`)

| Function                                      | Connection            | Purpose                                 |
| --------------------------------------------- | --------------------- | --------------------------------------- |
| `getSchoolById(id, ctx)`                      | withRls(DATABASE_URL) | Get school with settings + subscription |
| `getSchoolBySlug(slug, ctx)`                  | withRls(DATABASE_URL) | Lookup by slug                          |
| `updateSchoolSettings(id, data, userId, ctx)` | withRls(DATABASE_URL) | Update settings + audit log             |

### Membership Service (`src/services/memberships/`)

| Function                                          | Connection            | Purpose                             |
| ------------------------------------------------- | --------------------- | ----------------------------------- |
| `getSchoolMembers(schoolId, ctx)`                 | withRls(DATABASE_URL) | List members                        |
| `getMemberCount(schoolId, ctx)`                   | withRls(DATABASE_URL) | Count members                       |
| `inviteUser(schoolId, email, role, authCtx, ctx)` | withRls(DATABASE_URL) | Create invite + audit log           |
| `acceptInvite(token, userId, ctx)`                | withRls(DATABASE_URL) | Validate invite → create membership |
| `suspendMembership(id, authCtx, ctx)`             | withRls(DATABASE_URL) | Suspend + audit log                 |

### Feature Service (`src/services/features/`)

| Function                                                 | Connection            | Purpose                         |
| -------------------------------------------------------- | --------------------- | ------------------------------- |
| `getEnabledFeatures(schoolId, ctx)`                      | withRls(DATABASE_URL) | Get enabled features for school |
| `isFeatureEnabled(schoolId, key, ctx)`                   | withRls(DATABASE_URL) | Check single feature            |
| `getAllFeatures(ctx)`                                    | withRls(DATABASE_URL) | Full feature catalog            |
| `toggleSchoolFeature(schoolId, featureId, enabled, ctx)` | withRls(DATABASE_URL) | Toggle feature on/off           |

### Super Admin Service (`src/services/super-admin/`)

| Function                                                    | Connection | Purpose                                |
| ----------------------------------------------------------- | ---------- | -------------------------------------- |
| `superCreateSchool(input, actorId)`                         | DIRECT_URL | Create school + settings + audit log   |
| `superUpdateSchoolStatus(id, status, actorId)`              | DIRECT_URL | Suspend/reactivate/archive + audit log |
| `superDeleteSchool(id, actorId)`                            | DIRECT_URL | Delete school + audit log              |
| `superCreateSubscription(input, actorId)`                   | DIRECT_URL | Create subscription + audit log        |
| `superToggleFeature(schoolId, featureId, enabled, actorId)` | DIRECT_URL | Toggle feature + audit log             |
| `superAssignPlan(schoolId, planId, actorId)`                | DIRECT_URL | Assign subscription plan + audit log   |

### User Service (`src/services/users/`)

| Function                      | Connection          | Purpose                     |
| ----------------------------- | ------------------- | --------------------------- |
| `getUsersForSchool(schoolId)` | Direct (no withRls) | List user-membership combos |
| `getUserById(userId)`         | Direct (no withRls) | Get user profile            |

### Audit Service (`src/services/audit/`)

| Function                           | Purpose                       |
| ---------------------------------- | ----------------------------- |
| `getAuditLogs(schoolId, options?)` | Query audit logs with filters |
| `logSchoolEvent(schoolId, input)`  | Create audit log entry        |

---

## Validation Schemas

### Login (`src/lib/validators/auth.ts`)

```typescript
loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(8),
});
```

### Registration (in RegisterForm.tsx)

```typescript
registerSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().min(1).email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword);
```

---

## Error Handling

| Source            | Approach                                          |
| ----------------- | ------------------------------------------------- |
| Server Actions    | Return `{ error: string }` or `{ success: true }` |
| Service Layer     | Throw `AuthorizationError`, general errors        |
| Client Components | `toast.error(message)` via Sonner                 |
| Rate Limiting     | HTTP 429 + Retry-After header                     |
