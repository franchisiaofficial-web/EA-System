'use client';

import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EntityActionBarProps {
  entityLabel: string;
  createHref?: string;
  onRefresh?: () => void;
  selectedCount?: number;
  onBulkDelete?: () => void;
  className?: string;
}

export function EntityActionBar({
  entityLabel, createHref, onRefresh, selectedCount = 0, onBulkDelete, className,
}: EntityActionBarProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        {createHref && (
          <Link href={createHref}>
            <Button className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium gap-1.5">
              <Plus className="h-4 w-4" />New {entityLabel}
            </Button>
          </Link>
        )}
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      {selectedCount > 0 && onBulkDelete && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{selectedCount} selected</span>
          <Button variant="destructive" size="sm" onClick={onBulkDelete} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" />Delete
          </Button>
        </div>
      )}
    </div>
  );
}
