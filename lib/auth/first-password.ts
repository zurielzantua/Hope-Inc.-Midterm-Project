import { accountDecision } from '@/lib/auth/core';
import { isJsonRequest, resolveRedirect } from '@/lib/auth/request-origin';

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
  verifyInvite: (tokenHash: string, type: 'invite' | 'magiclink', invitationId?: string) => Promise<VerifiedInvite | null>;
  verifyInviteSession: (accessToken: string, refreshToken: string, invitationId?: string) => Promise<VerifiedInvite | null>;
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

const unavailable = () => json(503, { code: 'setup_unavailable', error: 'First-password setup is temporarily unavailable.' });
const disabled = () => json(503, { code: 'setup_disabled', error: 'First-password setup is turned off on this server.' });
const misconfigured = () => json(503, { code: 'setup_misconfigured', error: 'First-password setup has an invalid app URL configuration.' });
const originRejected = () => json(403, { code: 'origin_rejected', error: 'Request not allowed.' });
const emailFailed = () => json(503, { code: 'email_delivery_failed', error: 'The setup email could not be delivered.' });
const smtpRequired = () => json(503, { code: 'smtp_required', error: 'Configure custom SMTP to send setup emails outside the project team.' });
const forbidden = () => json(403, { code: 'invite_ineligible', error: 'This account is not eligible for first-password setup.' });
const conflict = () => json(409, { code: 'invite_ineligible', error: 'This account is not eligible for first-password setup.' });
const signInRequired = () => json(401, { code: 'sign_in_required', error: 'Sign in is required.' });
const superadminRequired = () => json(403, { code: 'superadmin_required', error: 'Only an authorized Superadmin can issue setup invitations.' });
const invalidAccountId = () => json(400, { code: 'invalid_request', error: 'Enter a valid account ID.' });
const accountNotFound = () => json(404, { code: 'account_not_found', error: 'Account not found.' });
const rateLimited = () => json(429, { code: 'email_rate_limited', error: 'Too many setup emails. Try again later.' });
const invalidInvite = () => json(400, { code: 'invite_invalid', error: 'The invitation link is invalid or expired.' });
const invalidPassword = () => json(400, { code: 'password_invalid', error: 'Enter a valid password.' });
const setupInProgress = () => json(409, { code: 'setup_in_progress', error: 'Password setup is already in progress or needs administrator review.' });
const weakPassword = () => json(400, { code: 'password_rejected', error: 'The password does not meet the current Auth requirements.' });
const setupRequired = () => json(401, { code: 'setup_required', error: 'Verify your invitation link to continue.' });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExternalRecipientDenied(error: unknown) {
  if (!isRecord(error)) return false;
  return error.code === 'email_address_not_authorized' ||
    (typeof error.message === 'string' && /email address not authorized/i.test(error.message));
}

function preparePost(request: Request, deps: Dependencies): { response: Response } | { redirectTo: string } {
  if (!deps.enabled) return { response: disabled() };
  const resolution = resolveRedirect(request, deps.appOrigin, '/set-password');
  if (!resolution.ok) return { response: resolution.reason === 'misconfigured' ? misconfigured() : originRejected() };
  if (!isJsonRequest(request)) return { response: originRejected() };
  return { redirectTo: resolution.redirectTo };
}

export function isInvalidInviteError(error: unknown) {
  return isRecord(error) && ['otp_expired', 'invite_not_found', 'validation_failed'].includes(String(error.code));
}

function isRateLimitError(error: unknown) {
  return isRecord(error) && (error.status === 429 || error.code === 'over_email_send_rate_limit');
}

