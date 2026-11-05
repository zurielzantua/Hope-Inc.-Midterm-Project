import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const sessionModule = uri(`export const createSessionClient = async (writable) => { globalThis.__passwordResetState.calls.push(['createSessionClient', writable]); return globalThis.__passwordResetState.sessionClient; };`);
const publicModule = uri(`export const createSupabasePublicServerClient = () => globalThis.__passwordResetState.publicClient;`);
const source = (await readFile(new URL('../lib/auth/password-reset-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/server'", `from '${sessionModule}'`)
  .replace("from '@/lib/supabase/server'", `from '${publicModule}'`);
const { passwordResetDependencies } = await import(uri(compile(source)));

function setup(overrides = {}) {
  const state = { calls: [], user: { id: 'auth-user-1' } };
  state.sessionClient = { auth: {
    verifyOtp: async (input) => {
      state.calls.push(['verifyOtp', input]);
      return overrides.verifyResult ?? { data: { session: { access_token: 'access', refresh_token: 'refresh' }, user: state.user }, error: null };
    },
    getUser: async () => {
      state.calls.push(['getUser']);
      return overrides.userResult ?? { data: { user: state.user }, error: null };
    },
    updateUser: async (input) => {
      state.calls.push(['updateUser', input]);
      return overrides.updateResult ?? { error: null };
    },
    signOut: async (input) => {
      state.calls.push(['signOut', input]);
      return overrides.signOutResult ?? { error: null };
    },
  } };
  state.publicClient = { auth: {
    resetPasswordForEmail: async (email, options) => {
      state.calls.push(['resetPasswordForEmail', email, options]);
      return overrides.requestResult ?? { error: null };
    },
  } };
  globalThis.__passwordResetState = state;
  return state;
}

test('request adapter uses only the public Auth recovery method and fixed redirect', async () => {
  const state = setup();
  await passwordResetDependencies().requestReset('user@example.test', 'https://hope.example/reset-password');
  assert.deepEqual(state.calls, [['resetPasswordForEmail', 'user@example.test', { redirectTo: 'https://hope.example/reset-password' }]]);
});

test('verification redeems only a recovery token and confirms its authenticated identity', async () => {
  const state = setup();
  assert.equal(await passwordResetDependencies().verifyRecovery('opaque-hash', 'recovery'), true);
  assert.deepEqual(state.calls, [
    ['createSessionClient', true],
    ['verifyOtp', { token_hash: 'opaque-hash', type: 'recovery' }],
    ['getUser'],
  ]);
  const mismatch = setup({ userResult: { data: { user: { id: 'different-user' } }, error: null } });
  assert.equal(await passwordResetDependencies().verifyRecovery('opaque-hash', 'recovery'), false);
  assert.deepEqual(mismatch.calls.at(-1), ['signOut', { scope: 'local' }]);
  const missingIdentity = setup({ verifyResult: { data: { session: { access_token: 'access' }, user: null }, error: null } });
  assert.equal(await passwordResetDependencies().verifyRecovery('opaque-hash', 'recovery'), false);
  assert.deepEqual(missingIdentity.calls.at(-1), ['signOut', { scope: 'local' }]);
});

test('completion checks the signed-in identity, updates through Auth, and clears the local session', async () => {
  const state = setup();
  assert.deepEqual(await passwordResetDependencies().completeReset('ValidPassword1'), { updated: true, signedOut: true });
  assert.deepEqual(state.calls, [
    ['createSessionClient', true],
    ['getUser'],
    ['updateUser', { password: 'ValidPassword1' }],
    ['signOut', { scope: 'local' }],
  ]);
  const weak = setup({ updateResult: { error: { code: 'weak_password', status: 422 } } });
  assert.deepEqual(await passwordResetDependencies().completeReset('weak'), { updated: false, reason: 'weak-password' });
  assert.equal(weak.calls.some(([name]) => name === 'signOut'), false);
  const noSession = setup({ userResult: { data: { user: null }, error: null } });
  assert.deepEqual(await passwordResetDependencies().completeReset('ValidPassword1'), { updated: false, reason: 'unauthenticated' });
});
