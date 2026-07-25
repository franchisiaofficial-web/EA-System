import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password — EA System',
  description: 'Reset your EA System password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <AuthCard>
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-foreground mb-6"
          >
            ❯ EA System
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we will send you a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
      </AuthCard>
    </div>
  );
}
