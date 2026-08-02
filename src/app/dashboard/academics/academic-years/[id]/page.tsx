"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2, School } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageCard, SidePanel, FormGrid } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { CardGridSkeleton } from "@/components/ui/skeleton";

interface AYDetail {
  id: string; name: string; startDate: string; endDate: string; isActive: boolean; status: string;
  _count: { classes: number };
}

export default function AcademicYearDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<AYDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/academic-years/${id}`).then(r => r.json()).then(d => {
      if (d.success) setRecord(d.data);
      else { toast.error("Academic year not found"); router.push("/dashboard/academics/academic-years"); }
    }).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;
  if (!record) return null;

  return (
    <div className="space-y-6 w-full">
      <PageHeader title={record.name} subtitle={`${record._count.classes} classes · ${record.isActive ? "Currently Active" : "Inactive"}`} back
        actions={
          <div className="flex items-center gap-2">
            <EAButton variant="secondary" onClick={() => router.push(`/dashboard/academics/academic-years/${id}/edit`)}><Pencil className="h-4 w-4 mr-1.5" />Edit</EAButton>
          </div>
        }
      />

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="flex-1 space-y-6 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-purple/10 flex items-center justify-center"><School className="h-5 w-5 text-cli-purple" /></div>
              <div><p className="text-2xl font-bold text-foreground">{record._count.classes}</p><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Classes</p></div>
            </PageCard>
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-emerald/10 flex items-center justify-center">
                <span className={`h-3 w-3 rounded-full ${record.isActive ? "bg-foreground animate-pulse" : "bg-muted-foreground/30"}`} />
              </div>
              <div><p className="text-2xl font-bold text-foreground">{record.isActive ? "Active" : "Inactive"}</p><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">Status</p></div>
            </PageCard>
          </div>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">Academic Year Details</h3>
            <FormGrid cols={2}>
              <div><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Name</p><p className="text-sm text-foreground font-medium">{record.name}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${record.isActive ? "bg-foreground/15 text-foreground" : "bg-muted text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${record.isActive ? "bg-foreground" : "bg-muted-foreground/30"}`} />{record.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">Start Date</p><p className="text-sm text-foreground font-medium">{new Date(record.startDate).toLocaleDateString()}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-0.5">End Date</p><p className="text-sm text-foreground font-medium">{new Date(record.endDate).toLocaleDateString()}</p></div>
            </FormGrid>
          </PageCard>
        </div>

        <SidePanel title="Summary" items={[
          { label: "Status", value: record.isActive ? "Active" : "Inactive", accent: "status" },
          { label: "Classes", value: record._count.classes },
          { label: "Start", value: new Date(record.startDate).toLocaleDateString() },
          { label: "End", value: new Date(record.endDate).toLocaleDateString() },
        ]} />
      </div>
    </div>
  );
}
