'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/crud/DataTable';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface DemoItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string;
}

export function CrudDemoList() {
  const router = useRouter();
  const [items, setItems] = useState<DemoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: '10' });
    if (s) params.set('search', s);
    const res = await fetch(`/api/crud-demo?${params}`);
    const data = await res.json();
    if (data.success) {
      setItems(data.data.items);
      setTotal(data.data.total);
      setTotalPages(data.data.totalPages);
    } else {
      toast.error('Failed to load data');
    }
  }, []);

  useEffect(() => {
    if (!didLoad.current) { didLoad.current = true; void load(page, search); }
  }, [page, search, load]);

  const handleChangePage = (p: number) => { setPage(p); void load(p, search); };
  const handleSearch = (s: string) => { setSearch(s); void load(1, s); setPage(1); };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/crud-demo?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) { toast.success('Item archived'); setDeleteConfirm(null); void load(page, search); }
    else { toast.error(result.error?.message || 'Failed to archive'); }
  };

  const columns: Column<DemoItem>[] = [
    { key: 'title', header: 'Title', sortable: true, render: (r) => <span className="font-medium">{r.title}</span> },
    { key: 'category', header: 'Category', sortable: true, render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.category}</span> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{r.description || '\u2014'}</span> },
    { key: 'isActive', header: 'Active', render: (r) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${r.isActive ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-cli-emerald' : 'bg-muted-foreground'}`} />
        {r.isActive ? 'Active' : 'Inactive'}
      </span>
    ) },
    { key: 'createdAt', header: 'Created', render: (r) => <span className="font-mono text-xs">{new Date(r.createdAt).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRUD Demo</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">internal &bull; infrastructure reference</p>
      </div>
      <EntityActionBar entityLabel="Demo Item" createHref="/dashboard/internal/crud-demo/create" onRefresh={() => void load(page, search)} selectedCount={selectedIds.length} />
      <DataTable columns={columns} data={items} total={total} page={page} pageSize={10} totalPages={totalPages}
        searchPlaceholder="Search demo items..." onSearch={handleSearch} onPageChange={handleChangePage}
        getId={(r) => r.id} selectedIds={selectedIds}
        onSelectAll={(checked) => setSelectedIds(checked ? items.map(i => i.id) : [])}
        onSelectOne={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
        renderActions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/internal/crud-demo/${row.id}`)} aria-label="View"><Eye className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/internal/crud-demo/${row.id}/edit`)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="xs" onClick={() => setDeleteConfirm(row.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-foreground" /></Button>
          </div>
        )}
      />
      <ConfirmDialog open={!!deleteConfirm} title="Archive Item" message="Are you sure you want to archive this item?" confirmLabel="Archive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  );
}
