'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/crud/DataTable';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface Class { id: string; name: string; gradeLevel: string | null; status: string; }

export function ClassList({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: '10' });
    if (s) params.set('search', s);
    const res = await fetch(`/api/classes?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error('Failed to load');
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/classes?id=${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (r.success) { toast.success('Archived'); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || 'Failed');
  };

  const columns: Column<Class>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'gradeLevel', header: 'Grade', render: (r) => <span className="text-muted-foreground">{r.gradeLevel || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${r.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'ACTIVE' ? 'bg-cli-emerald' : 'bg-muted-foreground'}`} />{r.status}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Classes</h1>
      <EntityActionBar entityLabel="Class" createHref={canCreate ? '/dashboard/academics/classes/create' : undefined} onRefresh={() => void load(page, search)} />
      <DataTable columns={columns} data={items} total={total} page={page} pageSize={10} totalPages={totalPages}
        searchPlaceholder="Search classes..." onSearch={setSearch} onPageChange={setPage}
        renderActions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            {canUpdate && <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/academics/classes/${row.id}/edit`)}><Pencil className="h-3.5 w-3.5" /></Button>}
            {canArchive && <Button variant="ghost" size="xs" onClick={() => setDeleteConfirm(row.id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
          </div>
        )} />
      <ConfirmDialog open={!!deleteConfirm} title="Archive Class" message="Archive this class?" confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  );
}
