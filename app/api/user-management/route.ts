import { handleCreateManagedUser, handleListManagedUsers } from '@/lib/auth/user-management';
import { userManagementDependencies } from '@/lib/auth/user-management-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleListManagedUsers(userManagementDependencies());
}

export async function POST(request: Request) {
  return handleCreateManagedUser(request, userManagementDependencies());
}
