import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign In — EA System", description: "Sign in to your EA System workspace" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-[48%] bg-gradient-to-br from-muted/30 via-background to-muted/20 border-r border-border items-center justify-center p-16">
        <div className="w-full max-w-lg">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-12 group">
            <Image src="/logo.png" alt="EA System" width={40} height={40} className="rounded-lg shadow-sm" />
            <span className="font-mono text-lg font-semibold text-foreground tracking-tight">EA System</span>
          </Link>

          <h1 className="text-4xl font-bold tracking-tight text-foreground leading-tight">
            Everything your school needs,
            <br />
            <span className="text-ea-green">in one place.</span>
          </h1>

          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
            Admissions, academics, attendance, finance, transport — all connected through one secure, multi-tenant platform.
          </p>

          <div className="mt-14 grid grid-cols-2 gap-3">
            {["Admissions", "Academics", "Attendance", "Finance", "Transport", "Examinations"].map(m => (
              <div key={m} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card border border-border">
                <div className="h-2 w-2 rounded-full bg-ea-green" />
                <span className="text-sm text-foreground/80 font-medium">{m}</span>
              </div>
            ))}
          </div>

          <p className="mt-12 text-xs text-muted-foreground font-mono">Secure · Multi-Tenant · Real-Time</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:w-[52%] bg-background">
        <div className="lg:hidden mb-6 w-full max-w-[420px]">
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/logo.png" alt="EA System" width={28} height={28} className="rounded" />
            <span className="font-mono text-sm font-semibold text-foreground">EA System</span>
          </Link>
        </div>

        <div className="w-full max-w-[420px]">
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your workspace to continue.</p>
        </div>

        <AuthCard>
          <LoginForm />
        </AuthCard>

        <footer className="mt-8 flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="text-border">·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span className="text-border">·</span>
          <span>EA System v1.0</span>
        </footer>
      </div>
    </div>
  );
}
