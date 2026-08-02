"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Users, GraduationCap, AlertCircle, CheckCircle2, ArrowLeft, RefreshCw, Search, X, Plus, Pause, Archive, Eye, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface SchoolItem { id: string; name: string; slug: string; city: string | null; state: string | null; status: string; createdAt: string; plan: string; students: number; teachers: number; }

export function SchoolsClient({ initialItems, initialTotal, summary }: { initialItems: SchoolItem[]; initialTotal: number; summary: any }) {
  const sp = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(sp.get("search") || "");
  const [status, setStatus] = useState(sp.get("status") || "");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SchoolItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "password123", city: "", state: "", board: "CBSE", timezone: "Asia/Kolkata", plan: "TRIALING" });

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await fetch(`/api/admin/schools?${params}`); const r = await res.json();
    if (r.success) { setItems(r.data.items); setTotal(r.data.total); }
    setLoading(false);
  }, [search, status]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/admin/schools/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    fetchData(page);
  };

  const createSchool = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowCreate(false); setForm({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "password123", city: "", state: "", board: "CBSE", timezone: "Asia/Kolkata", plan: "TRIALING" }); fetchData(page); }
    setLoading(false);
  };

  const inputClass = "h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-emerald/50";

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/super-admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
          <div><h1 className="text-xl font-bold text-foreground">Schools Management</h1><p className="text-xs text-muted-foreground">Manage every school registered on the platform</p></div>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/admin/schools?format=csv`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><Download className="h-3.5 w-3.5" />Export</a>
          <button onClick={() => fetchData(page)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"><Plus className="h-3.5 w-3.5" />Create School</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[["Total", summary.total, Building2, "text-cli-blue"], ["Active", summary.active, CheckCircle2, "text-cli-emerald"], ["Trial", summary.trial, AlertCircle, "text-cli-amber"], ["Suspended", summary.suspended, Pause, "text-muted-foreground"], ["Expired", summary.expired, Archive, "text-muted-foreground"]].map(([label, val, Icon, color]: any) => (
          <button key={label} onClick={() => { setStatus(label === "Total" ? "" : label.toUpperCase()); setPage(1); }} className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-sm">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2", `bg-${color.split('-')[1]}-100/10`)}><Icon className={cn("h-4 w-4", color)} /></div>
            <p className={cn("text-xl font-bold font-mono", color)}>{val.toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input placeholder="Search schools..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchData(1))} className={cn(inputClass, "pl-10 w-full")} /></div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={cn(inputClass, "w-32")}><option value="">All Status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="ARCHIVED">Archived</option></select>
        <span className="text-xs font-mono text-muted-foreground ml-auto">{total.toLocaleString()} schools</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-muted/30 text-left"><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">School</th><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase hidden sm:table-cell">Location</th><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">Plan</th><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">Students</th><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">Status</th><th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase w-20">Actions</th></tr></thead>
            <tbody>{loading ? Array.from({ length: 5 }).map((_, i) => (<tr key={i} className="border-b border-border/30 animate-pulse">{Array.from({ length: 6 }).map((_, j) => (<td key={j} className="px-3 py-3"><div className="h-4 bg-muted/30 rounded" /></td>))}</tr>)) : items.map((s) => (
              <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer" onClick={() => { setSelected(s); setDrawerOpen(true); }}>
                <td className="px-3 py-2.5 font-medium text-foreground">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{[s.city, s.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{s.plan}</td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">{s.students}</td>
                <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-md text-xs font-mono", s.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald" : s.status === "SUSPENDED" ? "bg-muted/60 text-muted-foreground" : "bg-muted/30 text-muted-foreground")}>{s.status}</span></td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  {s.status !== "SUSPENDED" && <button onClick={() => updateStatus(s.id, "SUSPENDED")} className="p-1 hover:bg-muted/30 rounded" title="Suspend"><Pause className="h-3.5 w-3.5 text-muted-foreground" /></button>}
                  {s.status === "SUSPENDED" && <button onClick={() => updateStatus(s.id, "ACTIVE")} className="p-1 hover:bg-muted/30 rounded" title="Reactivate"><CheckCircle2 className="h-3.5 w-3.5 text-cli-emerald" /></button>}
                </td>
              </tr>
            ))}</tbody></table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border"><p className="text-xs text-muted-foreground font-mono">Page {page}</p><div className="flex gap-1"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Prev</button><button onClick={() => setPage(p => p + 1)} disabled={items.length < 50} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Next</button></div></div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/30" onClick={() => setShowCreate(false)} /><div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"><h3 className="font-semibold text-foreground mb-4">Create School</h3>
          <div className="grid grid-cols-2 gap-3"><input placeholder="School Name *" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} className={inputClass} /><input placeholder="Code (auto)" value={form.slug} readOnly className={cn(inputClass, "opacity-50")} /><input placeholder="Admin Name *" value={form.adminName} onChange={(e) => setForm(p => ({ ...p, adminName: e.target.value }))} className={inputClass} /><input placeholder="Admin Email *" value={form.adminEmail} onChange={(e) => setForm(p => ({ ...p, adminEmail: e.target.value }))} className={inputClass} /><input placeholder="City" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} className={inputClass} /><input placeholder="State" value={form.state} onChange={(e) => setForm(p => ({ ...p, state: e.target.value }))} className={inputClass} /></div>
          <div className="flex gap-2 mt-4"><button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm">Cancel</button><button onClick={createSchool} disabled={!form.name || !form.adminName || !form.adminEmail} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">Create</button></div>
        </div></div>
      )}

      {/* Details Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end"><div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} /><div className="relative w-full max-w-md bg-card border-l border-border overflow-y-auto shadow-2xl p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">{selected.name}</h3><button onClick={() => setDrawerOpen(false)}><X className="h-4 w-4" /></button></div>
          <div className="space-y-3 text-sm">
            {[["Code", selected.slug], ["Location", [selected.city, selected.state].filter(Boolean).join(", ") || "—"], ["Plan", selected.plan], ["Students", selected.students], ["Teachers", selected.teachers], ["Status", selected.status], ["Created", new Date(selected.createdAt).toLocaleDateString()]].map(([k, v]) => (<div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="text-foreground">{v as string}</span></div>))}
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            {selected.status !== "SUSPENDED" && <button onClick={() => { updateStatus(selected.id, "SUSPENDED"); setSelected(s => s ? { ...s, status: "SUSPENDED" } : null); }} className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:bg-muted/30">Suspend</button>}
            {selected.status === "SUSPENDED" && <button onClick={() => { updateStatus(selected.id, "ACTIVE"); setSelected(s => s ? { ...s, status: "ACTIVE" } : null); }} className="px-3 py-1.5 rounded-lg border border-cli-emerald/30 text-cli-emerald text-xs hover:bg-cli-emerald/10">Reactivate</button>}
          </div>
        </div></div>
      )}
    </div>
  );
}
