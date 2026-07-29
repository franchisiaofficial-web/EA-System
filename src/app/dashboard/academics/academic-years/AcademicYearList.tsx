'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/crud/DataTable';
import { EntityActionBar } from '@/components/crud/EntityActionBar';
import { ConfirmDialog } from '@/components/crud/ConfirmDialog';
import { Button } from '@/components/ui/button';

interface AcademicYearItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: string;
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
    const res = await fetch(`/api/academic-years?${params}`);
    const data = await res.json();
    if (data.success) {
      setItems(data.data.items);
      setTotal(data.data.total);
      setTotalPages(data.data.totalPages);
    } else {
      toast.error('Failed to load academic years');
    }
  }, []);

  useEffect(() => {
    if (!didLoad.current) { didLoad.current = true; void load(page, search); }
  }, [page, search, load]);

  const handleChangePage = (p: number) => { setPage(p); void load(p, search); };
  const handleSearch = (s: string) => { setSearch(s); void load(1, s); setPage(1); };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/academic-years?id=${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) { toast.success('Academic year archived'); setDeleteConfirm(null); void load(page, search); }
    else { toast.error(result.error?.message || 'Failed to archive'); }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const columns: Column<AcademicYearItem>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'startDate', header: 'Start Date', render: (r) => <span className="font-mono text-xs">{formatDate(r.startDate)}</span> },
    { key: 'endDate', header: 'End Date', render: (r) => <span className="font-mono text-xs">{formatDate(r.endDate)}</span> },
    { key: 'isActive', header: 'Active', render: (r) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border ${r.isActive ? 'bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-cli-emerald' : 'bg-muted-foreground'}`} />
        {r.isActive ? 'Active' : 'Inactive'}
      </span>
    ) },
    { key: 'status', header: 'Status', render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.status}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Academic Years</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">academics &bull; manage school years</p>
      </div>
      <EntityActionBar entityLabel="Academic Year" createHref={canCreate ? '/dashboard/academics/academic-years/create' : undefined} onRefresh={() => void load(page, search)} selectedCount={selectedIds.length} />
      <DataTable columns={columns} data={items} total={total} page={page} pageSize={10} totalPages={totalPages}
        searchPlaceholder="Search academic years..." onSearch={handleSearch} onPageChange={handleChangePage}
        getId={(r) => r.id} selectedIds={selectedIds}
        onSelectAll={(checked) => setSelectedIds(checked ? items.map(i => i.id) : [])}
        onSelectOne={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))}
        renderActions={(row) => (
          <div className="flex items-center gap-1 justify-end">
            {canUpdate && <Button variant="ghost" size="xs" onClick={() => router.push(`/dashboard/academics/academic-years/${row.id}/edit`)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
            {canArchive && <Button variant="ghost" size="xs" onClick={() => setDeleteConfirm(row.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}
          </div>
        )}
      />
      <ConfirmDialog open={!!deleteConfirm} title="Archive Academic Year" message="Are you sure you want to archive this academic year?" confirmLabel="Archive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  );
}
