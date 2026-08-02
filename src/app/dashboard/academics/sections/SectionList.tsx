'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Eye, Plus, School, Users, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/ea/layout';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { EAButton } from '@/components/ui/ea';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Section { id: string; name: string; description: string | null; status: string; class?: { id: string; name: string }; _count?: { studentEnrollments: number } }

export function SectionList({ canCreate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Section[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (p: number, s: string) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: '12' });
    if (s) params.set('search', s);
    try {
      const res = await fetch(`/api/sections?${params}`);
      const data = await res.json();
      if (data.success) {
        if (reqId.current !== id) return;
        setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages);
      } else if (reqId.current === id) toast.error('Failed to load');
    } catch { if (reqId.current === id) toast.error('Failed to load'); }
    finally { if (reqId.current === id) setLoading(false); }
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  useEffect(() => {
    if (!didLoad.current) return;
    const tid = setTimeout(() => { void load(1, search); setPage(1); }, 300);
    return () => clearTimeout(tid);
  }, [search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/sections?id=${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (r.success) { toast.success('Archived'); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || 'Failed');
  };

  return (
    <>
      <PageHeader title="Sections" subtitle="academics &bull; sections across all classes" />
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <EntityActionBar entityLabel="Section" createHref={canCreate ? '/dashboard/academics/sections/create' : undefined} onRefresh={() => void load(page, search)} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by section, class, year..."
            className="h-10 w-full max-w-xs rounded-xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all"
          />
        </div>

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <School className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">{search ? 'No sections match your search' : 'No sections yet'}</p>
            {canCreate && (
              <EAButton className="mt-4" onClick={() => router.push('/dashboard/academics/sections/create')}>
                <Plus className="h-4 w-4 mr-1.5" />Create Section
              </EAButton>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(r => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 h-full flex flex-col">
                  <Link href={`/dashboard/academics/sections/${r.id}`} className="flex-1">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <p className="text-base font-bold text-foreground truncate">{r.name}</p>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border shrink-0', r.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', r.status === 'ACTIVE' ? 'bg-cli-emerald' : 'bg-muted-foreground')} />{r.status}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-purple/10 flex items-center justify-center"><School className="h-4 w-4 text-cli-purple" /></div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{r.class?.name || '—'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Class</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cli-emerald/10 flex items-center justify-center"><Users className="h-4 w-4 text-cli-emerald" /></div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{r._count?.studentEnrollments ?? '—'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Students</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/60">
                    <Link href={`/dashboard/academics/sections/${r.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Eye className="h-3 w-3" />View</Link>
                    {canArchive && (
                      <button onClick={() => setDeleteConfirm(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Trash2 className="h-3 w-3" />Archive</button>
                    )}
                    <Link href={`/dashboard/academics/classes/${r.class?.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><ArrowRight className="h-3 w-3" />Class</Link>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-mono text-muted-foreground">{total} sections</p>
                <div className="flex items-center gap-2">
                  <EAButton variant="secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p, search); }}><ChevronLeft className="h-4 w-4" /></EAButton>
                  <span className="text-xs font-mono text-muted-foreground">{page} / {totalPages}</span>
                  <EAButton variant="secondary" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p, search); }}><ChevronRight className="h-4 w-4" /></EAButton>
                </div>
              </div>
            )}
          </>
        )}

        <ConfirmDialog open={!!deleteConfirm} title="Archive Section" message="Archive this section?" confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      </div>
    </>
  );
}
