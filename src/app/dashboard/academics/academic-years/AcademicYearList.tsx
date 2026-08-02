'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Eye, Plus, Calendar, BookOpen, Users, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/ea/layout';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { EAButton } from '@/components/ui/ea';
import { CardGridSkeleton } from '@/components/ui/skeleton';

interface AcademicYearItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrent: boolean;
  status: string;
  _count: { classes: number; enrollments: number };
}

export function AcademicYearList({
  canCreate,
  canUpdate,
  canArchive,
}: {
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AcademicYearItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (s: string) => {
    const params = new URLSearchParams({ page: '1', pageSize: '100' });
    if (s) params.set('search', s);
    const res = await fetch(`/api/academic-years?${params}`);
    const data = await res.json();
    if (data.success) setItems(data.data.items);
    else toast.error('Failed to load academic years');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!didLoad.current) { didLoad.current = true; void load(search); }
  }, [search, load]);

  useEffect(() => {
    if (!didLoad.current) return;
    const tid = setTimeout(() => { setLoading(true); void load(search); }, 300);
    return () => clearTimeout(tid);
  }, [search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/academic-years/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) { toast.success('Academic year archived'); setDeleteConfirm(null); void load(search); }
    else { toast.error(result.error?.message || 'Failed to archive'); }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

  const statusInfo = (r: AcademicYearItem) => {
    if (r.isCurrent) return { label: 'Current', cls: 'bg-cli-emerald/10 text-cli-emerald' };
    if (r.status === 'COMPLETED') return { label: 'Archived', cls: 'bg-muted/50 text-muted-foreground' };
    if (r.isActive) return { label: 'Active', cls: 'bg-cli-blue/10 text-cli-blue' };
    return { label: 'Inactive', cls: 'bg-muted/50 text-muted-foreground' };
  };

  return (
    <>
      <PageHeader title="Academic Years" subtitle="academics &bull; manage school years" />
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <EntityActionBar
            entityLabel="Academic Year"
            createHref={canCreate ? '/dashboard/academics/academic-years/create' : undefined}
            onRefresh={() => { setLoading(true); void load(search); }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search academic years..."
            className="h-10 w-full max-w-xs rounded-xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all"
          />
        </div>

        {loading ? (
          <CardGridSkeleton count={3} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <GraduationCap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">{search ? 'No academic years match your search' : 'No academic years yet'}</p>
            {canCreate && (
              <EAButton className="mt-4" onClick={() => router.push('/dashboard/academics/academic-years/create')}>
                <Plus className="h-4 w-4 mr-1.5" />Create Academic Year
              </EAButton>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(r => {
              const st = statusInfo(r);
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 h-full flex flex-col">
                  <Link href={`/dashboard/academics/academic-years/${r.id}`} className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-base font-bold text-foreground">{r.name}</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${st.cls}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />{st.label}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-blue/10 flex items-center justify-center"><Calendar className="h-4 w-4 text-cli-blue" /></div>
                        <div>
                          <p className="text-sm text-foreground font-medium font-mono text-xs">{formatDate(r.startDate)} → {formatDate(r.endDate)}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Start → End</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-purple/10 flex items-center justify-center"><BookOpen className="h-4 w-4 text-cli-purple" /></div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{r._count?.classes ?? 0}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Classes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-emerald/10 flex items-center justify-center"><Users className="h-4 w-4 text-cli-emerald" /></div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{r._count?.enrollments ?? 0}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Students</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/60">
                    <Link href={`/dashboard/academics/academic-years/${r.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Eye className="h-3 w-3" />View</Link>
                    {canUpdate && (
                      <Link href={`/dashboard/academics/academic-years/${r.id}/edit`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Pencil className="h-3 w-3" />Edit</Link>
                    )}
                    {canArchive && r.status !== 'COMPLETED' && (
                      <button onClick={() => setDeleteConfirm(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Trash2 className="h-3 w-3" />Archive</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmDialog open={!!deleteConfirm} title="Archive Academic Year" message="Are you sure you want to archive this academic year?" confirmLabel="Archive"
          onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      </div>
    </>
  );
}
