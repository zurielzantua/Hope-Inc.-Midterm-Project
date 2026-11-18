import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const coreUrl = uri(compile(await readFile(new URL('../lib/auth/core.ts', import.meta.url), 'utf8')));
const originUrl = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const flowSource = (await readFile(new URL('../lib/auth/first-password.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/core'", `from '${coreUrl}'`)
  .replace("from '@/lib/auth/request-origin'", `from '${originUrl}'`);
const flowUrl = uri(compile(flowSource));
const serverUrl = uri(`
  export const authorizeRequest = async () => ({ allowed: true, role: 'superadmin' });
  export const lookupAccount = async () => globalThis.__hopeSetupProbe.account;
  export const createSessionClient = async () => globalThis.__hopeSetupProbe.client;
`);
const configUrl = uri("export const getSupabaseConfig = () => ({ url: 'https://example.test', key: 'sb_publishable_test' });");
const adminUrl = uri(`
  export const createSupabaseAdminClient = () => globalThis.__hopeSetupProbe.admin;
  export const createSupabasePublicServerClient = () => globalThis.__hopeSetupProbe.publicClient;
`);
const source = (await readFile(new URL('../lib/auth/first-password-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/core'", `from '${coreUrl}'`)
  .replace("from '@/lib/auth/server'", `from '${serverUrl}'`)
  .replace("from '@/lib/supabase/config'", `from '${configUrl}'`)
  .replace("from '@/lib/supabase/server'", `from '${adminUrl}'`)
  .replace("from '@/lib/auth/first-password'", `from '${flowUrl}'`);
const { handleCompleteFirstPassword } = await import(flowUrl);
const { firstPasswordDependencies } = await import(uri(compile(source)));

function probe() {
  const state = {
    calls: [],
    claimId: null,
    account: { account_state: 'approved', is_blocked: false, is_deleted: false, role_code: 'user', role_is_deleted: false, setup_complete: false },
    user: { id: 'user-1', email: 'user@example.test', email_confirmed_at: null, app_metadata: { hope_first_password_complete: false } },
    claims: { sub: 'user-1', session_id: 'session-1', exp: Math.floor(Date.now() / 1000) + 3600 },
  };
  const session = { access_token: 'setup-access-token', user: { id: 'user-1' } };
  state.client = { auth: {
    setSession: async (tokens) => {
      state.calls.push(['setSession', tokens]);
      state.user.email_confirmed_at ||= new Date().toISOString();
      state.implicitSession = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, user: { id: state.user.id } };
      return { data: { session: state.implicitSession, user: state.user }, error: null };
    },
    verifyOtp: async (input) => {
      state.calls.push(['verifyOtp', input]);
      if (state.verifyError) return { data: { user: null, session: null }, error: state.verifyError };
      state.user.email_confirmed_at ||= new Date().toISOString();
      return { data: { user: state.user, session }, error: null };
    },
    getClaims: async () => ({ data: { claims: state.claims }, error: null }),
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: state.user }, error: null }),
    signOut: async (options) => { state.calls.push(['localSignOut', options]); return { error: null }; },
  } };
  state.admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: state.user }, error: null }),
    inviteUserByEmail: async (email, options) => { state.calls.push(['invite', email, options]); return { data: { user: state.user }, error: null }; },
    updateUserById: async (_id, attributes) => {
      state.calls.push([attributes.password ? 'completeSetup' : 'updateMetadata', attributes]);
      if (attributes.password && state.passwordError) return { data: { user: state.user }, error: state.passwordError };
      if (attributes.app_metadata) state.user = { ...state.user, app_metadata: attributes.app_metadata };
      if (attributes.password) state.passwordSet = true;
      if (attributes.password && state.throwAfterComplete) throw new Error('response lost after Auth commit');
      return { data: { user: state.user }, error: null };
    },
    signOut: async (token, scope) => { state.calls.push(['revoke', token, scope]); return { error: state.signOutError ?? null }; },
  } },
    rpc: async (name, args) => {
      state.calls.push([name, args]);
      if (name === 'claim_first_password_setup') {
        if (state.claimId) return { data: null, error: null };
        state.claimId = args.p_claim_id;
        return { data: state.claimId, error: null };
      }
      if (name === 'release_first_password_setup') {
        const released = state.claimId === args.p_claim_id;
        if (released) state.claimId = null;
        return { data: released, error: null };
      }
      return { data: null, error: { message: 'unexpected rpc' } };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { auth_user_id: state.user.id, email: state.user.email, first_password_setup_claim_id: state.claimId }, error: null }) }) }) }) };
  state.publicClient = { auth: { signInWithOtp: async (input) => { state.calls.push(['magiclink', input]); return { data: {}, error: null }; } } };
  return state;
}

