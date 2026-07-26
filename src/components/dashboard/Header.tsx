import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { AuthContext } from '@/lib/auth/context';

export function Header({
  authCtx,
  onMenuOpen,
}: {
  authCtx: AuthContext;
  onMenuOpen: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#E5E7EB] dark:border-[#2A2F36] bg-white/80 dark:bg-[#14161A]/80 backdrop-blur-md px-4 lg:px-6">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-[#09090B]/50"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">
        {authCtx.role.replace(/_/g, ' ')}
      </span>
      <ThemeToggle />
    </header>
  );
}
