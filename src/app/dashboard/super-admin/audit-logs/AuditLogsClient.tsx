"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RefreshCw, Search, X, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle, Info, Clock, Download, FileText, User, Building2, ShieldCheck, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditItem {
  id: string; action: string; entity: string; recordId: string | null; userId: string | null; schoolId: string | null;
  before: any; after: any; createdAt: string; ipAddress: string | null; userAgent: string | null;
}

const ACTION_ICONS: Record<string, any> = { create: FileText, update: RefreshCw, delete: XCircle, archive: XCircle, link: User, unlink: User, sign_in: ShieldCheck, login: ShieldCheck, logout: ShieldCheck };

export function AuditLogsClient({ initialItems, initialTotal, todayCount, loginCount }: { initialItems: AuditItem[]; initialTotal: number; todayCount: number; loginCount: number }) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    if (userId) params.set("userId", userId);
    const res = await fetch(`/api/admin/audit-logs?${params}`);
    const r = await res.json();
    if (r.success) { setItems(r.data.items.map((i: any) => ({ ...i, createdAt: i.createdAt }))); setTotal(r.data.total); }
    setLoading(false);
  }, [search, action, userId]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const openDrawer = (item: AuditItem) => { setSelected(item); setDrawerOpen(true); };
  const inputClass = "h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cli-emerald/50";

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/super-admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
          <div><h1 className="text-xl font-bold text-foreground">Audit Logs</h1><p className="text-xs text-muted-foreground">Platform activity and administrative history</p></div>
        </div>
        <button onClick={() => fetchData(page)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ label: "Today's Events", value: todayCount, icon: Clock, color: "text-cli-blue", bg: "bg-cli-blue/10" }, { label: "Total Events", value: total, icon: FileText, color: "text-cli-emerald", bg: "bg-cli-emerald/10" }, { label: "Logins Today", value: loginCount, icon: ShieldCheck, color: "text-cli-purple", bg: "bg-cli-purple/10" }, { label: "Administrative", value: items.filter(i => ["create", "update", "delete", "archive"].some(a => i.action.includes(a))).length, icon: Building2, color: "text-cli-amber", bg: "bg-cli-amber/10" }].map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1"><div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.bg)}><c.icon className={cn("h-4 w-4", c.color)} /></div></div>
            <p className={cn("text-xl font-bold font-mono", c.color)}>{c.value.toLocaleString()}</p><p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="text" placeholder="Search by action, entity, user..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchData(1))} className={cn(inputClass, "pl-10 w-full")} /></div>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={cn(inputClass, "w-36")}><option value="">All Actions</option><option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option><option value="archive">Archive</option><option value="sign_in">Login</option></select>
        <span className="text-xs font-mono text-muted-foreground ml-auto">{total.toLocaleString()} events</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left">
              <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider">Action</th>
              <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider">Entity</th>
              <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">User</th>
              <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">School</th>
            </tr></thead>
            <tbody>
              {loading && items.length === 0 ? Array.from({ length: 10 }).map((_, i) => (<tr key={i} className="border-b border-border/30 animate-pulse">{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="px-3 py-3"><div className="h-4 bg-muted/30 rounded" /></td>))}</tr>)) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center"><FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No audit events found.</p></td></tr>
              ) : items.map((item) => {
                const Icon = ACTION_ICONS[item.action] || FileText;
                return (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => openDrawer(item)}>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-foreground">{item.action.replace(/_/g, " ")}</span></span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.entity}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{item.userId?.slice(0, 10) || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{item.schoolId?.slice(0, 10) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">Page {page}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={items.length < 50} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Next</button>
          </div>
        </div>
      </div>

      {/* Details Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border-l border-border overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Audit Detail</h3>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-muted/30"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Time", new Date(selected.createdAt).toLocaleString()], ["Action", selected.action.replace(/_/g, " ")], ["Entity", selected.entity], ["Record ID", selected.recordId || "—"], ["User ID", selected.userId || "—"], ["School ID", selected.schoolId || "—"], ["IP Address", selected.ipAddress || "—"], ["User Agent", (selected.userAgent || "—").slice(0, 60)]].map(([k, v]) => (
                  <div key={k as string}><p className="text-xs text-muted-foreground">{k}</p><p className="text-foreground text-xs break-all">{v as string}</p></div>
                ))}
              </div>
              {(selected.before || selected.after) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Changes</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/20 p-3 rounded-lg"><p className="text-muted-foreground mb-1">Before</p><pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(selected.before, null, 2)}</pre></div>
                    <div className="bg-muted/20 p-3 rounded-lg"><p className="text-muted-foreground mb-1">After</p><pre className="font-mono whitespace-pre-wrap break-all">{JSON.stringify(selected.after, null, 2)}</pre></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
