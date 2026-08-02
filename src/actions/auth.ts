'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma/client';
import { resolveAuthUser } from '@/lib/auth/resolve-auth-user';
import { headers } from 'next/headers';

const ROLE_REDIRECTS: Record<string, string> = {
  SUPER_ADMIN: '/dashboard',
  SCHOOL_ADMIN: '/dashboard',
  PRINCIPAL: '/dashboard',
  VICE_PRINCIPAL: '/dashboard',
  TEACHER: '/dashboard',
  CLASS_TEACHER: '/dashboard',
  STUDENT: '/dashboard',
  PARENT: '/dashboard',
  ACCOUNTANT: '/dashboard',
  HR: '/dashboard',
  TRANSPORT_MANAGER: '/dashboard',
  DRIVER: '/dashboard',
  LIBRARIAN: '/dashboard',
  NON_TEACHING: '/dashboard',
  CAFETERIA_STAFF: '/dashboard',
};

export async function getAuthRedirect(): Promise<{
  redirect: string;
  error: string | null;
}> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { redirect: '/login', error: null };

  const result = await resolveAuthUser(session.user.id);

  const reasonMap: Record<string, string> = {
    ACCOUNT_NOT_FOUND: 'Account not found',
    ACCOUNT_DISABLED: 'Account disabled',
    NO_ACTIVE_MEMBERSHIP: 'No active school membership',
    SCHOOL_SUSPENDED: 'School suspended',
    SCHOOL_ARCHIVED: 'School archived',
  };

  if (!result.ok) {
    return { redirect: '/login', error: reasonMap[result.reason] };
  }

  return {
    redirect: ROLE_REDIRECTS[result.membership.role] || '/dashboard',
    error: null,
  };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) return { error: 'A user with this email already exists' };

  const ctx = await auth.api.signUpEmail({
    body: { name: data.name, email: data.email, password: data.password },
    headers: await headers(),
  });

  if (!ctx?.token) return { error: 'Registration failed' };
  return {
    success: true,
    message: 'Account created. Check your email to verify.',
  };
}

export async function requestPasswordReset(email: string) {
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  await fetch(`${baseUrl}/api/auth/forget-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return { success: true };
}

export async function resetPassword(data: {
  newPassword: string;
  token: string;
}) {
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword: data.newPassword, token: data.token }),
  });
  if (!res.ok) return { error: 'Invalid or expired reset token' };
  return { success: true };
}
