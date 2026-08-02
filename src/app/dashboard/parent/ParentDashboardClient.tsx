"use client";

import { Users, CheckSquare, CreditCard, FileText } from "lucide-react";

export function ParentDashboardClient({ parentName }: { parentName: string }) {
  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-4xl mx-auto">
      <div><h1 className="text-xl font-bold text-foreground">Welcome, {parentName}</h1><p className="text-xs text-muted-foreground">Parent Portal</p></div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a href="/dashboard/parent/attendance" className="rounded-xl border border-border bg-card p-6 hover:shadow-sm transition-shadow">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cli-emerald/10 mb-3"><CheckSquare className="h-5 w-5 text-cli-emerald" /></div>
          <h3 className="font-semibold text-foreground">Attendance</h3>
          <p className="text-xs text-muted-foreground mt-1">View your children's attendance records</p>
        </a>
        <div className="rounded-xl border border-border bg-card p-6 opacity-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cli-blue/10 mb-3"><CreditCard className="h-5 w-5 text-cli-blue" /></div>
          <h3 className="font-semibold text-foreground">Fees</h3>
          <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 opacity-50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cli-cyan/10 mb-3"><FileText className="h-5 w-5 text-cli-cyan" /></div>
          <h3 className="font-semibold text-foreground">Exam Results</h3>
          <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
