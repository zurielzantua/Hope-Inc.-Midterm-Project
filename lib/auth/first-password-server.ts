import { randomUUID } from 'node:crypto';
import { accountDecision, readSetupCompletion, readVerifiedSetupSession } from '@/lib/auth/core';
import { authorizeRequest, createSessionClient, lookupAccount } from '@/lib/auth/server';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { createSupabaseAdminClient, createSupabasePublicServerClient } from '@/lib/supabase/server';
import { isInvalidInviteError } from '@/lib/auth/first-password';

const setupSessionRecoveryGraceSeconds = 5 * 60;

function adminClient() {
  const { url, key } = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Server authentication configuration missing');
  return createSupabaseAdminClient(url, secret, key);
}

function isMissingSession(error: { status?: number }) {
  return [400, 401, 403].includes(error.status ?? 0);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function loadTarget(userId: string) {
  const account = await lookupAccount(userId);
  if (!account) return null;
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin.from('app_user')
    .select('auth_user_id,email,first_password_setup_claim_id').eq('auth_user_id', userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) throw error ?? new Error('Auth identity missing');
  return {
    authUserId: profile.auth_user_id,
    email: profile.email,
    authEmail: data.user.email ?? null,
    emailConfirmedAt: data.user.email_confirmed_at ?? null,
    setupClaimId: profile.first_password_setup_claim_id ?? null,
    setupSessionId: typeof data.user.app_metadata?.hope_first_password_session === 'string'
      ? data.user.app_metadata.hope_first_password_session
      : null,
    setupSessionExpiresAt: typeof data.user.app_metadata?.hope_first_password_session_expires_at === 'number'
      ? data.user.app_metadata.hope_first_password_session_expires_at
      : null,
    account,
    authUser: data.user,
  };
}

async function readSetupClaim(userId: string) {
  const { data, error } = await adminClient().from('app_user')
    .select('first_password_setup_claim_id').eq('auth_user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.first_password_setup_claim_id ?? null;
}

async function releaseSetupClaimIfCurrent(userId: string, claimId: string) {
  const { data, error } = await adminClient().rpc('release_first_password_setup', {
    p_auth_user_id: userId,
    p_claim_id: claimId,
  });
  if (error) throw error;
  return data === true;
}

async function releaseSetupClaim(userId: string, claimId: string) {
  if (!await releaseSetupClaimIfCurrent(userId, claimId)) throw new Error('Setup claim could not be released');
}

function isSetupComplete(userId: string, user: unknown) {
  if (readSetupCompletion(user, userId) !== true || !user || typeof user !== 'object' || Array.isArray(user)) return false;
  const metadata = (user as { app_metadata?: Record<string, unknown> }).app_metadata;
  return metadata?.hope_first_password_session == null && metadata?.hope_first_password_session_expires_at == null;
}

export function firstPasswordDependencies() {
  return {
    enabled: process.env.HOPE_FIRST_PASSWORD_SETUP_ENABLED === 'true',
    appOrigin: process.env.HOPE_APP_URL,
    authorizeIssuer: authorizeRequest,
    lookupAccount,
    loadTarget,
    async recoverStaleSetupClaim(userId: string, claimId: string) {
      const target = await loadTarget(userId);
      if (
        !target || target.authUserId !== userId || target.setupClaimId !== claimId ||
        !target.setupSessionId || target.setupSessionExpiresAt === null ||
        accountDecision(target.account) !== 'setup-required' || readSetupCompletion(target.authUser, userId) !== false
      ) return false;

      const now = Math.floor(Date.now() / 1000);
      if (target.setupSessionExpiresAt > now - setupSessionRecoveryGraceSeconds) return false;

      return releaseSetupClaimIfCurrent(userId, claimId);
    },
    async prepareInvitation(userId: string, type: 'invite' | 'magiclink', expiresAt: number) {
      const target = await loadTarget(userId);
      const now = Math.floor(Date.now() / 1000);
      const expectedType = target?.emailConfirmedAt === null ? 'invite' : 'magiclink';
      if (
        !target || accountDecision(target.account) !== 'setup-required' ||
        target.email.trim().toLowerCase() !== target.authEmail?.trim().toLowerCase() ||
        target.setupClaimId !== null ||
        expectedType !== type || expiresAt <= now || expiresAt > now + 3600 ||
        readSetupCompletion(target.authUser, userId) !== false
      ) throw new Error('Account is no longer eligible');

      const invitationId = randomUUID();
      const { data, error } = await adminClient().auth.admin.updateUserById(userId, {
        app_metadata: {
          ...target.authUser.app_metadata,
          hope_first_password_session: null,
          hope_first_password_session_expires_at: null,
          hope_first_password_invitation_id: invitationId,
          hope_first_password_invitation_type: type,
          hope_first_password_invitation_expires_at: expiresAt,
        },
      });
      const metadata = data.user?.app_metadata;
      if (error || metadata?.hope_first_password_invitation_id !== invitationId || metadata?.hope_first_password_invitation_type !== type || metadata?.hope_first_password_invitation_expires_at !== expiresAt) {
        throw error ?? new Error('Invitation authorization was not saved');
      }
      return invitationId;
    },
    async sendInvite(email: string, redirectTo: string, userId: string, type: 'invite' | 'magiclink', invitationId: string) {
      const target = await loadTarget(userId);
      const metadata = target?.authUser.app_metadata;
      const now = Math.floor(Date.now() / 1000);
      if (
        !target || target.email.trim().toLowerCase() !== email.trim().toLowerCase() ||
        metadata?.hope_first_password_invitation_id !== invitationId || metadata?.hope_first_password_invitation_type !== type ||
        typeof metadata.hope_first_password_invitation_expires_at !== 'number' || metadata.hope_first_password_invitation_expires_at <= now ||
        target.setupClaimId !== null ||
        accountDecision(target.account) !== 'setup-required'
      ) throw new Error('Invitation authorization expired');

      if (type === 'invite') {
        if (target.emailConfirmedAt !== null) throw new Error('The identity is already confirmed');
        const { data, error } = await adminClient().auth.admin.inviteUserByEmail(email, { redirectTo });
        if (error) throw error;
        return data.user?.id ?? null;
      }

      if (!target.emailConfirmedAt) throw new Error('The identity must be confirmed before reissuing setup');
      const { error } = await createSupabasePublicServerClient().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      return userId;
    },
    async clearInvitation(userId: string, invitationId: string) {
      const admin = adminClient();
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) throw error;
      if (data.user?.app_metadata?.hope_first_password_invitation_id !== invitationId) return;
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...data.user.app_metadata,
          hope_first_password_invitation_id: null,
          hope_first_password_invitation_type: null,
          hope_first_password_invitation_expires_at: null,
        },
      });
      if (updateError) throw updateError;
    },
    async verifyInvite(tokenHash: string, type: 'invite' | 'magiclink', expectedInvitationId?: string) {
      const client = await createSessionClient(true);
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        if (isInvalidInviteError(error)) return null;
        throw error;
      }
      if (!data.session) return null;
      const token = data.session.access_token;
      const { data: verified, error: claimsError } = await client.auth.getClaims(token);
      const claims = verified?.claims as { sub?: unknown; session_id?: unknown; exp?: unknown } | undefined;
      const now = Math.floor(Date.now() / 1000);
      const { data: authData, error: authError } = data.user ? await adminClient().auth.admin.getUserById(data.user.id) : { data: { user: null }, error: null };
      const metadata = authData.user?.app_metadata;
      const invitationId = metadata?.hope_first_password_invitation_id;
      if (claimsError || authError || !data.user || data.user.id !== data.session.user.id || claims?.sub !== data.user.id || typeof claims.session_id !== 'string' || !claims.session_id || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now ||
        readSetupCompletion(authData.user, data.user.id) !== false || !isUuid(invitationId) || (expectedInvitationId && invitationId !== expectedInvitationId) || metadata?.hope_first_password_invitation_type !== type || typeof metadata.hope_first_password_invitation_expires_at !== 'number' || metadata.hope_first_password_invitation_expires_at <= now) {
        try { await adminClient().auth.admin.signOut(token, 'global'); } catch { /* The incomplete marker still denies ERP access. */ }
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* No setup binding was saved. */ }
        throw new Error('Invitation session could not be verified');
      }
      const target = await loadTarget(data.user.id);
      if (!target || !target.emailConfirmedAt || target.email.trim().toLowerCase() !== target.authEmail?.trim().toLowerCase()) {
        try { await adminClient().auth.admin.signOut(token, 'global'); } catch { /* The incomplete marker still denies ERP access. */ }
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* No setup binding was saved. */ }
        return null;
      }
      return {
        userId: data.user.id,
        accessToken: token,
        sessionId: claims.session_id,
        expiresAt: Math.min(claims.exp, metadata.hope_first_password_invitation_expires_at, now + 3600),
        type,
        invitationId,
      };
    },
    async verifyInviteSession(accessToken: string, refreshToken: string, expectedInvitationId?: string) {
      const client = await createSessionClient(true);
      const clearSession = async (token?: string) => {
        if (token) {
          try { await adminClient().auth.admin.signOut(token, 'global'); } catch { /* The incomplete marker still denies ERP access. */ }
        }
        try { await client.auth.signOut({ scope: 'local' }); } catch { /* No setup binding was saved. */ }
      };
      const { data: sessionData, error: sessionError } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        await clearSession();
        if (isMissingSession(sessionError)) return null;
        throw sessionError;
      }
      const session = sessionData.session;
      if (!session || !sessionData.user) {
        await clearSession(session?.access_token);
        return null;
      }

      const token = session.access_token;
      const [{ data: userData, error: userError }, { data: claimsData, error: claimsError }] = await Promise.all([
        client.auth.getUser(token),
        client.auth.getClaims(token),
      ]);
      if (userError || claimsError || !userData.user) {
        await clearSession(token);
        const authError = userError ?? claimsError;
        if (authError && isMissingSession(authError)) return null;
        throw authError ?? new Error('Invite session could not be verified');
      }

      const userId = userData.user.id;
      const claims = claimsData?.claims as { sub?: unknown; session_id?: unknown; exp?: unknown } | undefined;
      const now = Math.floor(Date.now() / 1000);
      if (session.user.id !== userId || claims?.sub !== userId || typeof claims.session_id !== 'string' || !claims.session_id ||
          typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now) {
        await clearSession(token);
        return null;
      }

      let target: Awaited<ReturnType<typeof loadTarget>>;
      try { target = await loadTarget(userId); }
      catch (error) { await clearSession(token); throw error; }
      const metadata = target?.authUser.app_metadata;
      const type = metadata?.hope_first_password_invitation_type;
      const invitationId = metadata?.hope_first_password_invitation_id;
      const invitationExpiresAt = metadata?.hope_first_password_invitation_expires_at;
      if (!target || target.authUserId !== userId || !target.emailConfirmedAt || target.email.trim().toLowerCase() !== target.authEmail?.trim().toLowerCase() ||
          target.setupClaimId !== null || accountDecision(target.account) !== 'setup-required' ||
          readSetupCompletion(target.authUser, userId) !== false ||
          !isUuid(invitationId) || (expectedInvitationId && invitationId !== expectedInvitationId) || !['invite', 'magiclink'].includes(String(type)) ||
          typeof invitationExpiresAt !== 'number' || invitationExpiresAt <= now) {
        await clearSession(token);
        return null;
      }

      return {
        userId,
        accessToken: token,
        sessionId: claims.session_id,
        expiresAt: Math.min(claims.exp, invitationExpiresAt, now + 3600),
        type: type as 'invite' | 'magiclink',
        invitationId,
      };
    },
    async getSetupSession() {
      const client = await createSessionClient(true);
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        if (isMissingSession(sessionError)) return null;
        throw sessionError;
      }
      if (!sessionData.session) return null;
      const session = sessionData.session;
      const { data, error } = await client.auth.getUser(session.access_token);
      if (error) {
        if (isMissingSession(error)) return null;
        throw error;
      }
      if (!data.user || data.user.id !== session.user.id) return null;
      const { data: verified, error: claimsError } = await client.auth.getClaims(session.access_token);
      if (claimsError) {
        if (isMissingSession(claimsError)) return null;
        throw claimsError;
      }
      const { data: authData, error: authError } = await adminClient().auth.admin.getUserById(data.user.id);
      if (authError) throw authError;
      const sessionId = readVerifiedSetupSession(verified?.claims, authData.user, data.user.id);
      if (!sessionId) return null;
      return { userId: data.user.id, accessToken: session.access_token, sessionId };
    },
    async claimSetup(userId: string, sessionId: string) {
      if (accountDecision(await lookupAccount(userId)) !== 'setup-required') throw new Error('Account is no longer eligible');
      const admin = adminClient();
      const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
      if (authError || readVerifiedSetupSession({ sub: userId, session_id: sessionId }, authData.user, userId) !== sessionId) {
        throw authError ?? new Error('Setup session is no longer valid');
      }
      const claimId = randomUUID();
      const { data, error } = await admin.rpc('claim_first_password_setup', {
        p_auth_user_id: userId,
        p_claim_id: claimId,
      });
      if (error) throw error;
      return data === claimId ? claimId : null;
    },
    async releaseSetupClaim(userId: string, claimId: string) {
      const { data, error } = await adminClient().rpc('release_first_password_setup', {
        p_auth_user_id: userId,
        p_claim_id: claimId,
      });
      if (error || data !== true) throw error ?? new Error('Setup claim could not be released');
    },
    async markSetupSession(userId: string, sessionId: string, expiresAt: number, type: 'invite' | 'magiclink', invitationId: string) {
      if (accountDecision(await lookupAccount(userId)) !== 'setup-required') throw new Error('Account is no longer eligible');
      const admin = adminClient();
      const { data, error } = await admin.auth.admin.getUserById(userId);
      const currentMetadata = data.user?.app_metadata;
      const now = Math.floor(Date.now() / 1000);
      if (error || readSetupCompletion(data.user, userId) !== false || currentMetadata?.hope_first_password_invitation_id !== invitationId || currentMetadata.hope_first_password_invitation_type !== type || typeof currentMetadata.hope_first_password_invitation_expires_at !== 'number' || currentMetadata.hope_first_password_invitation_expires_at <= now || expiresAt > currentMetadata.hope_first_password_invitation_expires_at) {
        throw error ?? new Error('Setup state unavailable');
      }
      const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...data.user!.app_metadata,
          hope_first_password_invitation_id: null,
          hope_first_password_invitation_type: null,
          hope_first_password_invitation_expires_at: null,
          hope_first_password_session: sessionId,
          hope_first_password_session_expires_at: expiresAt,
        },
      });
      if (updateError || readVerifiedSetupSession({ sub: userId, session_id: sessionId }, updated.user, userId) !== sessionId) {
        throw updateError ?? new Error('Setup session was not saved');
      }
    },
    async completeSetup(userId: string, password: string, sessionId: string, claimId: string): Promise<'completed' | 'invalid' | 'rejected'> {
      if (accountDecision(await lookupAccount(userId)) !== 'setup-required') throw new Error('Account is no longer eligible');
      const admin = adminClient();
      const { data, error: authError } = await admin.auth.admin.getUserById(userId);
      if (authError || !data.user || readVerifiedSetupSession({ sub: userId, session_id: sessionId }, data.user, userId) !== sessionId) {
        throw authError ?? new Error('Setup session is no longer valid');
      }
      if (await readSetupClaim(userId) !== claimId) throw new Error('Setup claim is no longer valid');

      const app_metadata = {
        ...data.user.app_metadata,
        hope_first_password_complete: true,
        hope_first_password_invitation_id: null,
        hope_first_password_invitation_type: null,
        hope_first_password_invitation_expires_at: null,
        hope_first_password_session: null,
        hope_first_password_session_expires_at: null,
      };
      let update: Awaited<ReturnType<typeof admin.auth.admin.updateUserById>>;
      try {
        update = await admin.auth.admin.updateUserById(userId, { password, app_metadata });
      } catch (error) {
        // A lost response may follow a committed Auth transaction; reconcile its atomic marker.
        try {
          const current = await admin.auth.admin.getUserById(userId);
          if (isSetupComplete(userId, current.data.user)) return 'completed';
        } catch { /* Preserve the claim while Auth outcome is uncertain. */ }
        throw error;
      }

      if (update.error) {
        if (update.error.code === 'weak_password' || update.error.status === 422) return 'invalid';
        try {
          const current = await admin.auth.admin.getUserById(userId);
          if (isSetupComplete(userId, current.data.user)) return 'completed';
        } catch { /* Preserve the claim while Auth outcome is uncertain. */ }
        if (typeof update.error.status === 'number' && update.error.status >= 400 && update.error.status < 500) return 'rejected';
        throw update.error;
      }

      if (isSetupComplete(userId, update.data.user)) return 'completed';
      const current = await admin.auth.admin.getUserById(userId);
      if (isSetupComplete(userId, current.data.user)) return 'completed';
      throw current.error ?? new Error('Password and completion marker were not confirmed');
    },
    async revokeRefreshTokens(accessToken: string) {
      const { error } = await adminClient().auth.admin.signOut(accessToken, 'global');
      // Updating a password can revoke its setup session before this explicit cleanup.
      if (error && error.code !== 'session_not_found') throw error;
    },
    async clearLocalSession() {
      const client = await createSessionClient(true);
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
  };
}
