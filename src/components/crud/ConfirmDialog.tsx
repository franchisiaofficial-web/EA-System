'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', variant = 'destructive',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className={cn(
          'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
          variant === 'destructive' ? 'bg-rose-100 dark:bg-rose-900/20' : 'bg-cli-emerald/10'
        )}>
          <AlertTriangle className={cn('h-6 w-6', variant === 'destructive' ? 'text-rose-600 dark:text-rose-400' : 'text-cli-emerald')} />
        </div>
        <h3 className="text-lg font-bold text-center text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-center text-muted-foreground">{message}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className={cn('flex-1', variant === 'destructive' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-cli-emerald hover:bg-cli-emerald/80 text-foreground')} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