test('Supabase adapter loads the existing identity and issues an invite with the fixed callback', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const target = await deps.loadTarget('user-1');
  assert.equal(target.authUserId, 'user-1');
  assert.equal(target.authEmail, target.email);
  const invitationId = await deps.prepareInvitation('user-1', 'invite', Math.floor(Date.now() / 1000) + 3600);
  assert.equal(await deps.sendInvite(target.email, 'https://hope.example/set-password', 'user-1', 'invite', invitationId), 'user-1');
  assert.deepEqual(state.calls.at(-1), ['invite', 'user@example.test', { redirectTo: 'https://hope.example/set-password' }]);
});

test('Supabase invite adapter preserves Yahoo and institutional recipient addresses', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  for (const email of ['person@yahoo.com', 'student@university.edu', 'student@dept.university.edu.ph']) {
    const state = probe();
    state.user.email = email;
    globalThis.__hopeSetupProbe = state;
    const deps = firstPasswordDependencies();
    const target = await deps.loadTarget('user-1');
    const invitationId = await deps.prepareInvitation('user-1', 'invite', Math.floor(Date.now() / 1000) + 3600);
    assert.equal(await deps.sendInvite(target.email, 'https://hope.example/set-password', 'user-1', 'invite', invitationId), 'user-1');
    assert.deepEqual(state.calls.at(-1), ['invite', email, { redirectTo: 'https://hope.example/set-password' }]);
  }
});

test('confirmed incomplete identities use an existing-user magic link without creating another account', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.user.email_confirmed_at = '2026-11-04T00:00:00Z';
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'magiclink', Math.floor(Date.now() / 1000) + 3600);
  assert.equal(await deps.sendInvite('user@example.test', 'https://hope.example/set-password', 'user-1', 'magiclink', invitationId), 'user-1');
  assert.deepEqual(state.calls.at(-1), ['magiclink', {
    email: 'user@example.test',
    options: { shouldCreateUser: false, emailRedirectTo: 'https://hope.example/set-password' },
  }]);
  assert.equal(state.calls.some(([name]) => name === 'invite'), false);
});

test('reissuing setup invalidates the prior setup-session binding', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.user.app_metadata.hope_first_password_session = 'previous-session';
  state.user.app_metadata.hope_first_password_session_expires_at = Math.floor(Date.now() / 1000) + 300;
  globalThis.__hopeSetupProbe = state;
  await firstPasswordDependencies().prepareInvitation('user-1', 'invite', Math.floor(Date.now() / 1000) + 3600);
  assert.equal(state.user.app_metadata.hope_first_password_session, null);
  assert.equal(state.user.app_metadata.hope_first_password_session_expires_at, null);
});

