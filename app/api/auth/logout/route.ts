import { createSessionClient } from '@/lib/auth/server';
import { handleLogoutRequest } from '@/lib/auth/core';

export async function POST() {
  return handleLogoutRequest(async () => {
    const client = await createSessionClient(true);
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  });
}
