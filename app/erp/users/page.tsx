import { redirect } from 'next/navigation';
import { canAccessUserManagement } from '@/lib/auth/erp-modules';
import { loadCurrentErpModules } from '@/lib/auth/erp-modules-server';
import { ErpShell } from '../erp-shell';
import { UserManagementClient } from './user-management-client';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  const moduleAccess = await loadCurrentErpModules().catch(() => null);
  if (!moduleAccess) redirect('/');
  if (!canAccessUserManagement(moduleAccess.role)) redirect('/erp');

  return (
    <ErpShell
      role={moduleAccess.role}
      modules={moduleAccess.modules}
      currentPath="/erp/users"
      moduleLinksUnavailable={moduleAccess.unavailable}
    >
      <UserManagementClient actorRole={moduleAccess.role} actorUserId={moduleAccess.userId} />
    </ErpShell>
  );
}
