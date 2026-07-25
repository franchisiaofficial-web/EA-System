# Authentication

- **Last Updated:** 2026-07-25
- **Current Version:** 0.1.0

---

## Provider

BetterAuth v1.6 with Prisma adapter for PostgreSQL.

## Configuration

```typescript
// src/lib/auth/index.ts
betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: { google: { clientId, clientSecret } },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  trustedOrigins: [BETTER_AUTH_URL],
});
```

## Methods

| Method                 | Status      | Notes                                 |
| ---------------------- | ----------- | ------------------------------------- |
| Email/Password Sign In | ✅ Complete | LoginForm → authClient.signIn.email() |
| Email/Password Sign Up | ✅ Complete | RegisterForm → auth.api.signUpEmail() |
| Sign Out               | ✅ Complete | LogoutButton → authClient.signOut()   |
| Google OAuth           | ⚠️ Partial  | Client ID set, secret missing         |
| Password Reset         | ✅ Complete | /forgot-password flow via fetch       |
| Email Verification     | ✅ Enabled  | Console-only callback (dev)           |

---

## Session

| Property      | Value                                          |
| ------------- | ---------------------------------------------- |
| Storage       | sessions table (Prisma)                        |
| Cookie name   | better-auth.session_token                      |
| Secure cookie | __Secure-better-auth.session_token             |
| Cookie cache  | 5 minutes                                      |
| Fields        | token, userId, expiresAt, ipAddress, userAgent |

---

## Login Flow

```
1. User submits email/password on /login
2. authClient.signIn.email() → POST /api/auth/sign-in/email
3. BetterAuth validates credentials (bcrypt)
4. Session record created in sessions table
5. Session cookie set
6. getAuthRedirect() server action:
   a. Read session via auth.api.getSession()
   b. Find user with active memberships
   c. Check school status (ACTIVE/SUSPENDED/ARCHIVED)
   d. Return role-based redirect URL
7. Success modal → redirect to dashboard
```

## Registration Flow

```
1. User submits name/email/password on /register
2. Server action registerUser():
   a. Check email uniqueness
   b. auth.api.signUpEmail() creates user
   c. Email verification sent (console.log in dev)
3. Success page → "Check your email"
```

## Password Reset Flow

```
1. User submits email on /forgot-password
2. Server action posts to /api/auth/forget-password
3. BetterAuth generates reset token → verification table
4. Email sent (console.log in dev)
5. User visits reset link → submits new password
6. Server action posts to /api/auth/reset-password
7. Password updated → redirect to login
```

## Logout

```
LogoutButton → authClient.signOut()
  → Session deleted from database
  → Cookie cleared
  → Redirect to /login
```

## Role Assignment

Roles are NOT on the User model. They are on Membership.

```
User → Membership → Role
       Membership → School

After login:
1. Session provides userId
2. Query memberships WHERE userId = session.userId AND status = 'ACTIVE'
3. Pick first active membership (or redirect to school selector)
4. Role = membership.role
```

## School Switching (Phase 1)

Currently deferred. Logic placeholder: uses `memberships[0]`.

Phase 1 implementation:

1. School selector UI
2. Cookie/session for activeSchoolId
3. `selectSchool(schoolId)` server action validates membership
4. `getAuthRedirect()` respects activeSchoolId
