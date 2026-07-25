import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Create Account — EA System',
  description: 'Create your EA System account',
};

export default function RegisterPage() {
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
            Create Account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started with your EA System workspace.
          </p>
        </div>
        <RegisterForm />
      </AuthCard>
    </div>
  );
}
