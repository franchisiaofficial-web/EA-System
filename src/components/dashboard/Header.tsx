import { Menu, Search, Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { AuthContext } from '@/lib/auth/context';
import { Breadcrumbs } from './Breadcrumbs';
import { HeaderUserMenu } from './HeaderUserMenu';

export function Header({
  authCtx,
  onMenuOpen,
}: {
  authCtx: AuthContext;
  onMenuOpen: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-hover-surface"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Breadcrumbs />
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground font-mono">
        {authCtx.role.replace(/_/g, ' ')}
      </span>

      <button
        disabled
        className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
        title="Search — Available in a future update."
        aria-label="Search — Available in a future update"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        disabled
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed"
        title="Notifications — Available in a future update."
        aria-label="Notifications — Available in a future update"
      >
        <Bell className="h-4 w-4" />
      </button>

      <HeaderUserMenu authCtx={authCtx} />
      <ThemeToggle />
    </header>
  );
}
