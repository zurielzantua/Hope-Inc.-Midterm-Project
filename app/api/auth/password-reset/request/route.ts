import { handlePasswordResetRequest } from '@/lib/auth/password-reset';
import { passwordResetDependencies } from '@/lib/auth/password-reset-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handlePasswordResetRequest(request, passwordResetDependencies());
}