test('Supabase adapter atomically sets the password and trusted completion marker', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'invite', state.claims.exp);
  const verified = await deps.verifyInvite('token-hash', 'invite', invitationId);
  assert.deepEqual(verified, { userId: 'user-1', accessToken: 'setup-access-token', sessionId: 'session-1', expiresAt: state.claims.exp, type: 'invite', invitationId });
  await deps.markSetupSession(verified.userId, verified.sessionId, verified.expiresAt, verified.type, verified.invitationId);
  assert.equal(state.user.app_metadata.hope_first_password_session, 'session-1');
  assert.deepEqual(await deps.getSetupSession(), { userId: verified.userId, accessToken: verified.accessToken, sessionId: verified.sessionId });
  const claimId = await deps.claimSetup(verified.userId, verified.sessionId);
  assert.ok(claimId);
  assert.equal(await deps.claimSetup(verified.userId, verified.sessionId), null);
  assert.equal(await deps.completeSetup(verified.userId, 'test-password', verified.sessionId, claimId), 'completed');
  await deps.clearLocalSession();
  assert.equal(state.passwordSet, true);
  assert.equal(state.user.app_metadata.hope_first_password_complete, true);
  assert.equal(state.user.app_metadata.hope_first_password_session, null);
  assert.equal(state.user.app_metadata.hope_first_password_session_expires_at, null);
  const actions = state.calls.map(([name]) => name);
  const update = state.calls.find(([name]) => name === 'completeSetup');
  assert.ok(update);
  assert.equal(update[1].password, 'test-password');
  assert.equal(update[1].app_metadata.hope_first_password_complete, true);
  assert.equal(actions.includes('revoke'), false);
  assert.ok(actions.indexOf('completeSetup') < actions.indexOf('localSignOut'));
});

test('a lost Auth response reconciles to success when the atomic update committed', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.user.app_metadata.hope_first_password_session = 'session-1';
  state.user.app_metadata.hope_first_password_session_expires_at = state.claims.exp;
  state.claimId = '44444444-4444-4444-8444-444444444444';
  state.throwAfterComplete = true;
  globalThis.__hopeSetupProbe = state;
  const result = await firstPasswordDependencies().completeSetup('user-1', 'test-password', 'session-1', state.claimId);
  assert.equal(result, 'completed');
  assert.equal(state.user.app_metadata.hope_first_password_complete, true);
});

test('stale claims recover only after the bound setup session expires with grace', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  const now = Math.floor(Date.now() / 1000);
  state.claimId = '44444444-4444-4444-8444-444444444444';
  state.user.app_metadata.hope_first_password_session = 'expired-session';
  state.user.app_metadata.hope_first_password_session_expires_at = now - 6 * 60;
  globalThis.__hopeSetupProbe = state;
  assert.equal(await firstPasswordDependencies().recoverStaleSetupClaim('user-1', state.claimId), true);
  assert.equal(state.claimId, null);

  state.claimId = '44444444-4444-4444-8444-444444444444';
  state.user.app_metadata.hope_first_password_session_expires_at = now - 60;
  assert.equal(await firstPasswordDependencies().recoverStaleSetupClaim('user-1', state.claimId), false);
  assert.equal(state.claimId, '44444444-4444-4444-8444-444444444444');
});

test('concurrent stale-claim recovery has one compare-and-release winner', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  const now = Math.floor(Date.now() / 1000);
  state.claimId = '44444444-4444-4444-8444-444444444444';
  state.user.app_metadata.hope_first_password_session = 'expired-session';
  state.user.app_metadata.hope_first_password_session_expires_at = now - 6 * 60;
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const results = await Promise.all([
    deps.recoverStaleSetupClaim('user-1', state.claimId),
    deps.recoverStaleSetupClaim('user-1', state.claimId),
  ]);
  assert.deepEqual(results.sort(), [false, true]);
});

test('token-hash callback derives the current invitation id from trusted Auth metadata', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'invite', state.claims.exp);
  const verified = await deps.verifyInvite('token-hash', 'invite');
  assert.equal(verified?.invitationId, invitationId);
});

test('password policy 422 errors are returned as retryable invalid passwords', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.user.app_metadata.hope_first_password_session = 'session-1';
  state.user.app_metadata.hope_first_password_session_expires_at = state.claims.exp;
  state.claimId = '44444444-4444-4444-8444-444444444444';
  state.passwordError = { status: 422, code: 'validation_failed' };
  globalThis.__hopeSetupProbe = state;
  const result = await firstPasswordDependencies().completeSetup('user-1', 'weak-password', 'session-1', state.claimId);
  assert.equal(result, 'invalid');
  assert.ok(state.calls.some(([name]) => name === 'completeSetup'));
});

test('default session callback derives the current invitation id from trusted Auth metadata', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'invite', state.claims.exp);
  const verified = await deps.verifyInviteSession('implicit-access-token', 'implicit-refresh-token');
  assert.equal(verified?.invitationId, invitationId);
});

