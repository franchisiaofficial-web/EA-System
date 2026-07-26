import { LogoutButton } from '@/components/auth/LogoutButton';
import type { AuthContext } from '@/lib/auth/context';

export function UserMenu({ authCtx }: { authCtx: AuthContext }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-[#E5E7EB] dark:border-[#2A2F36] p-3">
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <div className="h-7 w-7 rounded-full bg-cli-emerald/20 flex items-center justify-center text-xs font-mono font-bold text-[#111827] dark:text-[#FAFAFA]">
          {authCtx.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#111827] dark:text-[#FAFAFA] truncate">
            {authCtx.email}
          </p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
            {authCtx.role.replace(/_/g, ' ')}
          </p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
