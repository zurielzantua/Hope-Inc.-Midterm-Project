import { handleUpdateManagedUser } from '@/lib/auth/user-management';
import { userManagementDependencies } from '@/lib/auth/user-management-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  return handleUpdateManagedUser(request, userManagementDependencies());
}
