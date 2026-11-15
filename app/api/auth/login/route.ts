import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { createSessionClient, lookupAccount } from '@/lib/auth/server';
import { handleLoginRequest, persistAuthorizedSession } from '@/lib/auth/core';

export async function POST(request: Request) {
  try {
    const { url, key } = getSupabaseConfig();
    const transient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    return handleLoginRequest(request, {
      signIn: async (email, password) => {
        const { data, error } = await transient.auth.signInWithPassword({ email, password });
        if (error) {
          if (['invalid_credentials', 'email_not_confirmed', 'user_not_found'].includes(error.code ?? '')) return null;
          throw error;
        }
        if (!data.user || !data.session) return null;
        return { userId: data.user.id, accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
      },
      verifyIdentity: async (token) => {
        const { data, error } = await transient.auth.getUser(token);
        if (error) throw error;
        return data.user?.id ?? null;
      },
      lookupAccount,
      persistSession: async (access_token, refresh_token) => {
        const client = await createSessionClient(true);
        await persistAuthorizedSession(client, access_token, refresh_token);
      },
      revokeSession: async () => { await transient.auth.signOut({ scope: 'local' }); },
    });
  } catch {
    return Response.json({ error: 'Sign-in is temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
