'use client';

import { useState } from 'react';
import type { AuthContext } from '@/lib/auth/context';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function DashboardShell({
  children,
  authCtx,
}: {
  children: React.ReactNode;
  authCtx: AuthContext;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B]">
      <Sidebar
        authCtx={authCtx}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:pl-60">
        <Header authCtx={authCtx} onMenuOpen={() => setMobileOpen(true)} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
