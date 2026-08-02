import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'settings', 'read')) redirect('/login');
  return (
    <SettingsClient
      canEdit={hasPermission(authCtx.role, 'settings', 'update')}
    />
  );
}
