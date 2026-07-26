import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AuthContext } from '@/lib/auth/context';
import { NavItems } from './NavItems';
import { UserMenu } from './UserMenu';

export function Sidebar({
  authCtx,
  mobileOpen,
  onClose,
}: {
  authCtx: AuthContext;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 border-r border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] transform transition-transform duration-200 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 border-b border-[#E5E7EB] dark:border-[#2A2F36]">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 font-mono text-base font-bold text-[#111827] dark:text-[#FAFAFA]"
        >
          <span className="text-cli-emerald">{'\u276F'}</span> EA System
        </Link>
      </div>

      <NavItems role={authCtx.role} onItemClick={onClose} />

      <UserMenu authCtx={authCtx} />
    </aside>
  );
}
