"use client";

import { useState, useCallback, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, HelpCircle, RefreshCw, Search, Download, Users, UserCheck, UserX, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/ea/layout";

const STATUS_ICONS: Record<string, any> = { PRESENT: CheckCircle2, ABSENT: XCircle, LATE: Clock, EXCUSED: HelpCircle };
const STATUS_COLORS: Record<string, string> = { PRESENT: "text-cli-emerald", ABSENT: "text-muted-foreground", LATE: "text-muted-foreground", EXCUSED: "text-cli-blue" };
const STATUS_BG: Record<string, string> = { PRESENT: "bg-cli-emerald/10", ABSENT: "bg-muted/40", LATE: "bg-muted/40", EXCUSED: "bg-cli-blue/10" };
const SUMMARY_BG: Record<string, string> = { PRESENT: "bg-cli-emerald/10", ABSENT: "bg-muted/40", LATE: "bg-muted/40", EXCUSED: "bg-cli-blue/10", pct: "bg-cli-emerald/10" };

export function AttendanceClient({ initialRecords, classes, summary }: { initialRecords: any[]; classes: any[]; summary: any }) {
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [showMark, setShowMark] = useState(false);
  const [markClass, setMarkClass] = useState("");
  const [bulkStatus, setBulkStatus] = useState("PRESENT");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (classFilter) params.set("classId", classFilter);
    if (dateFilter) params.set("date", dateFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/attendance?${params}`); const r = await res.json();
    if (r.success) { setRecords(Array.isArray(r.data) ? r.data : r.data?.items || []); }
    setLoading(false);
    window.history.replaceState({}, "", `?${params}`);
  }, [classFilter, dateFilter, search]);

  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const selectAll = () => { if (selected.size === records.length) setSelected(new Set()); else setSelected(new Set(records.map((r: any) => r.id))); };

  const bulkMark = async (status: string) => {
    if (selected.size === 0) return;
    const recs = records.filter((r: any) => selected.has(r.id)).map((r: any) => ({ studentMembershipId: r.studentMembershipId, status }));
    await fetch(`/api/attendance?bulk=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId: classFilter || classes[0]?.id, date: dateFilter, records: recs }) });
    fetchData(page); setSelected(new Set());
  };

  const markClassAttendance = async () => {
    if (!markClass) return;
    setLoading(true);
    await fetch(`/api/attendance?bulk=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId: markClass, date: dateFilter, records: [{ studentMembershipId: "*", status: bulkStatus }] }) });
    setLoading(false); setShowMark(false); fetchData(page);
  };

  const inputClass = "h-9 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cli-emerald/50";

  return (
    <div className="space-y-4 w-full">
      <PageHeader title="Attendance" subtitle="Manage daily attendance for students" back
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMark(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90"><CheckCircle2 className="h-3.5 w-3.5" />Mark Attendance</button>
            <button onClick={() => fetchData(page)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh</button>
            <a href={`/api/attendance?date=${dateFilter}&format=csv`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30"><Download className="h-3.5 w-3.5" />Export</a>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{ label: "Present", value: summary.PRESENT, icon: UserCheck, color: "text-cli-emerald" }, { label: "Absent", value: summary.ABSENT, icon: UserX, color: "text-muted-foreground" }, { label: "Late", value: summary.LATE, icon: Clock, color: "text-muted-foreground" }, { label: "Excused", value: summary.EXCUSED, icon: HelpCircle, color: "text-cli-blue" }, { label: "Attendance %", value: `${summary.pct}%`, icon: AlertCircle, color: summary.pct >= 75 ? "text-cli-emerald" : "text-muted-foreground" }].map((c: any) => (
          <button key={c.label} onClick={() => setStatusFilter(c.label === "Attendance %" ? "" : c.label.toUpperCase())} className="rounded-xl border border-border bg-card p-4 text-left hover:shadow-sm">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2", SUMMARY_BG[c.label] || SUMMARY_BG.pct)}><c.icon className={cn("h-4 w-4", c.color)} /></div>
            <p className={cn("text-xl font-bold font-mono", c.color)}>{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }} className={cn(inputClass, "w-44")}><option value="">All Classes</option>{classes.map((c: any) => (<option key={c.id} value={c.id}>{c.name} {c.section?.name || ""}</option>))}</select>
        <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1); }} className={cn(inputClass, "w-36")} />
        <input type="text" placeholder="Search student..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchData(1))} className={cn(inputClass, "w-48")} />
        {selected.size > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            <button onClick={() => bulkMark("PRESENT")} className="px-2 py-1 rounded text-xs bg-cli-emerald/10 text-cli-emerald hover:bg-cli-emerald/20">Present</button>
            <button onClick={() => bulkMark("ABSENT")} className="px-2 py-1 rounded text-xs bg-muted/60 text-muted-foreground hover:bg-muted/80">Absent</button>
            <button onClick={() => bulkMark("LATE")} className="px-2 py-1 rounded text-xs bg-muted/60 text-muted-foreground hover:bg-muted/80">Late</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-border bg-muted/30 text-left">
            <th className="px-3 py-2.5 w-8"><input type="checkbox" onChange={selectAll} checked={selected.size === records.length && records.length > 0} className="h-4 w-4 rounded accent-cli-emerald" /></th>
            <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">Student</th>
            <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase hidden sm:table-cell">Class</th>
            <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase">Status</th>
            <th className="px-3 py-2.5 font-mono text-xs text-muted-foreground uppercase hidden md:table-cell">Time</th>
          </tr></thead>
            <tbody>{loading ? Array.from({ length: 5 }).map((_, i) => (<tr key={i} className="border-b border-border/30 animate-pulse">{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="px-3 py-3"><div className="h-4 bg-muted/30 rounded" /></td>))}</tr>)) : records.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-16 text-center"><CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No attendance records for this date.</p></td></tr>
            ) : records.map((r: any) => {
              const Icon = STATUS_ICONS[r.status] || CheckCircle2;
              return (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="h-4 w-4 rounded accent-cli-emerald" /></td>
                  <td className="px-3 py-2.5 text-foreground font-medium">{r.studentName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{r.className} {r.sectionName}</td>
                  <td className="px-3 py-2.5"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono", STATUS_BG[r.status] || "bg-muted/40", STATUS_COLORS[r.status] || "text-muted-foreground")}><Icon className="h-3 w-3" />{r.status}</span></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{new Date(r.markedAt).toLocaleTimeString()}</td>
                </tr>
              );
            })}</tbody></table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border"><p className="text-xs text-muted-foreground font-mono">Page {page}</p><div className="flex gap-1"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Prev</button><button onClick={() => setPage(p => p + 1)} disabled={records.length < 50} className="px-3 py-1 rounded-md border border-border text-xs hover:bg-muted/30 disabled:opacity-30">Next</button></div></div>
      </div>

      {/* Mark Attendance Modal */}
      {showMark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/30" onClick={() => setShowMark(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-foreground mb-4">Mark Attendance</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Class</label><select value={markClass} onChange={(e) => setMarkClass(e.target.value)} className={cn(inputClass, "w-full mt-1")}><option value="">Select Class</option>{classes.map((c: any) => (<option key={c.id} value={c.id}>{c.name} {c.section?.name || ""}</option>))}</select></div>
              <div><label className="text-xs text-muted-foreground">Status</label><select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={cn(inputClass, "w-full mt-1")}><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="LATE">Late</option></select></div>
              <div className="flex gap-2 pt-2"><button onClick={() => setShowMark(false)} className="flex-1 px-4 py-2 rounded-lg border border-border text-sm">Cancel</button><button onClick={markClassAttendance} disabled={!markClass} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50">Mark Class</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
