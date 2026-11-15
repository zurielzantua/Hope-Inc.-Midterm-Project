import { handleReadUserRights, handleSaveUserRights } from '@/lib/auth/user-rights';
import { userRightsDependencies } from '@/lib/auth/user-rights-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleReadUserRights(request, userRightsDependencies());
}

export async function PATCH(request: Request) {
  return handleSaveUserRights(request, userRightsDependencies());
}
