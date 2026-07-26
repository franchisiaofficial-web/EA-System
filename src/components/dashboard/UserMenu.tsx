import { LogoutButton } from '@/components/auth/LogoutButton';
import type { AuthContext } from '@/lib/auth/context';

export function UserMenu({ authCtx }: { authCtx: AuthContext }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <div className="h-7 w-7 rounded-full bg-cli-emerald/20 flex items-center justify-center text-xs font-mono font-bold text-foreground">
          {authCtx.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">
            {authCtx.email}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono uppercase">
            {authCtx.role.replace(/_/g, ' ')}
          </p>
        </div>
      </div>
      <LogoutButton />
    </div>
  );
}
