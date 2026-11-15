import { handleFirstPasswordStatus } from '@/lib/auth/first-password';
import { firstPasswordDependencies } from '@/lib/auth/first-password-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleFirstPasswordStatus(firstPasswordDependencies());
}
