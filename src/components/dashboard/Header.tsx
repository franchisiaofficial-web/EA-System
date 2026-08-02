import { Menu, Search, Bell, Sun, Moon } from "lucide-react";
import type { AuthContext } from "@/lib/auth/context";
import { useTheme } from "@/components/ui/theme-provider";
import { Breadcrumbs } from "./Breadcrumbs";
import { HeaderUserMenu } from "./HeaderUserMenu";

export function Header({ authCtx, onMenuOpen }: { authCtx: AuthContext; onMenuOpen: () => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      <button onClick={onMenuOpen} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <Breadcrumbs />
      <div className="flex-1" />
      <span className="text-xs text-muted-foreground font-mono hidden sm:inline">{authCtx.role.replace(/_/g, " ")}</span>

      <button disabled className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-muted/50 text-muted-foreground/40 cursor-not-allowed" title="Search — Coming soon">
        <Search className="h-4 w-4" />
      </button>
      <button disabled className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-muted/50 text-muted-foreground/40 cursor-not-allowed" title="Notifications — Coming soon">
        <Bell className="h-4 w-4" />
      </button>

      <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <HeaderUserMenu authCtx={authCtx} />
    </header>
  );
}
