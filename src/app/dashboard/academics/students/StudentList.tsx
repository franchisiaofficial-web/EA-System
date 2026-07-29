'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/crud/DataTable';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface StudentItem { id: string; firstName: string; lastName: string; admissionNumber: string; status: string; gender: string | null; }

export function StudentList({ canCreate, canUpdate, canArchive }: { canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<StudentItem[]>([]);
  const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(''); const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: '20' });
    if (s) params.set('search', s);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error('Failed to load');
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search); } }, [page, search, load]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (r.success) { toast.success('Archived'); setDeleteConfirm(null); void load(page, search); }
    else toast.error(r.error?.message || 'Failed');
  };

  const columns: Column<StudentItem>[] = [
    { key: 'admissionNumber', header: 'Adm #', sortable: true, render: (r) => <span className="font-mono font-medium">{r.admissionNumber}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span>{r.firstName} {r.lastName}</span> },
    { key: 'gender', header: 'Gender', render: (r) => <span className="text-muted-foreground">{r.gender || '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${r.status === 'ACTIVE' ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'ACTIVE' ? 'bg-cli-emerald' : 'bg-muted-foreground'}`} />{r.status}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Students</h1>
      <EntityActionBar entityLabel="Student" createHref={canCreate ? '/dashboard/academics/students/create' : undefined} onRefresh={() => void load(page, search)} />
      <DataTable columns={columns} data={items} total={total} page={page} pageSize={20} totalPages={totalPages}
        searchPlaceholder="Search by name or admission #..." onSearch={setSearch} onPageChange={setPage}
        renderActions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/academics/students/${row.id}`)} aria-label="View"><Eye className="h-3.5 w-3.5" /></Button>
            {canUpdate && <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/academics/students/${row.id}/edit`)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
            {canArchive && <Button variant="ghost" size="xs" onClick={() => setDeleteConfirm(row.id)} aria-label="Archive"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
          </div>
        )} />
      <ConfirmDialog open={!!deleteConfirm} title="Archive Student" message="Archive this student? They will be hidden from default lists." confirmLabel="Archive" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  );
}
