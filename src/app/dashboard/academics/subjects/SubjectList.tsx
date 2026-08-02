"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus, BookOpen, Users, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageCard } from "@/components/ui/ea/layout";
import { EntityActionBar } from "@/components/crud/EntityActionBar";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { EAButton } from "@/components/ui/ea";

interface Subject {
  id: string; name: string; code: string; description: string | null; isActive: boolean;
}

export function SubjectList({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (s) params.set("search", s);
    const res = await fetch(`/api/subjects?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error("Failed to load");
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/subjects?id=${id}`, { method: "DELETE" });
    const r = await res.json();
    if (r.success) { toast.success("Archived"); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || "Failed");
  };

  const parseMeta = (desc: string | null) => {
    try { return desc ? JSON.parse(desc) : {}; } catch { return {}; }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Subjects" />
      <EntityActionBar entityLabel="Subject" createHref={canCreate ? "/dashboard/academics/subjects/create" : undefined} onRefresh={() => void load(page, search)} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(subject => {
          const meta = parseMeta(subject.description);
          return (
            <PageCard key={subject.id} className="!p-5 flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-purple/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-cli-purple" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{subject.name}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">{subject.code}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono ${subject.isActive ? "bg-muted/60 text-foreground border border-border" : "bg-muted/50 text-muted-foreground/70 border border-border"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${subject.isActive ? "bg-foreground" : "bg-muted-foreground/30"}`} />{subject.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-2 flex-1">
                {meta.teacherMemberId && (
                  <div className="flex items-center gap-2 text-xs"><GraduationCap className="h-3.5 w-3.5 text-muted-foreground/70" /><span className="text-muted-foreground">Teacher assigned</span></div>
                )}
                {meta.classIds?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs"><Users className="h-3.5 w-3.5 text-muted-foreground/70" /><span className="text-muted-foreground">{meta.classIds.length} class{meta.classIds.length > 1 ? "es" : ""}</span></div>
                )}
                {meta.sectionIds?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs"><BookOpen className="h-3.5 w-3.5 text-muted-foreground/70" /><span className="text-muted-foreground">{meta.sectionIds.length} section{meta.sectionIds.length > 1 ? "s" : ""}</span></div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                {canUpdate && (
                  <EAButton variant="secondary" size="sm" className="flex-1" onClick={() => router.push(`/dashboard/academics/subjects/${subject.id}/edit`)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </EAButton>
                )}
                {canUpdate && (
                  <EAButton variant="secondary" size="sm" className="flex-1" onClick={() => router.push(`/dashboard/academics/subjects/${subject.id}/edit`)}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Reassign
                  </EAButton>
                )}
              </div>
            </PageCard>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground/70 font-mono">No subjects found</p>
        </div>
      )}

      <ConfirmDialog open={!!deleteConfirm} title="Archive Subject" message="Archive this subject?" confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); void load(p, search); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${p === page ? "bg-muted/60 text-foreground" : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
