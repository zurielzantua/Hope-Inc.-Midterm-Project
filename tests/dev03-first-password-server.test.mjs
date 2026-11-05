import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const coreUrl = uri(compile(await readFile(new URL('../lib/auth/core.ts', import.meta.url), 'utf8')));
const flowSource = (await readFile(new URL('../lib/auth/first-password.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/core'", `from '${coreUrl}'`);
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
      state.calls.push([attributes.password ? 'setPassword' : 'updateMetadata', attributes]);
      if (attributes.app_metadata) state.user = { ...state.user, app_metadata: attributes.app_metadata };
      return { data: { user: state.user }, error: null };
    },
    signOut: async (token, scope) => { state.calls.push(['revoke', token, scope]); return { error: null }; },
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

test('Supabase adapter binds the verified invite session, revokes it, then marks setup complete', async (t) => {
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
  assert.equal(await deps.setPassword(verified.userId, 'test-password', verified.sessionId, claimId), 'success');
  await deps.revokeRefreshTokens(verified.accessToken);
  await deps.markSetupComplete(verified.userId, verified.sessionId, claimId);
  await deps.clearLocalSession();
  assert.equal(state.user.app_metadata.hope_first_password_complete, true);
  assert.equal(state.user.app_metadata.hope_first_password_session, null);
  assert.equal(state.user.app_metadata.hope_first_password_session_expires_at, null);
  const actions = state.calls.map(([name]) => name);
  assert.ok(actions.indexOf('setPassword') < actions.indexOf('revoke'));
  assert.ok(actions.indexOf('revoke') < actions.lastIndexOf('updateMetadata'));
  assert.ok(actions.lastIndexOf('updateMetadata') < actions.indexOf('localSignOut'));
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
