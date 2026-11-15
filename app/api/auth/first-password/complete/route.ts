import { handleCompleteFirstPassword } from '@/lib/auth/first-password';
import { firstPasswordDependencies } from '@/lib/auth/first-password-server';

export async function POST(request: Request) {
  return handleCompleteFirstPassword(request, firstPasswordDependencies());
}
