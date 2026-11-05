type Account = { account_state: string; is_blocked: boolean; is_deleted: boolean; role_code: string; role_is_deleted: boolean; setup_complete: boolean | null };
type Credentials = { userId: string; accessToken: string; refreshToken: string };
type Dependencies = {
  signIn: (email: string, password: string) => Promise<Credentials | null>;
  verifyIdentity: (accessToken: string) => Promise<string | null>;
  lookupAccount: (userId: string) => Promise<Account | null>;
  persistSession: (accessToken: string, refreshToken: string) => Promise<void>;
  revokeSession: () => Promise<void>;
};
type CookieSessionClient = { auth: {
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ error: unknown }>;
  signOut: (options: { scope: 'local' }) => Promise<unknown>;
} };

export async function persistAuthorizedSession(client: CookieSessionClient, accessToken: string, refreshToken: string) {
  try {
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  } catch (error) {
    await client.auth.signOut({ scope: 'local' }).catch(() => {});
    throw error;
  }
}

export function accountDecision(account: Account | null): 'allowed' | 'pending' | 'blocked' | 'denied' | 'setup-required' | 'setup-unavailable' {
  if (!account || account.is_deleted !== false || account.role_is_deleted !== false || !['user', 'admin', 'superadmin'].includes(account.role_code)) return 'denied';
  if (account.is_blocked !== false) return 'blocked';
  if (account.account_state === 'pending') return 'pending';
  if (account.account_state !== 'approved') return 'denied';
  if (account.setup_complete === false) return 'setup-required';
  return account.setup_complete === true ? 'allowed' : 'setup-unavailable';
}

export function readSetupCompletion(user: unknown, expectedId: string): boolean | null {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  const authUser = user as { id?: unknown; app_metadata?: unknown };
  if (authUser.id !== expectedId || !authUser.app_metadata || typeof authUser.app_metadata !== 'object' || Array.isArray(authUser.app_metadata)) return null;
  const marker = (authUser.app_metadata as Record<string, unknown>).hope_first_password_complete;
  return typeof marker === 'boolean' ? marker : null;
}

export function readSetupJwtIdentity(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
  const jwt = claims as { sub?: unknown; app_metadata?: unknown };
  if (typeof jwt.sub !== 'string' || !jwt.sub || !jwt.app_metadata || typeof jwt.app_metadata !== 'object' || Array.isArray(jwt.app_metadata)) return null;
  return (jwt.app_metadata as Record<string, unknown>).hope_first_password_complete === true ? jwt.sub : null;
}

export function readVerifiedSetupSession(claims: unknown, user: unknown, expectedId: string, now = Math.floor(Date.now() / 1000)): string | null {
  if (readSetupCompletion(user, expectedId) !== false || !claims || typeof claims !== 'object' || Array.isArray(claims)) return null;
  const jwt = claims as { sub?: unknown; session_id?: unknown };
  if (jwt.sub !== expectedId || typeof jwt.session_id !== 'string' || !jwt.session_id) return null;
  const authUser = user as { app_metadata: Record<string, unknown> };
  const expiresAt = authUser.app_metadata.hope_first_password_session_expires_at;
  return authUser.app_metadata.hope_first_password_session === jwt.session_id &&
    typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > now ? jwt.session_id : null;
}

export async function authorizeSession(verifyIdentity: () => Promise<string | null>, lookupAccount: (id: string) => Promise<Account | null>) {
  try {
    const id = await verifyIdentity();
    if (!id) return { allowed: false as const };
    const account = await lookupAccount(id);
    if (accountDecision(account) !== 'allowed') return { allowed: false as const };
    return { allowed: true as const, role: account!.role_code };
  } catch { return { allowed: false as const }; }
}

const response = (status: number, error?: string) => Response.json(error ? { error } : { ok: true }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function handleLogoutRequest(signOut: () => Promise<void>) {
  try { await signOut(); return response(200); }
  catch { return response(503, 'Unable to sign out. Please try again.'); }
}

export async function handleLoginRequest(request: Request, deps: Dependencies) {
  let body: unknown;
  try { body = await request.json(); } catch { return response(400, 'Enter a valid login request.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response(400, 'Enter your email and password.');
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some(key => !['email', 'password'].includes(key)) || typeof fields.email !== 'string' || typeof fields.password !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) || !fields.password || fields.password.length > 1024) return response(400, 'Enter your email and password.');
  let created = false;
  try {
    const session = await deps.signIn(fields.email.trim().toLowerCase(), fields.password);
    if (!session) return response(401, 'Email or password is incorrect, or the account is not ready to sign in.');
    created = true;
    const verifiedId = await deps.verifyIdentity(session.accessToken);
    if (!verifiedId || verifiedId !== session.userId) {
      await deps.revokeSession().catch(() => {});
      return response(401, 'Email or password is incorrect, or the account is not ready to sign in.');
    }
    const decision = accountDecision(await deps.lookupAccount(verifiedId));
    if (decision !== 'allowed') {
      await deps.revokeSession().catch(() => {});
      if (decision === 'setup-unavailable') return response(503, 'Sign-in is temporarily unavailable. Please try again later.');
      return response(403, decision === 'pending' ? 'Your account is awaiting approval.' : decision === 'blocked' ? 'Your account is blocked. Contact an administrator.' : decision === 'setup-required' ? 'First-password setup is required. Contact an administrator.' : 'Your account cannot access the ERP.');
    }
    await deps.persistSession(session.accessToken, session.refreshToken);
    return response(200);
  } catch {
    if (created) await deps.revokeSession().catch(() => {});
    return response(503, 'Sign-in is temporarily unavailable. Please try again later.');
  }
}
