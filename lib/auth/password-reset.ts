type CompletionResult = { updated: true; signedOut: boolean } | { updated: false; reason: 'unauthenticated' | 'weak-password' };
type Dependencies = {
  appOrigin?: string;
  requestReset: (email: string, redirectTo: string) => Promise<void>;
  verifyRecovery: (tokenHash: string, type: 'recovery') => Promise<boolean>;
  getRecoveryUser: () => Promise<boolean>;
  completeReset: (password: string) => Promise<CompletionResult>;
};

const json = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recoveryRedirect(appOrigin: string | undefined) {
  try {
    if (!appOrigin) return null;
    const origin = new URL(appOrigin);
    const localHttp = process.env.NODE_ENV !== 'production' && origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname);
    if ((!localHttp && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return null;
    return new URL('/reset-password', origin.origin).toString();
  } catch {
    return null;
  }
}

function allowedPost(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  try {
    return request.headers.get('origin') === new URL(request.url).origin && contentType === 'application/json';
  } catch {
    return false;
  }
}

function isRateLimitError(error: unknown) {
  return isRecord(error) && (error.status === 429 || error.code === 'over_email_send_rate_limit');
}

function isUnknownUserError(error: unknown) {
  return isRecord(error) && ['user_not_found', 'email_not_found'].includes(String(error.code));
}

function isInvalidRecoveryError(error: unknown) {
  return isRecord(error) && ['otp_expired', 'otp_not_found', 'invite_not_found', 'token_expired', 'validation_failed'].includes(String(error.code));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value.trim()).length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function handlePasswordResetRequest(request: Request, deps: Dependencies) {
  const redirectTo = recoveryRedirect(deps.appOrigin);
  if (!redirectTo) return json(503, { error: 'Password reset is temporarily unavailable.' });
  if (!allowedPost(request)) return json(403, { error: 'Request not allowed.' });

  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Enter a valid email address.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || !validEmail(body.email)) {
    return json(400, { error: 'Enter a valid email address.' });
  }

  try {
    await deps.requestReset(body.email.trim().toLowerCase(), redirectTo);
  } catch (error) {
    if (isUnknownUserError(error)) return json(202, { status: 'sent' });
    if (isRateLimitError(error)) return json(429, { error: 'Too many reset requests. Wait a while, then try again.' });
    return json(503, { error: 'Password reset is temporarily unavailable.' });
  }
  return json(202, { status: 'sent' });
}

export async function handleVerifyPasswordReset(request: Request, deps: Dependencies) {
  if (!allowedPost(request)) return json(403, { error: 'Request not allowed.' });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'This reset link is invalid, expired, or already used.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.tokenHash !== 'string' || !body.tokenHash || body.tokenHash.trim() !== body.tokenHash || body.tokenHash.length > 512) {
    return json(400, { error: 'This reset link is invalid, expired, or already used.' });
  }

  try {
    if (!await deps.verifyRecovery(body.tokenHash, 'recovery')) return json(400, { error: 'This reset link is invalid, expired, or already used.' });
  } catch (error) {
    if (isInvalidRecoveryError(error)) return json(400, { error: 'This reset link is invalid, expired, or already used.' });
    return json(503, { error: 'Password reset is temporarily unavailable.' });
  }
  return json(200, { status: 'verified' });
}

export async function handlePasswordResetStatus(deps: Dependencies) {
  try {
    if (!await deps.getRecoveryUser()) return json(401, { error: 'This reset session is invalid or expired.' });
    return json(200, { status: 'ready' });
  } catch {
    return json(503, { error: 'Password reset is temporarily unavailable.' });
  }
}

export async function handleCompletePasswordReset(request: Request, deps: Dependencies) {
  if (!allowedPost(request)) return json(403, { error: 'Request not allowed.' });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'Enter and confirm your new password.' }); }
  if (!isRecord(body) || Object.keys(body).length !== 2 || typeof body.password !== 'string' || typeof body.confirmation !== 'string' || body.password.length < 6 || body.password.length > 1024 || body.confirmation.length > 1024 || body.password !== body.confirmation) {
    return json(400, { error: 'Enter matching passwords that meet the password requirements.' });
  }

  try {
    const result = await deps.completeReset(body.password);
    if (result.updated) return json(200, { status: 'updated', signedOut: result.signedOut });
    if (result.reason === 'unauthenticated') return json(401, { error: 'This reset session is invalid or expired. Request a new reset link.' });
    if (result.reason === 'weak-password') return json(400, { error: 'Choose a stronger password and try again.' });
  } catch {
    return json(503, { error: 'Password reset is temporarily unavailable.' });
  }
  return json(503, { error: 'Password reset is temporarily unavailable.' });
}
