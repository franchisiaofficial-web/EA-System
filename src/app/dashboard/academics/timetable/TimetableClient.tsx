"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/ea/layout";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TimetableClient({ items, classes, section }: { items: any[]; classes: any[]; section?: { id: string; name: string; className: string } | null }) {
  const grouped = new Map<number, any[]>();
  for (const item of items) { if (!grouped.has(item.dayOfWeek)) grouped.set(item.dayOfWeek, []); grouped.get(item.dayOfWeek)!.push(item); }

  return (
    <div className="space-y-5 w-full">
      <PageHeader title="Timetable" subtitle={section ? `Weekly schedule — ${section.className} · ${section.name}` : "Weekly class schedule"} back
        actions={section ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cli-blue/10 text-cli-blue">
            <span className="h-1.5 w-1.5 rounded-full bg-cli-blue" />{section.className} · {section.name}
          </span>
        ) : undefined}
      />

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center"><Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No timetable entries yet.</p></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <div key={day} className="border-r border-border last:border-r-0">
                <div className="bg-muted/30 px-3 py-2 text-center font-mono text-xs text-muted-foreground uppercase tracking-wider">{DAYS[day - 1]}</div>
                <div className="p-2 space-y-1 min-h-[200px]">
                  {(grouped.get(day) || []).map((item: any) => (
                    <div key={item.id} className="text-xs p-2 rounded-lg bg-cli-blue/5 border border-cli-blue/10">
                      <p className="font-medium text-foreground">{item.subject?.name || "—"}</p>
                      <p className="text-muted-foreground">{item.startTime} - {item.endTime}</p>
                      <p className="text-muted-foreground">{item.class?.name} {item.section?.name || ""}</p>
                      {item.teacher?.user?.name && <p className="text-muted-foreground text-[10px]">{item.teacher.user.name}</p>}
                      {item.roomNo && <p className="text-muted-foreground text-[10px]">Room: {item.roomNo}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
