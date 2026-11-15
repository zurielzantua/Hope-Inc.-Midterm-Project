import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { authorizeSession, readSetupCompletion, readSetupJwtIdentity } from '@/lib/auth/core';

export async function createSessionClient(requireWritableCookies = false) {
  const { url, key } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try { for (const { name, value, options } of items) store.set(name, value, options); }
        catch (error) { if (requireWritableCookies) throw error; /* Proxy refreshes cookies for Server Components. */ }
      },
    },
  });
}

export async function lookupAccount(userId: string) {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  const admin = createSupabaseAdminClient(url, secret, key);
  const { data, error } = await admin.from('app_user')
    .select('account_state,is_blocked,is_deleted,role:role_id(role_code,is_deleted)')
    .eq('auth_user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const role = Array.isArray(data.role) ? data.role[0] : data.role;
  if (!role || typeof role !== 'object') return null;
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError) throw authError;
  // Read only server-controlled app metadata from the freshly fetched, matching Auth identity.
  const setup_complete = readSetupCompletion(authData.user, userId);
  return { account_state: data.account_state, is_blocked: data.is_blocked, is_deleted: data.is_deleted, role_code: role.role_code, role_is_deleted: role.is_deleted, setup_complete };
}

export async function authorizeRequest() {
  try {
    const client = await createSessionClient();
    const { data, error } = await client.auth.getClaims();
    if (error) return { allowed: false as const };
    const userId = readSetupJwtIdentity(data?.claims);
    if (!userId) return { allowed: false as const };
    return authorizeSession(async () => {
      return userId;
    }, lookupAccount);
  } catch {
    return { allowed: false as const };
  }
}
