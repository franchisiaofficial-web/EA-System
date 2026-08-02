"use client";

import { CreditCard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeesClient({ invoices, structures }: { invoices: any; structures: any[] }) {
  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto">
      <div><h1 className="text-xl font-bold text-foreground">Fee Management</h1><p className="text-xs text-muted-foreground">Manage fees, invoices, and payments</p></div>

      {/* Fee Structures */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Fee Structures</h2>
        {structures.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No fee structures defined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Category</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Class</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Amount</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Frequency</th></tr></thead>
              <tbody>{structures.map((s: any) => (<tr key={s.id} className="border-b border-border/30"><td className="py-2 text-foreground">{s.category?.name || "—"}</td><td className="py-2 text-muted-foreground">{s.class?.name || "All"}</td><td className="py-2 font-mono text-foreground">₹{s.amount.toLocaleString()}</td><td className="py-2 text-muted-foreground text-xs">{s.frequency}</td></tr>))}</tbody></table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Recent Invoices</h2>
        {invoices.items?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Invoice #</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Student</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Amount</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Status</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Due Date</th></tr></thead>
              <tbody>{invoices.items?.map((inv: any) => (<tr key={inv.id} className="border-b border-border/30"><td className="py-2 font-mono text-xs text-foreground">{inv.invoiceNo}</td><td className="py-2 text-foreground">{inv.student?.firstName} {inv.student?.lastName}</td><td className="py-2 font-mono text-foreground">₹{inv.totalAmount.toLocaleString()}</td><td className="py-2"><span className={cn("px-2 py-0.5 rounded-md text-xs font-mono", inv.status === "PAID" ? "bg-cli-emerald/10 text-cli-emerald" : inv.status === "PARTIAL" ? "bg-muted/60 text-muted-foreground" : inv.status === "OVERDUE" ? "bg-muted/60 text-muted-foreground" : "bg-muted/30 text-muted-foreground")}>{inv.status}</span></td><td className="py-2 text-xs text-muted-foreground">{new Date(inv.dueDate).toLocaleDateString()}</td></tr>))}</tbody></table>
          </div>
        )}
      </div>
    </div>
  );
}
