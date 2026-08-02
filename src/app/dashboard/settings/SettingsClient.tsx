"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Settings2 } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";

const schoolTypeOpts = ["Day School", "Residential", "Boarding", "Online", "Other"].map(v => ({ value: v, label: v }));

interface SchoolSettingsData {
  id: string | null;
  schoolType: string;
  grades: string[];
  language: string;
  gradingSystem: string;
  attendanceStart: string;
  attendanceEnd: string;
}

export function SettingsClient({ canEdit }: { canEdit: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SchoolSettingsData>({ id: null, schoolType: "", grades: [], language: "", gradingSystem: "", attendanceStart: "", attendanceEnd: "" });
  const [newGrade, setNewGrade] = useState("");

  useEffect(() => {
    fetch("/api/school-settings").then(r => r.json()).then(d => {
      if (d.success && d.data) {
        setData({
          id: d.data.id ?? null,
          schoolType: d.data.schoolType ?? "",
          grades: Array.isArray(d.data.grades) ? d.data.grades : [],
          language: d.data.language ?? "",
          gradingSystem: d.data.gradingSystem ?? "",
          attendanceStart: d.data.attendanceStart ?? "",
          attendanceEnd: d.data.attendanceEnd ?? "",
        });
      }
    }).catch(() => toast.error("Failed to load settings")).finally(() => setLoading(false));
  }, []);

  const addGrade = () => {
    const g = newGrade.trim();
    if (!g) return;
    if (data.grades.includes(g)) { toast.error("Grade already exists"); return; }
    setData(prev => ({ ...prev, grades: [...prev.grades, g] }));
    setNewGrade("");
  };

  const removeGrade = (idx: number) => setData(prev => ({ ...prev, grades: prev.grades.filter((_, i) => i !== idx) }));
  const moveGrade = (idx: number, dir: -1 | 1) => {
    setData(prev => {
      const next = [...prev.grades];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, grades: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/school-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolType: data.schoolType || undefined,
          grades: data.grades,
          language: data.language || undefined,
          gradingSystem: data.gradingSystem || undefined,
          attendanceStart: data.attendanceStart || undefined,
          attendanceEnd: data.attendanceEnd || undefined,
        }),
      });
      const r = await res.json();
      if (r.success) toast.success("Settings saved");
      else toast.error(r.error?.message || "Failed to save");
    } catch { toast.error("Network error"); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground font-mono text-sm">Loading...</p></div>;

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="School Settings" subtitle="Configure school profile and academic structure." />

      <PageCard>
        <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">Academic Structure</h3>
        <FormGrid cols={2}>
          <div>
            <p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-1.5">School Type</p>
            <select
              disabled={!canEdit}
              value={data.schoolType}
              onChange={e => setData(prev => ({ ...prev, schoolType: e.target.value }))}
              className="h-11 w-full rounded-xl bg-card border border-border px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 disabled:opacity-50">
              <option value="">Select type...</option>
              {schoolTypeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </FormGrid>

        <div className="mt-6">
          <p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-1.5">Grade Levels (ordered lowest → highest)</p>
          <p className="text-xs text-muted-foreground mb-3">Used by Bulk Promotion to auto-advance students. Students in the highest grade are automatically marked Graduated.</p>
          {data.grades.length === 0 ? (
            <p className="text-sm text-muted-foreground font-mono border border-dashed border-border rounded-xl px-4 py-6 text-center">No grades configured yet</p>
          ) : (
            <div className="space-y-2 max-w-lg">
              {data.grades.map((g, idx) => (
                <div key={`${g}-${idx}`} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/30">
                  <span className="text-xs font-mono text-muted-foreground/50 w-6">{idx + 1}.</span>
                  <span className="text-sm text-foreground flex-1">{g}</span>
                  {idx === 0 && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cli-blue bg-cli-blue/10 px-2 py-0.5 rounded-md">Lowest</span>
                  )}
                  {idx === data.grades.length - 1 && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cli-amber bg-cli-amber/10 px-2 py-0.5 rounded-md">Highest</span>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveGrade(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveGrade(idx, 1)} disabled={idx === data.grades.length - 1} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => removeGrade(idx)} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex items-center gap-2 mt-3 max-w-lg">
              <EAInput placeholder="e.g. Grade 1" value={newGrade} onChange={e => setNewGrade(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addGrade(); } }} />
              <EAButton variant="secondary" type="button" onClick={addGrade}><Plus className="h-4 w-4 mr-1" />Add</EAButton>
            </div>
          )}
        </div>
      </PageCard>

      <PageCard>
        <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">General</h3>
        <FormGrid cols={2}>
          <FormField label="Language"><EAInput placeholder="en" value={data.language} disabled={!canEdit} onChange={e => setData(prev => ({ ...prev, language: e.target.value }))} /></FormField>
          <FormField label="Grading System"><EAInput placeholder="e.g. CGPA, Percentage" value={data.gradingSystem} disabled={!canEdit} onChange={e => setData(prev => ({ ...prev, gradingSystem: e.target.value }))} /></FormField>
          <FormField label="Attendance Start"><EAInput placeholder="e.g. 08:00" value={data.attendanceStart} disabled={!canEdit} onChange={e => setData(prev => ({ ...prev, attendanceStart: e.target.value }))} /></FormField>
          <FormField label="Attendance End"><EAInput placeholder="e.g. 16:00" value={data.attendanceEnd} disabled={!canEdit} onChange={e => setData(prev => ({ ...prev, attendanceEnd: e.target.value }))} /></FormField>
        </FormGrid>
      </PageCard>

      {canEdit && (
        <FooterActions>
          <EAButton type="button" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4 mr-1" />}Save Settings</EAButton>
        </FooterActions>
      )}
    </div>
  );
}