export async function handleIssueFirstPasswordInvite(request: Request, deps: Dependencies) {
  const prepared = preparePost(request, deps);
  if ('response' in prepared) return prepared.response;
  const { redirectTo } = prepared;

  let issuer: { allowed: boolean; role?: string };
  try { issuer = await deps.authorizeIssuer(); } catch { return unavailable(); }
  if (!issuer.allowed) return signInRequired();
  if (issuer.role !== 'superadmin') return superadminRequired();

  let body: unknown;
  try { body = await request.json(); } catch { return invalidAccountId(); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.authUserId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.authUserId)) {
    return invalidAccountId();
  }

  const authUserId = body.authUserId.toLowerCase();
  let target: InviteTarget | null;
  try { target = await deps.loadTarget(authUserId); } catch { return unavailable(); }
  if (!target) return accountNotFound();
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

  // Keep the ID in trusted Auth metadata so the redirect uses the allowlisted path exactly.
  try {
    const invitedId = await deps.sendInvite(target.email, redirectTo, authUserId, type, invitationId);
    if (!invitedId || invitedId.toLowerCase() !== target.authUserId.toLowerCase()) {
      await deps.clearInvitation(authUserId, invitationId).catch(() => {});
      return unavailable();
    }
    return json(202, { sent: true });
  } catch (error) {
    await deps.clearInvitation(authUserId, invitationId).catch(() => {});
    if (isRateLimitError(error)) return rateLimited();
    if (isExternalRecipientDenied(error)) return smtpRequired();
    return emailFailed();
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
  const prepared = preparePost(request, deps);
  if ('response' in prepared) return prepared.response;
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'The invitation link is invalid or expired.' }); }
  if (!isRecord(body)) {
    return json(400, { error: 'The invitation link is invalid or expired.' });
  }

  const fields = Object.keys(body);
  const hasInvitationId = fields.includes('invitationId');
  const invitationId = body.invitationId;
  if (hasInvitationId && (typeof invitationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId))) {
    return json(400, { error: 'The invitation link is invalid or expired.' });
  }
  const credentialFields = fields.filter((field) => field !== 'invitationId');
  let session: VerifiedInvite | null;
  let expectedType: 'invite' | 'magiclink' | undefined;
  if (credentialFields.length === 2 && credentialFields.includes('tokenHash') && credentialFields.includes('type') &&
      typeof body.tokenHash === 'string' && !!body.tokenHash && body.tokenHash.length <= 512 && body.tokenHash.trim() === body.tokenHash &&
      ['invite', 'magiclink'].includes(String(body.type))) {
    expectedType = body.type as 'invite' | 'magiclink';
    try { session = await deps.verifyInvite(body.tokenHash, expectedType, invitationId as string | undefined); } catch { return unavailable(); }
  } else if (credentialFields.length === 2 && credentialFields.includes('accessToken') && credentialFields.includes('refreshToken') &&
      typeof body.accessToken === 'string' && !!body.accessToken && body.accessToken.length <= 8192 && body.accessToken.trim() === body.accessToken &&
      typeof body.refreshToken === 'string' && !!body.refreshToken && body.refreshToken.length <= 2048 && body.refreshToken.trim() === body.refreshToken) {
    try { session = await deps.verifyInviteSession(body.accessToken, body.refreshToken, invitationId as string | undefined); } catch { return unavailable(); }
  } else {
    return json(400, { error: 'The invitation link is invalid or expired.' });
  }
  if (!session) return json(400, { error: 'The invitation link is invalid or expired.' });
  if ((expectedType && session.type !== expectedType) || (invitationId && session.invitationId !== invitationId)) {
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
  const prepared = preparePost(request, deps);
  if ('response' in prepared) return prepared.response;
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Enter a valid password.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.password !== 'string' || !body.password || body.password.length > 1024) {
    return json(400, { error: 'Enter a valid password.' });
  }

  let session: SetupSession | null;
  try { session = await deps.getSetupSession(); } catch { console.error('First-password completion failed: session lookup'); return unavailable(); }
  if (!session) return json(401, { error: 'Verify your invitation link to continue.' });

  try {
    const denied = accountResponse(await deps.lookupAccount(session.userId));
    if (denied) {
      await revokeSetupSession(session, deps);
      return denied;
    }
  } catch {
    console.error('First-password completion failed: account lookup');
    return unavailable();
  }

  let claimId: string | null;
  try { claimId = await deps.claimSetup(session.userId, session.sessionId); } catch { console.error('First-password completion failed: claim'); return unavailable(); }
  if (!claimId) return json(409, { error: 'Password setup is already in progress or needs administrator review.' });

  try {
    if (await deps.setPassword(session.userId, body.password, session.sessionId, claimId) === 'invalid') {
      try { await deps.releaseSetupClaim(session.userId, claimId); } catch { console.error('First-password completion failed: claim release'); return unavailable(); }
      return json(400, { error: 'The password does not meet the current Auth requirements.' });
    }
  } catch {
    console.error('First-password completion failed: password update');
    return unavailable();
  }

  try {
    await deps.revokeRefreshTokens(session.accessToken);
  } catch {
    console.error('First-password completion failed: session revocation');
    return unavailable();
  }

  try {
    await deps.markSetupComplete(session.userId, session.sessionId, claimId);
  } catch {
    console.error('First-password completion failed: completion marker');
    return unavailable();
  }

  try { await deps.clearLocalSession(); } catch { /* Revoked refresh tokens and the old JWT marker deny this session. */ }
  return json(200, { completed: true });
}
