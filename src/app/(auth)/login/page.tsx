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
      <div className="hidden lg:flex lg:w-[48%] bg-gradient-to-br from-muted/40 via-muted/20 to-background border-r border-border/60 items-center justify-center p-16">
        <div className="w-full max-w-lg">
          <Link href="/" className="inline-flex items-center gap-2 mb-12 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cli-blue/10 text-cli-blue font-mono font-bold text-sm group-hover:bg-cli-blue/20 transition-colors">
              ❯
            </span>
            <span className="font-mono text-base font-semibold text-foreground tracking-tight">
              EA System
            </span>
          </Link>

          <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
            Everything your
            <br />
            school needs,
            <br />
            <span className="text-cli-blue">in one place.</span>
          </h1>

          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
            Admissions, academics, attendance, finance, transport — all
            connected through one secure, multi-tenant platform.
          </p>

          <div className="mt-14">
            <AuthIllustration />
          </div>

          <p className="mt-12 text-xs text-muted-foreground/60 font-mono">
            Secure · Multi-Tenant · Real-Time
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:w-[52%] bg-background">
        <AuthCard>
          <div className="mb-8">
            <div className="lg:hidden mb-6">
              <Link href="/" className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cli-blue/10 text-cli-blue font-mono font-bold text-xs">
                  ❯
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  EA System
                </span>
              </Link>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your workspace to continue.
            </p>
          </div>

          <LoginForm />
        </AuthCard>

        <footer className="mt-8 flex items-center gap-3 text-xs text-muted-foreground/60 font-mono">
          <Link
            href="/privacy"
            className="hover:text-muted-foreground transition-colors"
          >
            Privacy
          </Link>
          <span className="text-border">·</span>
          <Link
            href="/terms"
            className="hover:text-muted-foreground transition-colors"
          >
            Terms
          </Link>
          <span className="text-border">·</span>
          <span>EA System v1.0</span>
        </footer>
      </div>
    </div>
  );
}
