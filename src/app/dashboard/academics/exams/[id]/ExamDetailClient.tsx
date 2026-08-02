"use client";

import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExamDetailClient({ examId, results }: { examId: string; results: any[] }) {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const records = Object.entries(marks).map(([studentId, marksObtained]) => ({ studentId, marksObtained }));
    await fetch(`/api/exams?action=bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examId, results: records }) });
    setSaving(false);
    window.location.reload();
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/academics/exams" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
          <div><h1 className="text-xl font-bold text-foreground">Exam Results</h1><p className="text-xs text-muted-foreground">Enter marks for each student</p></div>
        </div>
        <button onClick={handleSave} disabled={saving || Object.keys(marks).length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Saving..." : "Save All"}</button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-border bg-muted/30 text-left"><th className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase">Student</th><th className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase">Admission #</th><th className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase">Marks</th><th className="px-4 py-3 font-mono text-xs text-muted-foreground uppercase">Grade</th></tr></thead>
          <tbody>
            {results.map((r: any) => (
              <tr key={r.id} className="border-b border-border/30">
                <td className="px-4 py-3 text-foreground">{r.student?.firstName} {r.student?.lastName}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{r.student?.admissionNumber || "—"}</td>
                <td className="px-4 py-3"><input type="number" min={0} defaultValue={r.marksObtained || ""} onChange={(e) => setMarks((m) => ({ ...m, [r.studentId]: Number(e.target.value) }))} className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-cli-emerald/50" /></td>
                <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{r.grade || "—"}</td>
              </tr>
            ))}
          </tbody></table>
      </div>
    </div>
  );
}
