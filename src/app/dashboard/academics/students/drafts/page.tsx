"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, PageCard } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { FileText, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { CardGridSkeleton } from "@/components/ui/skeleton";

interface Draft {
  id: string;
  data: Record<string, any>;
  progress: number;
  lastStep: string | null;
  updatedAt: string;
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function StudentDraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/students/drafts")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setDrafts(Array.isArray(d.data) ? d.data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const deleteDraft = async (id: string) => {
    try {
      const res = await fetch(`/api/students/drafts?id=${id}`, { method: "DELETE" });
      const r = await res.json();
      if (r.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        toast.success("Draft deleted");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Draft Students" subtitle="Continue where you left off." backHref="/dashboard/academics/students" />
      {drafts.length === 0 ? (
        <PageCard className="flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-mono text-sm">No saved drafts</p>
          <EAButton variant="secondary" onClick={() => router.push("/dashboard/academics/students/create")}>Create New Student</EAButton>
        </PageCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((draft) => (
            <PageCard key={draft.id} className="!p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {draft.data.firstName && draft.data.lastName
                      ? `${draft.data.firstName} ${draft.data.lastName}`
                      : draft.data.firstName || draft.data.admissionNumber || "Untitled"}
                  </p>
                  {draft.data.admissionNumber && (
                    <p className="text-[11px] font-mono text-muted-foreground/70">{draft.data.admissionNumber}</p>
                  )}
                </div>
                <button onClick={() => deleteDraft(draft.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-cli-emerald transition-all" style={{ width: `${draft.progress}%` }} />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">{draft.progress}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {timeAgo(draft.updatedAt)}
                </span>
                <EAButton size="sm" variant="secondary" onClick={() => router.push(`/dashboard/academics/students/create?draftId=${draft.id}`)}>
                  Continue
                </EAButton>
              </div>
            </PageCard>
          ))}
        </div>
      )}
    </div>
  );
}
