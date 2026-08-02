"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle, Info, XCircle, RefreshCw, Search, Download, ChevronDown, ChevronUp, ArrowLeft, X, Copy, CheckCircle2, Clock, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const SEV: Record<string, { icon: any; color: string; bg: string }> = {
  INFO: { icon: Info, color: "text-cli-blue", bg: "bg-cli-blue/10" },
  WARNING: { icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted/60" },
  ERROR: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-foreground/10" },
  CRITICAL: { icon: XCircle, color: "text-foreground", bg: "bg-muted/60" },
};
const ST: Record<string, { color: string; bg: string }> = {
  OPEN: { color: "text-muted-foreground", bg: "bg-foreground/10" },
  INVESTIGATING: { color: "text-muted-foreground", bg: "bg-muted/60" },
  RETRYING: { color: "text-cli-blue", bg: "bg-cli-blue/10" },
  RESOLVED: { color: "text-cli-emerald", bg: "bg-cli-emerald/10" },
  IGNORED: { color: "text-muted-foreground", bg: "bg-muted/20" },
};

type ErrorItem = { id: string; severity: string; status: string; service: string; module: string; category: string; message: string; errorCode: string | null; occurrenceCount: number; schoolId: string | null; tenantId: string | null; correlationId: string | null; metadata: any; firstOccurredAt: string; lastOccurredAt: string; resolvedAt: string | null; createdAt: string };

interface ErrorLogsData { items: ErrorItem[]; total: number; page: number; pageSize: number; totalPages: number; }

