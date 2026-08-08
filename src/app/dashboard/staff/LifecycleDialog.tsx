"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LifecycleDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  requiresReason?: boolean;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function LifecycleDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  requiresReason = false,
  reasonPlaceholder = "Provide a reason for this action...",
  onConfirm,
  onCancel,
}: LifecycleDialogProps) {
  const [reason, setReason] = useState("");
  if (!open) return null;

  const confirmDisabled = requiresReason && reason.trim().length < 10;

  const handleConfirm = () => {
    if (confirmDisabled) return;
    onConfirm(requiresReason ? reason.trim() : undefined);
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
          <AlertTriangle className={cn("h-6 w-6", destructive ? "text-cli-rose" : "text-cli-blue")} />
        </div>
        <h3 className="text-lg font-bold text-center text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-center text-muted-foreground">{message}</p>
        {requiresReason && (
          <div className="mt-4">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cli-blue/30"
            />
            <p className="mt-1 text-[10px] font-mono text-muted-foreground/60">
              {reason.trim().length < 10
                ? `Reason is required (${reason.trim().length}/10 characters)`
                : "Reason recorded in the audit log"}
            </p>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button
            className={cn("flex-1", destructive ? "bg-cli-rose hover:bg-cli-rose/90 text-white" : "bg-primary hover:bg-primary/90 text-primary-foreground")}
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