test('Auth session already revoked by password update is accepted as successful cleanup', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  const oldEnabled = process.env.HOPE_FIRST_PASSWORD_SETUP_ENABLED;
  const oldAppUrl = process.env.HOPE_APP_URL;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  process.env.HOPE_FIRST_PASSWORD_SETUP_ENABLED = 'true';
  process.env.HOPE_APP_URL = 'https://hope.example';
  t.after(() => {
    if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret;
    if (oldEnabled === undefined) delete process.env.HOPE_FIRST_PASSWORD_SETUP_ENABLED; else process.env.HOPE_FIRST_PASSWORD_SETUP_ENABLED = oldEnabled;
    if (oldAppUrl === undefined) delete process.env.HOPE_APP_URL; else process.env.HOPE_APP_URL = oldAppUrl;
    delete globalThis.__hopeSetupProbe;
  });
  const state = probe();
  state.user.app_metadata.hope_first_password_session = 'session-1';
  state.user.app_metadata.hope_first_password_session_expires_at = state.claims.exp;
  state.signOutError = { code: 'session_not_found', status: 403, message: 'Session not found' };
  globalThis.__hopeSetupProbe = state;
  const response = await handleCompleteFirstPassword(new Request('https://hope.example/api/auth/first-password/complete', {
    method: 'POST', headers: { origin: 'https://hope.example', 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'SecurePassword123' }),
  }), firstPasswordDependencies());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { completed: true });
  assert.equal(state.user.app_metadata.hope_first_password_complete, true);
  assert.equal(state.user.app_metadata.hope_first_password_session, null);

  state.signOutError = { code: 'server_error', status: 500, message: 'Auth unavailable' };
  await assert.rejects(firstPasswordDependencies().revokeRefreshTokens('setup-access-token'), error => error.code === 'server_error');
});

test('default Supabase confirmation session is verified and bound to its stored invite', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'invite', state.claims.exp);
  const verified = await deps.verifyInviteSession('implicit-access-token', 'implicit-refresh-token', invitationId);
  assert.deepEqual(verified, {
    userId: 'user-1', accessToken: 'implicit-access-token', sessionId: 'session-1',
    expiresAt: state.claims.exp, type: 'invite', invitationId,
  });
  assert.deepEqual(state.calls.find(([name]) => name === 'setSession'), ['setSession', {
    access_token: 'implicit-access-token', refresh_token: 'implicit-refresh-token',
  }]);
  assert.ok(state.user.email_confirmed_at);
});

test('a different Auth session cannot use another invitation session binding', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.user.app_metadata.hope_first_password_session = 'session-1';
  state.user.app_metadata.hope_first_password_session_expires_at = state.claims.exp;
  state.claims.session_id = 'different-session';
  globalThis.__hopeSetupProbe = state;
  assert.equal(await firstPasswordDependencies().getSetupSession(), null);
});

test('Supabase expired invitation errors do not create a setup session', async (t) => {
  const state = probe();
  state.verifyError = { code: 'otp_expired', status: 403 };
  globalThis.__hopeSetupProbe = state;
  t.after(() => { delete globalThis.__hopeSetupProbe; });
  assert.equal(await firstPasswordDependencies().verifyInvite('expired-token', 'invite', '33333333-3333-4333-8333-333333333333'), null);
});

test('a setup session cannot outlive one hour even when Auth issues a longer JWT', async (t) => {
  const oldSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = 'test-server-secret';
  t.after(() => { if (oldSecret === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldSecret; delete globalThis.__hopeSetupProbe; });
  const state = probe();
  state.claims.exp = Math.floor(Date.now() / 1000) + 7200;
  globalThis.__hopeSetupProbe = state;
  const deps = firstPasswordDependencies();
  const invitationId = await deps.prepareInvitation('user-1', 'invite', Math.floor(Date.now() / 1000) + 3600);
  const before = Math.floor(Date.now() / 1000);
  const verified = await deps.verifyInvite('token-hash', 'invite', invitationId);
  assert.ok(verified.expiresAt <= before + 3601);
  assert.ok(verified.expiresAt >= before + 3599);
});
