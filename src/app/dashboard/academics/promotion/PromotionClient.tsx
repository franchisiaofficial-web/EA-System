"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight, GraduationCap, ArrowUpCircle, MinusCircle, ArrowLeftRight, RefreshCw, CalendarCheck } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";

type Action = "PROMOTE" | "SKIP" | "GRADUATE" | "TRANSFER";

interface Year { id: string; name: string }

interface ClassItem { id: string; name: string }

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  enrollmentRecords: { status: string; class: { name: string } | null; section: { name: string } | null }[];
}

interface FailureItem {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  currentClass: string;
  currentSection: string;
  reason: string;
  action: "RETRY" | "REVIEW";
}

interface RunSummary {
  eligible: number;
  promoted: number;
  passedOut: number;
  skipped: number;
  failed: FailureItem[];
  total: number;
  retryable: number;
  durationMs: number;
  note?: string;
}

export function PromotionClient({ canEdit }: { canEdit: boolean }) {
  const [years, setYears] = useState<Year[]>([]);
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [targetClasses, setTargetClasses] = useState<ClassItem[]>([]);
  const [sourceClass, setSourceClass] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [actions, setActions] = useState<Record<string, Action>>({});
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [running, setRunning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastRun, setLastRun] = useState<{ summary: RunSummary; items: Record<string, Record<string, unknown>>; blocked: boolean } | null>(null);

  const reloadYears = () => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => {
      if (d.success) setYears(d.data.items);
    }).catch(() => {});
  };

  useEffect(() => {
    reloadYears();
    fetch("/api/school-settings").then(r => r.json()).then(d => {
      if (d.success && Array.isArray(d.data?.grades)) setGrades(d.data.grades);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fromYear) { setClasses([]); return; }
    fetch(`/api/classes?pageSize=100&academicYearId=${fromYear}`).then(r => r.json()).then(d => {
      if (d.success) setClasses(d.data.items);
    }).catch(() => {});
  }, [fromYear]);

  useEffect(() => {
    if (!toYear) { setTargetClasses([]); return; }
    fetch(`/api/classes?pageSize=100&academicYearId=${toYear}`).then(r => r.json()).then(d => {
      if (d.success) setTargetClasses(d.data.items);
    }).catch(() => {});
  }, [toYear]);

  useEffect(() => {
    if (!fromYear) { setStudents([]); return; }
    setLoadingStudents(true);
    const params = new URLSearchParams({ pageSize: "500", academicYearId: fromYear });
    if (sourceClass) params.set("classId", sourceClass);
    fetch(`/api/students?${params}`).then(r => r.json()).then(d => {
      if (d.success) {
        setStudents(d.data.items);
        const next: Record<string, Action> = {};
        for (const s of d.data.items) {
          const grade = s.enrollmentRecords?.[0]?.class?.name ?? null;
          const isHighest = grade !== null && grades.length > 0 && grades.indexOf(grade) === grades.length - 1;
          next[s.id] = isHighest ? "GRADUATE" : "PROMOTE";
        }
        setActions(next);
      } else toast.error("Failed to load students");
    }).catch(() => toast.error("Failed to load students")).finally(() => setLoadingStudents(false));
  }, [fromYear, sourceClass, grades]);

  const buildItems = () => {
    const items: Record<string, Record<string, unknown>> = {};
    for (const s of students) {
      const action = actions[s.id];
      if (!action || action === "SKIP") continue;
      const item: Record<string, unknown> = { studentId: s.id, action };
      if (action === "TRANSFER") {
        if (!transfers[s.id]) continue;
        item.toClassId = transfers[s.id];
      }
      items[s.id] = item;
    }
    return items;
  };

  const run = async () => {
    if (!fromYear || !toYear) { toast.error("Select both academic years"); return; }
    if (fromYear === toYear) { toast.error("From and To years must differ"); return; }
    const items = buildItems();
    if (Object.keys(items).length === 0) { toast.error("No students to process"); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAcademicYearId: fromYear, toAcademicYearId: toYear, items: Object.values(items) }),
      });
      const r = await res.json();
      if (r.success) {
        setLastRun({ summary: r.data, items, blocked: false });
        toast.success(`Promoted ${r.data.promoted} · Passed Out ${r.data.passedOut} · Skipped ${r.data.skipped}${r.data.failed.length ? ` · Failed ${r.data.failed.length}` : ""}`);
      } else toast.error(r.error?.message || "Promotion failed");
    } catch { toast.error("Network error"); } finally { setRunning(false); }
  };

  const retryFailed = async () => {
    if (!lastRun || !fromYear || !toYear) return;
    const failedIds = lastRun.summary.failed.map(f => f.studentId);
    const itemsList = failedIds
      .map(id => lastRun.items[id])
      .filter((x): x is Record<string, unknown> => x !== undefined);
    if (itemsList.length === 0) { toast.error("No retryable records"); return; }
    const items: Record<string, Record<string, unknown>> = {};
    for (const it of itemsList) items[String(it.studentId)] = it;
    setRetrying(true);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAcademicYearId: fromYear, toAcademicYearId: toYear, items: itemsList }),
      });
      const r = await res.json();
      if (r.success) {
        setLastRun({ summary: r.data, items, blocked: false });
        toast.success(`Retry: Promoted ${r.data.promoted} · Failed ${r.data.failed.length}`);
      } else toast.error(r.error?.message || "Retry failed");
    } catch { toast.error("Network error"); } finally { setRetrying(false); }
  };

  const closeYear = async () => {
    if (!fromYear || !toYear) { toast.error("Select both academic years"); return; }
    if (fromYear === toYear) { toast.error("From and To years must differ"); return; }
    setClosing(true);
    try {
      const res = await fetch("/api/promotions/close-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAcademicYearId: fromYear, toAcademicYearId: toYear }),
      });
      const r = await res.json();
      if (r.success) {
        const d = r.data;
        toast.success(`Year completed: ${d.completedYear.name} → ${d.activatedYear.name} (promoted ${d.summary.promoted})`);
        setLastRun(null);
        reloadYears();
      } else if (r.error?.code === "TRANSITION_BLOCKED") {
        setLastRun({ summary: r.error.summary, items: {}, blocked: true });
        toast.error(r.error.message);
      } else toast.error(r.error?.message || "Close year failed");
    } catch { toast.error("Network error"); } finally { setClosing(false); }
  };

  const actionBadge = (a: Action) => {
    if (a === "GRADUATE") return <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cli-amber bg-cli-amber/10 px-2 py-0.5 rounded-md"><GraduationCap className="h-3 w-3" />Highest grade</span>;
    return null;
  };

  const actionMeta: { value: Action; label: string }[] = [
    { value: "PROMOTE", label: "Promote → Next Grade" },
    { value: "SKIP", label: "Skip (Keep as-is)" },
    { value: "GRADUATE", label: "Pass Out (Complete Schooling)" },
    { value: "TRANSFER", label: "Transfer (Choose Class)" },
  ];

  const fmtDuration = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Bulk Student Promotion" subtitle="Promote, skip, graduate, or transfer students for the next academic year." back />

      <PageCard>
        <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">1. Select Academic Year & Class</h3>
        <FormGrid cols={2}>
          <FormField label="From Academic Year">
            <select value={fromYear} onChange={e => { setFromYear(e.target.value); setSourceClass(""); }}
              className="h-11 w-full rounded-xl bg-card border border-border px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10">
              <option value="">Select year...</option>
              {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </FormField>
          <FormField label="To Academic Year">
            <select value={toYear} onChange={e => setToYear(e.target.value)}
              className="h-11 w-full rounded-xl bg-card border border-border px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10">
              <option value="">Select year...</option>
              {years.filter(y => y.id !== fromYear).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </FormField>
          <FormField label="Source Class">
            <select value={sourceClass} onChange={e => setSourceClass(e.target.value)}
              className="h-11 w-full rounded-xl bg-card border border-border px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10">
              <option value="">All classes in year</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </FormGrid>
        {grades.length === 0 && (
          <p className="text-xs text-muted-foreground mt-3 font-mono">
            Tip: configure grade levels in School Settings to enable automatic graduation detection.
          </p>
        )}
      </PageCard>

      {fromYear && (
        <PageCard>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">2. Preview Students ({students.length})</h3>
          {loadingStudents ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono">No active enrollments found for the selected year/class.</p>
          ) : (
            <div className="space-y-2">
              {students.map(s => {
                const e = s.enrollmentRecords?.[0];
                const action = actions[s.id] ?? "PROMOTE";
                return (
                  <div key={s.id} className="px-4 py-3 rounded-xl border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber} · {e ? `${e.class?.name || "—"} (${e.section?.name || "—"})` : "No current class"}</p>
                      </div>
                      {actionBadge(action)}
                      <select
                        disabled={!canEdit}
                        value={action}
                        onChange={ev => setActions(prev => ({ ...prev, [s.id]: ev.target.value as Action }))}
                        className="h-9 rounded-lg bg-card border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:border-ea-green disabled:opacity-50">
                        {actionMeta.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    {action === "TRANSFER" && (
                      <div className="flex items-center gap-2 pl-1">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-cli-cyan" />
                        <select
                          value={transfers[s.id] ?? ""}
                          onChange={ev => setTransfers(prev => ({ ...prev, [s.id]: ev.target.value }))}
                          className="h-9 rounded-lg bg-card border border-border px-3 text-xs font-mono text-foreground focus:outline-none focus:border-ea-green">
                          <option value="">Select target class...</option>
                          {targetClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {canEdit && students.length > 0 && (
            <div className="flex items-center justify-end mt-5 gap-3">
              <p className="text-xs text-muted-foreground font-mono">
                <ArrowUpCircle className="h-3.5 w-3.5 inline mr-1 text-cli-emerald" />Promote <MinusCircle className="h-3.5 w-3.5 inline mx-1 text-muted-foreground/50" />Skip
              </p>
              <EAButton type="button" onClick={run} disabled={running || !toYear}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1.5" />}Run Promotion
              </EAButton>
            </div>
          )}
        </PageCard>
      )}

      {lastRun && (
        <PageCard>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">
            3. Run Summary {lastRun.blocked && <span className="text-cli-rose ml-2">— Transition Blocked</span>}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">Eligible</p><p className="text-xl font-semibold text-foreground">{lastRun.summary.eligible}</p></div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">Promoted</p><p className="text-xl font-semibold text-cli-emerald">{lastRun.summary.promoted}</p></div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">Passed Out</p><p className="text-xl font-semibold text-cli-amber">{lastRun.summary.passedOut}</p></div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">Skipped</p><p className="text-xl font-semibold text-muted-foreground">{lastRun.summary.skipped}</p></div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">Failed</p><p className="text-xl font-semibold text-cli-rose">{lastRun.summary.failed.length}</p></div>
          </div>
          {lastRun.summary.note && <p className="text-xs text-cli-amber font-mono mb-3">{lastRun.summary.note}</p>}
          {lastRun.blocked && (
            <p className="text-xs text-cli-rose font-mono mb-4">
              Academic year status was NOT changed — the year cannot be completed while unresolved promotion failures remain.
              Retry the failed records below, then run the close-year flow again.
            </p>
          )}
          <p className="text-[10px] font-mono text-muted-foreground mb-2">Took {fmtDuration(lastRun.summary.durationMs)}</p>

          {lastRun.summary.failed.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/20">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Admission</th>
                    <th className="px-4 py-2.5">Current Class</th>
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5">Failure Reason</th>
                    <th className="px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRun.summary.failed.map(f => (
                    <tr key={f.studentId} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-foreground">{f.studentName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{f.admissionNumber}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.currentClass}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.currentSection}</td>
                      <td className="px-4 py-2.5 text-cli-rose font-mono text-xs">{f.reason}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-md ${f.action === "RETRY" ? "text-cli-cyan bg-cli-cyan/10" : "text-cli-amber bg-cli-amber/10"}`}>{f.action}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && !lastRun.blocked && lastRun.summary.failed.length > 0 && (
            <div className="flex items-center justify-end mt-4">
              <EAButton type="button" onClick={retryFailed} disabled={retrying} variant="secondary">
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}Retry Failed ({lastRun.summary.retryable})
              </EAButton>
            </div>
          )}
        </PageCard>
      )}

      {canEdit && fromYear && toYear && (
        <PageCard>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-2">4. Close Year & Activate Next</h3>
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Processes every eligible student, then marks the source year COMPLETED and the target year ACTIVE — only if zero failures remain.
          </p>
          <div className="flex items-center justify-end gap-3">
            <EAButton type="button" onClick={closeYear} disabled={closing || running}>
              {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4 mr-1.5" />}Complete Year & Activate Next
            </EAButton>
          </div>
        </PageCard>
      )}
    </div>
  );
}
