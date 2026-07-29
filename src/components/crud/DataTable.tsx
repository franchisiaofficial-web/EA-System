'use client';

import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  onPageChange?: (page: number) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  emptyMessage?: string;
  renderActions?: (row: T) => React.ReactNode;
  selectedIds?: string[];
  onSelectAll?: (checked: boolean) => void;
  onSelectOne?: (id: string, checked: boolean) => void;
  getId?: (row: T) => string;
}

export function DataTable<T>({
  columns, data, total, page, pageSize, totalPages,
  searchPlaceholder = 'Search...', onSearch, onSort, onPageChange,
  sortField, sortDirection, emptyMessage = 'No records found.',
  renderActions, selectedIds, onSelectAll, onSelectOne, getId,
}: DataTableProps<T>) {
  const showSelect = !!(onSelectAll && onSelectOne && getId);

  const toggleSort = (field: string) => {
    if (!onSort) return;
    const dir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(field, dir);
  };

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== -1) pages.push(-1);
  }

  return (
    <div className="space-y-4">
      {onSearch && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm text-foreground font-sans placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cli-emerald/50"
            />
          </div>
          <span className="text-xs text-muted-foreground font-mono">{total} record{total !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {showSelect && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="h-4 w-4 rounded accent-cli-emerald"
                      checked={selectedIds!.length === data.length && data.length > 0}
                      onChange={(e) => onSelectAll!(e.target.checked)} />
                  </th>
                )}
                {columns.map((col) => (
                  <th key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-wide',
                      col.sortable && 'cursor-pointer select-none hover:text-foreground',
                      col.className
                    )}
                    onClick={() => col.sortable && toggleSort(col.key)}>
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && sortField === col.key && (
                        sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
                {renderActions && (
                  <th className="px-4 py-3 text-right text-xs font-mono text-muted-foreground uppercase tracking-wide w-20">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (showSelect ? 1 : 0) + (renderActions ? 1 : 0)}
                    className="px-4 py-16 text-center text-sm text-muted-foreground font-mono">{emptyMessage}</td>
                </tr>
              ) : (
                data.map((row, i) => {
                  const id = getId?.(row);
                  return (
                    <tr key={id ?? i}
                      className={cn(
                        'border-b border-border last:border-0 hover:bg-muted/30 transition-colors',
                        selectedIds?.includes(id ?? '') && 'bg-cli-emerald/5'
                      )}>
                      {showSelect && (
                        <td className="px-4 py-3">
                          <input type="checkbox" className="h-4 w-4 rounded accent-cli-emerald"
                            checked={selectedIds!.includes(id!)}
                            onChange={(e) => onSelectOne!(id!, e.target.checked)} />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={cn('px-4 py-3 text-sm text-foreground', col.className)}>{col.render(row)}</td>
                      ))}
                      {renderActions && <td className="px-4 py-3 text-right">{renderActions(row)}</td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-mono">
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pages.map((p, i) =>
              p === -1 ? (
                <span key={`e-${i}`} className="px-1 text-muted-foreground font-mono text-xs">...</span>
              ) : (
                <Button key={p} variant={p === page ? 'default' : 'ghost'} size="xs"
                  className={cn(p === page && 'bg-cli-emerald text-foreground hover:bg-cli-emerald/80')}
                  onClick={() => onPageChange?.(p)}>{p}</Button>
              )
            )}
            <Button variant="ghost" size="xs" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
