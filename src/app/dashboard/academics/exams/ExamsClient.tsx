"use client";

import { FileText, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/ea/layout";

export function ExamsClient({ exams, section }: { exams: any[]; section?: { name: string; className: string } | null }) {
  return (
    <div className="space-y-5 w-full">
      <PageHeader title="Examinations" subtitle={section ? `Schedule and results — ${section.className} · ${section.name}` : "Manage exams and enter results"} back
        actions={section ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cli-blue/10 text-cli-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-cli-blue" />{section.className} · {section.name}
          </span>
        ) : undefined}
      />

      {exams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No exam schedule yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam: any) => (
            <a key={exam.id} href={`/dashboard/academics/exams/${exam.id}`} className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{exam.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{exam.subject?.name || "—"} — {exam.class?.name} {exam.section?.name ? `(${exam.section.name})` : ""}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-muted-foreground">Max: {exam.maxMarks}</span>
                    <span className="text-muted-foreground">Pass: {exam.passMarks}</span>
                    {exam.examDate && <span className="text-muted-foreground">{new Date(exam.examDate).toLocaleDateString()}</span>}
                    <span className={cn("px-2 py-0.5 rounded-md font-mono", exam.status === "UPCOMING" ? "bg-cli-blue/10 text-cli-blue" : "bg-cli-emerald/10 text-cli-emerald")}>{exam.status}</span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
