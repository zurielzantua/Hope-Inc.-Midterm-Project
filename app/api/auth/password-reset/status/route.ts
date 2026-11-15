import { handlePasswordResetStatus } from '@/lib/auth/password-reset';
import { passwordResetDependencies } from '@/lib/auth/password-reset-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handlePasswordResetStatus(passwordResetDependencies());
}
