"use client";

import { useState } from "react";
import type { AuthContext } from "@/lib/auth/context";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

export function DashboardShell({ children, authCtx }: { children: React.ReactNode; authCtx: AuthContext }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar authCtx={authCtx} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={cn("transition-all duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]")}>
        <Header authCtx={authCtx} onMenuOpen={() => setMobileOpen(true)} />
        <main className="p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
