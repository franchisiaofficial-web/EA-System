'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Eye, Plus, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/ea/layout';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { EAButton } from '@/components/ui/ea';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StudentItem { id: string; firstName: string; lastName: string; admissionNumber: string; status: string; gender: string | null; enrollmentRecords?: { class?: { name: string }; section?: { name: string } }[] }

const NA = <span className="text-muted-foreground/70 font-mono text-xs">Not Assigned</span>;

export function StudentList({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<StudentItem[]>([]);
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(''); const [statusFilter, setStatusFilter] = useState(''); const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const didLoad = useRef(false);
  const reqId = useRef(0);

  const load = useCallback(async (p: number, s: string) => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), pageSize: '12' });
    if (s) params.set('search', s);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const res = await fetch(`/api/students?${params}`);
      const data = await res.json();
      if (data.success) {
        if (reqId.current !== id) return;
        setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages);
      } else if (reqId.current === id) toast.error('Failed to load');
    } catch { if (reqId.current === id) toast.error('Failed to load'); }
    finally { if (reqId.current === id) setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  useEffect(() => {
    if (!didLoad.current) return;
    const tid = setTimeout(() => { void load(1, search); setPage(1); }, 300);
    return () => clearTimeout(tid);
  }, [search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (r.success) { toast.success('Archived'); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || 'Failed');
  };

  return (
    <>
      <PageHeader title="Students" subtitle="academics &bull; manage student records" />
      <div className="space-y-6 w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <EntityActionBar entityLabel="Student" createHref={canCreate ? '/dashboard/academics/students/create' : undefined} onRefresh={() => void load(page, search)} />
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); void load(1, search); }}
              className="h-10 rounded-xl bg-card border border-border px-3 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all"
            >
              <option value="">Current Students</option>
              <option value="PASSED_OUT">Passed Out</option>
              <option value="ALL">All Statuses</option>
            </select>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or admission #..."
              className="h-10 w-full max-w-xs rounded-xl bg-card border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">{search ? 'No students match your search' : 'No students yet'}</p>
            {canCreate && (
              <EAButton className="mt-4" onClick={() => router.push('/dashboard/academics/students/create')}>
                <Plus className="h-4 w-4 mr-1.5" />Add Student
              </EAButton>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(r => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5 h-full flex flex-col">
                  <Link href={`/dashboard/academics/students/${r.id}`} className="flex-1">
                    <div className="flex items-center justify-between mb-4 gap-2">
                      <p className="text-base font-bold text-foreground truncate">{r.firstName} {r.lastName}</p>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border shrink-0',
                        r.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30'
                          : r.status === 'PASSED_OUT' ? 'bg-cli-amber/10 text-cli-amber border-cli-amber/30'
                          : 'bg-muted/50 text-muted-foreground border-border')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', r.status === 'ACTIVE' ? 'bg-cli-emerald' : r.status === 'PASSED_OUT' ? 'bg-cli-amber' : 'bg-muted-foreground')} />{r.status}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Admission No</p>
                        <p className="text-sm text-foreground font-medium font-mono">{r.admissionNumber}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Grade</p>
                        <p className="text-sm text-muted-foreground">{r.enrollmentRecords?.[0]?.class?.name || NA}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Section</p>
                        <p className="text-sm text-muted-foreground">{r.enrollmentRecords?.[0]?.section?.name || NA}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">Gender</p>
                        <p className="text-sm text-muted-foreground">{r.gender || '—'}</p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/60">
                    <Link href={`/dashboard/academics/students/${r.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Eye className="h-3 w-3" />View</Link>
                    {canUpdate && (
                      <Link href={`/dashboard/academics/students/${r.id}/edit`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Pencil className="h-3 w-3" />Edit</Link>
                    )}
                    {canArchive && (
                      <button onClick={() => setDeleteConfirm(r.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors"><Trash2 className="h-3 w-3" />Archive</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-mono text-muted-foreground">{total} students</p>
                <div className="flex items-center gap-2">
                  <EAButton variant="secondary" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p, search); }}><ChevronLeft className="h-4 w-4" /></EAButton>
                  <span className="text-xs font-mono text-muted-foreground">{page} / {totalPages}</span>
                  <EAButton variant="secondary" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p, search); }}><ChevronRight className="h-4 w-4" /></EAButton>
                </div>
              </div>
            )}
          </>
        )}

        <ConfirmDialog open={!!deleteConfirm} title="Archive Student" message="Archive this student? They will be hidden from default lists." confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      </div>
    </>
  );
}