export function ErrorLogsClient({ initialData }: { initialData: ErrorLogsData }) {
  const router = useRouter();
  const sp = useSearchParams();

  const [data, setData] = useState<ErrorLogsData>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(sp.get("search") || "");
  const [severity, setSeverity] = useState(sp.get("severity") || "");
  const [status, setStatus] = useState(sp.get("status") || "");
  const [service, setService] = useState(sp.get("service") || "");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ErrorItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortField, setSortField] = useState("lastOccurredAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (search) params.set("search", search);
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    if (service) params.set("service", service);
    const res = await fetch(`/api/admin/error-logs?${params}`);
    const r = await res.json();
    if (r.success) setData(r.data);
    setLoading(false);
  }, [search, severity, status, service]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const applyFilters = () => { setPage(1); fetchData(1); };
  const resetFilters = () => { setSearch(""); setSeverity(""); setStatus(""); setService(""); setPage(1); };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/admin/error-logs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus, ...(newStatus === "RESOLVED" ? { resolvedAt: new Date().toISOString() } : { resolvedAt: null }) }) });
    fetchData(page);
    if (selected?.id === id) setSelected((s) => s ? { ...s, status: newStatus } : null);
  };

  const openDrawer = (item: ErrorItem) => { setSelected(item); setDrawerOpen(true); };

  const counts = { critical: data.items.filter(i => i.severity === "CRITICAL").length, open: data.items.filter(i => i.status === "OPEN").length, investigating: data.items.filter(i => i.status === "INVESTIGATING").length, resolved: data.items.filter(i => i.status === "RESOLVED").length };

  const exportUrl = (scope: string) => {
    const p = new URLSearchParams({ format: "csv", scope });
    if (search) p.set("search", search); if (severity) p.set("severity", severity); if (status) p.set("status", status); if (service) p.set("service", service);
    return `/api/admin/error-logs?${p}`;
  };

  const inputClass = "h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cli-emerald/50";

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/super-admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
          <div><h1 className="text-xl font-bold text-foreground">Error Logs</h1><p className="text-xs text-muted-foreground">Platform diagnostics and operational failures</p></div>
        </div>
        <div className="flex items-center gap-2">
          <a href={exportUrl("page")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30" title="Export current page"><Download className="h-3.5 w-3.5" />Page</a>
          <a href={exportUrl("all")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30" title="Export all filtered results"><Download className="h-3.5 w-3.5" />All</a>
          <button onClick={() => fetchData(page)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Critical", value: counts.critical, icon: XCircle, color: "text-foreground", bg: "bg-muted/60", filter: "CRITICAL" },
          { label: "Open", value: counts.open, icon: AlertCircle, color: "text-muted-foreground", bg: "bg-foreground/10", filter: "OPEN" },
          { label: "Investigating", value: counts.investigating, icon: AlertTriangle, color: "text-muted-foreground", bg: "bg-muted/60", filter: "INVESTIGATING" },
          { label: "Resolved Today", value: counts.resolved, icon: CheckCircle2, color: "text-cli-emerald", bg: "bg-cli-emerald/10", filter: "RESOLVED" },
        ].map((c) => (
          <button key={c.label} onClick={() => { setStatus(c.filter); setPage(1); fetchData(1); }} className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-1"><div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.bg)}><c.icon className={cn("h-4 w-4", c.color)} /></div></div>
            <p className={cn("text-xl font-bold font-mono", c.color)}>{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="text" placeholder="Search errors..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyFilters()} className={cn(inputClass, "pl-10 w-full")} /></div>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} className={cn(inputClass, "w-28")}><option value="">Severity</option><option value="INFO">Info</option><option value="WARNING">Warning</option><option value="ERROR">Error</option><option value="CRITICAL">Critical</option></select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={cn(inputClass, "w-32")}><option value="">Status</option><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option><option value="IGNORED">Ignored</option></select>
        <button onClick={resetFilters} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Reset</button>
        <span className="text-xs font-mono text-muted-foreground ml-auto">{data.total.toLocaleString()} errors</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/30 text-left">{[
              { key: "severity", label: "", w: "w-10" },
              { key: "lastOccurredAt", label: "Time", w: "" },
              { key: "service", label: "Service", w: "" },
              { key: "module", label: "Module", w: "" },
              { key: "message", label: "Message", w: "" },
              { key: "occurrenceCount", label: "×", w: "w-12" },
              { key: "status", label: "Status", w: "w-28" },
            ].map((h) => (
              <th key={h.key} className={cn("px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none", h.w)} onClick={() => { if (sortField === h.key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(h.key); setSortDir("desc"); } }}>
                <span className="inline-flex items-center gap-1">{h.label}{sortField === h.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
              </th>
            ))}</tr></thead>
            <tbody>
              {loading && data.items.length === 0 ? Array.from({ length: 10 }).map((_, i) => (<tr key={i} className="border-b border-border/30 animate-pulse">{Array.from({ length: 7 }).map((_, j) => (<td key={j} className="px-3 py-3"><div className="h-4 bg-muted/30 rounded" /></td>))}</tr>)) : data.items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center"><CheckCircle2 className="h-8 w-8 text-cli-emerald/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No platform errors detected.</p></td></tr>
              ) : data.items.map((item) => {
                const s = SEV[item.severity] || SEV.INFO; const t = ST[item.status] || ST.OPEN; const Icon = s.icon;
                return (
                  <tr key={item.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => openDrawer(item)}>
                    <td className="px-3 py-2.5"><Icon className={cn("h-4 w-4", s.color)} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(item.lastOccurredAt).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-foreground">{item.service}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.module}</td>
                    <td className="px-3 py-2.5 text-foreground truncate max-w-[300px]">{item.message}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground text-center">{item.occurrenceCount > 1 ? `×${item.occurrenceCount}` : ""}</td>
                    <td className="px-3 py-2.5"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border", t.color, t.bg, item.status === "RESOLVED" ? "border-cli-emerald/30" : item.status === "OPEN" ? "border-border" : "border-border")}>{item.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-mono">Page {data.page} of {data.totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-card border-l border-border overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Error Details</h3>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-muted/30"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-foreground font-medium">{selected.message}</p>
                {selected.errorCode && <p className="text-xs text-muted-foreground font-mono mt-1">Code: {selected.errorCode}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[["Severity", selected.severity], ["Status", selected.status], ["Category", selected.category], ["Service", selected.service], ["Module", selected.module], ["Occurrences", `×${selected.occurrenceCount}`], ["First occurred", new Date(selected.firstOccurredAt).toLocaleString()], ["Last occurred", new Date(selected.lastOccurredAt).toLocaleString()]].map(([k, v]) => (
                  <div key={k as string}><p className="text-xs text-muted-foreground">{k}</p><p className="text-foreground">{v as string}</p></div>
                ))}
              </div>
              {selected.correlationId && <div className="flex items-center gap-2 text-sm"><span className="text-xs text-muted-foreground">Correlation ID:</span><code className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded">{selected.correlationId}</code><button onClick={() => navigator.clipboard.writeText(selected.correlationId!)} className="text-cli-blue hover:underline text-xs">Copy</button></div>}
              {selected.metadata && <div><p className="text-xs text-muted-foreground mb-1">Metadata</p><pre className="text-xs font-mono bg-muted/30 p-3 rounded-lg overflow-x-auto max-h-48">{JSON.stringify(selected.metadata, null, 2)}</pre></div>}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {["INVESTIGATING", "RESOLVED", "IGNORED"].map((s) => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={selected.status === s} className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-30", s === "RESOLVED" ? "border-cli-emerald/30 text-cli-emerald hover:bg-cli-emerald/10" : s === "IGNORED" ? "border-border text-muted-foreground hover:bg-muted/30" : "border-border text-muted-foreground hover:bg-muted/30")}>{s === "INVESTIGATING" ? "Investigate" : s === "RESOLVED" ? "Resolve" : "Ignore"}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
