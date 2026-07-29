'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/crud/DataTable';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Subject { id: string; name: string; code: string; description: string | null; isActive: boolean; }

export function SubjectList({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: '10' });
    if (s) params.set('search', s);
    const res = await fetch(`/api/subjects?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error('Failed to load');
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (r.success) { toast.success('Archived'); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || 'Failed');
  };

  const columns: Column<Subject>[] = [
    { key: 'code', header: 'Code', sortable: true, render: (r) => <span className="font-mono font-medium">{r.code}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span>{r.name}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-muted-foreground text-sm">{r.description || '—'}</span> },
    { key: 'isActive', header: 'Active', render: (r) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${r.isActive ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-cli-emerald' : 'bg-muted-foreground'}`} />{r.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Subjects</h1>
      <EntityActionBar entityLabel="Subject" createHref={canCreate ? '/dashboard/academics/subjects/create' : undefined} onRefresh={() => void load(page, search)} />
      <DataTable columns={columns} data={items} total={total} page={page} pageSize={10} totalPages={totalPages}
        searchPlaceholder="Search subjects..." onSearch={setSearch} onPageChange={setPage}
        renderActions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            {canUpdate && <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/academics/subjects/${row.id}/edit`)}><Pencil className="h-3.5 w-3.5" /></Button>}
            {canArchive && <Button variant="ghost" size="xs" onClick={() => setDeleteConfirm(row.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
          </div>
        )} />
      <ConfirmDialog open={!!deleteConfirm} title="Archive Subject" message="Archive this subject?" confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  );
}
