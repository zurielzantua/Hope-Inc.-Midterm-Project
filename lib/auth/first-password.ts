import { accountDecision } from '@/lib/auth/core';

type Account = Parameters<typeof accountDecision>[0];
type SetupSession = { userId: string; accessToken: string; sessionId: string };
type VerifiedInvite = SetupSession & { expiresAt: number; type: 'invite' | 'magiclink'; invitationId: string };
type InviteTarget = {
  authUserId: string;
  email: string;
  authEmail: string | null;
  emailConfirmedAt: string | null;
  setupClaimId: string | null;
  account: Account;
};

type Dependencies = {
  enabled: boolean;
  appOrigin: string | undefined;
  authorizeIssuer: () => Promise<{ allowed: boolean; role?: string }>;
  loadTarget: (userId: string) => Promise<InviteTarget | null>;
  prepareInvitation: (userId: string, type: 'invite' | 'magiclink', expiresAt: number) => Promise<string>;
  sendInvite: (email: string, redirectTo: string, userId: string, type: 'invite' | 'magiclink', invitationId: string) => Promise<string | null>;
  clearInvitation: (userId: string, invitationId: string) => Promise<void>;
  verifyInvite: (tokenHash: string, type: 'invite' | 'magiclink', invitationId: string) => Promise<VerifiedInvite | null>;
  getSetupSession: () => Promise<SetupSession | null>;
  lookupAccount: (userId: string) => Promise<Account>;
  markSetupSession: (userId: string, sessionId: string, expiresAt: number, type: 'invite' | 'magiclink', invitationId: string) => Promise<void>;
  claimSetup: (userId: string, sessionId: string) => Promise<string | null>;
  releaseSetupClaim: (userId: string, claimId: string) => Promise<void>;
  setPassword: (userId: string, password: string, sessionId: string, claimId: string) => Promise<'success' | 'invalid'>;
  revokeRefreshTokens: (accessToken: string) => Promise<void>;
  clearLocalSession: () => Promise<void>;
  markSetupComplete: (userId: string, sessionId: string, claimId: string) => Promise<void>;
};

const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
});

const unavailable = () => json(503, { error: 'First-password setup is temporarily unavailable.' });
const forbidden = () => json(403, { error: 'This account is not eligible for first-password setup.' });
const conflict = () => json(409, { error: 'This account is not eligible for first-password setup.' });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setupRedirect(appOrigin: string | undefined) {
  try {
    if (!appOrigin) return null;
    const origin = new URL(appOrigin);
    const localHttp = process.env.NODE_ENV !== 'production' && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
    if ((!localHttp && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    return new URL('/set-password', origin.origin).toString();
  } catch {
    return null;
  }
}

function allowedPost(request: Request, redirectTo: string) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  return request.headers.get('origin') === new URL(redirectTo).origin && contentType === 'application/json';
}

export function isInvalidInviteError(error: unknown) {
  return isRecord(error) && ['otp_expired', 'invite_not_found', 'validation_failed'].includes(String(error.code));
}

export async function handleIssueFirstPasswordInvite(request: Request, deps: Dependencies) {
  if (!deps.enabled) return unavailable();
  const redirectTo = setupRedirect(deps.appOrigin);
  if (!redirectTo) return unavailable();
  if (!allowedPost(request, redirectTo)) return json(403, { error: 'Request not allowed.' });

  let issuer: { allowed: boolean; role?: string };
  try { issuer = await deps.authorizeIssuer(); } catch { return unavailable(); }
  if (!issuer.allowed) return json(401, { error: 'Sign in is required.' });
  if (issuer.role !== 'superadmin') return json(403, { error: 'Only an authorized Superadmin can issue setup invitations.' });

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Enter a valid account ID.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.authUserId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.authUserId)) {
    return json(400, { error: 'Enter a valid account ID.' });
  }

  const authUserId = body.authUserId.toLowerCase();
  let target: InviteTarget | null;
  try { target = await deps.loadTarget(authUserId); } catch { return unavailable(); }
  if (!target) return json(404, { error: 'Account not found.' });
  if (
    target.authUserId.toLowerCase() !== authUserId ||
    !target.email || target.email.trim().toLowerCase() !== target.authEmail?.trim().toLowerCase() ||
    target.setupClaimId !== null ||
    accountDecision(target.account) !== 'setup-required'
  ) return conflict();

  const type = target.emailConfirmedAt === null ? 'invite' : 'magiclink';
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  let invitationId: string;
  try { invitationId = await deps.prepareInvitation(authUserId, type, expiresAt); } catch { return unavailable(); }
  const invitationUrl = new URL(redirectTo);
  invitationUrl.searchParams.set('setup_invite_id', invitationId);

  try {
    const invitedId = await deps.sendInvite(target.email, invitationUrl.toString(), authUserId, type, invitationId);
    if (!invitedId || invitedId.toLowerCase() !== target.authUserId.toLowerCase()) {
      await deps.clearInvitation(authUserId, invitationId).catch(() => {});
      return unavailable();
    }
    return json(202, { sent: true });
  } catch (error) {
    await deps.clearInvitation(authUserId, invitationId).catch(() => {});
    if (isRecord(error) && error.status === 429) return json(429, { error: 'Too many setup emails. Try again later.' });
    return unavailable();
  }
}

