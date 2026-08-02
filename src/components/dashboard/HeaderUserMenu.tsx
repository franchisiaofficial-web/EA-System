'use client';

import { useState, useEffect, useRef } from 'react';
import type { AuthContext } from '@/lib/auth/context';
import { LogoutButton } from '@/components/auth/LogoutButton';

export function HeaderUserMenu({ authCtx }: { authCtx: AuthContext }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs font-mono font-bold text-foreground hover:bg-foreground/[0.2] transition-colors"
        aria-label="User menu"
        aria-expanded={open}
      >
        {authCtx.email.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-2xl shadow-black/40 z-50">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-xs font-mono font-bold text-foreground shrink-0">
                {authCtx.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {authCtx.email}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">
                  {authCtx.role.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
          <div className="p-1.5">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
