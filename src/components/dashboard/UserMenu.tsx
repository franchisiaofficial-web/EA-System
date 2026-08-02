import { LogoutButton } from "@/components/auth/LogoutButton";
import type { AuthContext } from "@/lib/auth/context";

export function UserMenu({ authCtx, collapsed }: { authCtx: AuthContext; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-mono font-bold text-foreground">
          {authCtx.email.charAt(0).toUpperCase()}
        </div>
        <LogoutButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-mono font-bold text-foreground shrink-0">
        {authCtx.email.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{authCtx.email}</p>
        <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider">{authCtx.role.replace(/_/g, " ")}</p>
      </div>
      <LogoutButton />
    </div>
  );
}