async function revokeSetupSession(session: SetupSession, deps: Dependencies) {
  try { await deps.revokeRefreshTokens(session.accessToken); } catch { /* Keep setup incomplete when revocation fails. */ }
  try { await deps.clearLocalSession(); } catch { /* The old JWT still fails the marker checks. */ }
}

function accountResponse(account: Account) {
  const decision = accountDecision(account);
  if (decision === 'setup-required') return null;
  if (decision === 'setup-unavailable') return unavailable();
  return forbidden();
}

export async function handleVerifyFirstPasswordInvite(request: Request, deps: Dependencies) {
  if (!deps.enabled) return unavailable();
  const redirectTo = setupRedirect(deps.appOrigin);
  if (!redirectTo) return unavailable();
  if (!allowedPost(request, redirectTo)) return json(403, { error: 'Request not allowed.' });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'The invitation link is invalid or expired.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 3 || typeof body.tokenHash !== 'string' || !body.tokenHash || body.tokenHash.length > 512 || body.tokenHash.trim() !== body.tokenHash || !['invite', 'magiclink'].includes(String(body.type)) || typeof body.invitationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.invitationId)) {
    return json(400, { error: 'The invitation link is invalid or expired.' });
  }

  let session: VerifiedInvite | null;
  const type = body.type as 'invite' | 'magiclink';
  try { session = await deps.verifyInvite(body.tokenHash, type, body.invitationId); } catch { return unavailable(); }
  if (!session) return json(400, { error: 'The invitation link is invalid or expired.' });
  if (session.type !== type || session.invitationId !== body.invitationId) {
    await revokeSetupSession(session, deps);
    return json(400, { error: 'The invitation link is invalid or expired.' });
  }

  try {
    const denied = accountResponse(await deps.lookupAccount(session.userId));
    if (denied) {
      await revokeSetupSession(session, deps);
      return denied;
    }
    await deps.markSetupSession(session.userId, session.sessionId, session.expiresAt, session.type, session.invitationId);
    return json(200, { verified: true });
  } catch {
    await revokeSetupSession(session, deps);
    return unavailable();
  }
}

export async function handleFirstPasswordStatus(deps: Dependencies) {
  if (!deps.enabled) return unavailable();
  let session: SetupSession | null;
  try { session = await deps.getSetupSession(); } catch { return unavailable(); }
  if (!session) return json(401, { error: 'Verify your invitation link to continue.' });
  try {
    const denied = accountResponse(await deps.lookupAccount(session.userId));
    return denied ?? json(200, { ready: true });
  } catch {
    return unavailable();
  }
}

export async function handleCompleteFirstPassword(request: Request, deps: Dependencies) {
  if (!deps.enabled) return unavailable();
  const redirectTo = setupRedirect(deps.appOrigin);
  if (!redirectTo) return unavailable();
  if (!allowedPost(request, redirectTo)) return json(403, { error: 'Request not allowed.' });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Enter a valid password.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
    return json(400, { error: 'Enter a valid password.' });
  }

  let session: SetupSession | null;
  try { session = await deps.getSetupSession(); } catch { return unavailable(); }
  if (!session) return json(401, { error: 'Verify your invitation link to continue.' });

  try {
    const denied = accountResponse(await deps.lookupAccount(session.userId));
    if (denied) {
      await revokeSetupSession(session, deps);
      return denied;
    }
  } catch {
    return unavailable();
  }

  let claimId: string | null;
  try { claimId = await deps.claimSetup(session.userId, session.sessionId); } catch { return unavailable(); }
  if (!claimId) return json(409, { error: 'Password setup is already in progress or needs administrator review.' });

  try {
    if (await deps.setPassword(session.userId, body.password, session.sessionId, claimId) === 'invalid') {
      try { await deps.releaseSetupClaim(session.userId, claimId); } catch { return unavailable(); }
      return json(400, { error: 'The password does not meet the current Auth requirements.' });
    }
    await deps.revokeRefreshTokens(session.accessToken);
  } catch {
    return unavailable();
  }

  try {
    await deps.markSetupComplete(session.userId, session.sessionId, claimId);
  } catch {
    return unavailable();
  }

  try { await deps.clearLocalSession(); } catch { /* Revoked refresh tokens and the old JWT marker deny this session. */ }
  return json(200, { completed: true });
}
