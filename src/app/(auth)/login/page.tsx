import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';

export const metadata: Metadata = {
  title: 'Sign In — EA System',
  description: 'Sign in to your EA System workspace',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[45%] bg-muted/30 border-r border-border items-center justify-center p-12">
        <AuthIllustration />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 lg:w-[55%]">
        <AuthCard>
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-mono text-lg font-bold text-foreground mb-6"
            >
              ❯ EA System
            </Link>

            <h1 className="mt-6 text-2xl font-bold tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to continue to your EA System workspace.
            </p>
          </div>

          <LoginForm />
        </AuthCard>

        <footer className="mt-8 flex items-center gap-4 text-xs text-muted-foreground font-mono">
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </Link>
          <span>·</span>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </Link>
          <span>·</span>
          <span>EA System v1.0</span>
        </footer>
      </div>
    </div>
  );
}
