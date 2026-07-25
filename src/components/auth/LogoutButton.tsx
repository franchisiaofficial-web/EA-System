'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { toast } from 'sonner';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted"
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  );
}
