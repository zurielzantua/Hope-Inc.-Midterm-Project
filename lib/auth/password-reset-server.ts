import { createSessionClient } from '@/lib/auth/server';
import { createSupabasePublicServerClient } from '@/lib/supabase/server';

function isSessionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { status?: unknown; code?: unknown };
  return [400, 401, 403].includes(Number(authError.status)) || authError.code === 'session_not_found';
}

function isWeakPasswordError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { status?: unknown; code?: unknown };
  return Number(authError.status) === 422 || authError.code === 'weak_password';
}

export function passwordResetDependencies() {
  return {
    appOrigin: process.env.HOPE_APP_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://127.0.0.1:3000'),
    async requestReset(email: string, redirectTo: string) {
      const { error } = await createSupabasePublicServerClient().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    async verifyRecovery(tokenHash: string, type: 'recovery') {
      const client = await createSessionClient(true);
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) throw error;
      if (!data.session) return false;
      if (!data.user) {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        return false;
      }

      const { data: verified, error: verificationError } = await client.auth.getUser();
      if (verificationError || verified.user?.id !== data.user.id) {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        if (verificationError) throw verificationError;
        return false;
      }
      return true;
    },
    async getRecoveryUser() {
      const client = await createSessionClient();
      const { data, error } = await client.auth.getUser();
      if (error) {
        if (isSessionError(error)) return false;
        throw error;
      }
      return Boolean(data.user);
    },
    async completeReset(password: string) {
      const client = await createSessionClient(true);
      const { data, error } = await client.auth.getUser();
      if (error) {
        if (isSessionError(error)) return { updated: false as const, reason: 'unauthenticated' as const };
        throw error;
      }
      if (!data.user) return { updated: false as const, reason: 'unauthenticated' as const };

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        if (isWeakPasswordError(updateError)) return { updated: false as const, reason: 'weak-password' as const };
        if (isSessionError(updateError)) return { updated: false as const, reason: 'unauthenticated' as const };
        throw updateError;
      }

      try {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        return { updated: true as const, signedOut: !signOutError };
      } catch {
        return { updated: true as const, signedOut: false };
      }
    },
  };
}
