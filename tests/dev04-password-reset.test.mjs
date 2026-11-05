import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/auth/password-reset.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { handlePasswordResetRequest, handleVerifyPasswordReset, handlePasswordResetStatus, handleCompletePasswordReset } =
  await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

const post = (path, body, origin = 'https://hope.example') => new Request(`https://hope.example${path}`, {
  method: 'POST',
  headers: { origin, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    appOrigin: 'https://hope.example',
    requestReset: async (email, redirectTo) => {
      calls.push(['requestReset', email, redirectTo]);
      if (overrides.requestError) throw overrides.requestError;
    },
    verifyRecovery: async (tokenHash, type) => {
      calls.push(['verifyRecovery', tokenHash, type]);
      if (overrides.verifyError) throw overrides.verifyError;
      return overrides.verified ?? true;
    },
    getRecoveryUser: async () => {
      calls.push(['getRecoveryUser']);
      if (overrides.statusError) throw overrides.statusError;
      return overrides.authenticated ?? true;
    },
    completeReset: async (password) => {
      calls.push(['completeReset', password]);
      if (overrides.completeError) throw overrides.completeError;
      return overrides.completion ?? { updated: true, signedOut: true };
    },
  };
}

test('valid reset request is normalized and uses the fixed application callback', async () => {
  const deps = dependencies();
  const response = await handlePasswordResetRequest(post('/api/auth/password-reset/request', { email: ' User@Example.Test ' }), deps);
  assert.equal(response.status, 202);
  assert.deepEqual(deps.calls, [['requestReset', 'user@example.test', 'https://hope.example/reset-password']]);
  assert.deepEqual(await response.json(), { status: 'sent' });
});

test('invalid, malformed, and unexpected reset request fields are rejected', async () => {
  for (const body of [null, {}, { email: 'bad-email' }, { email: 'x'.repeat(321) }, { email: 'user@example.test', role: 'admin' }]) {
    const response = await handlePasswordResetRequest(post('/api/auth/password-reset/request', body), dependencies());
    assert.equal(response.status, 400);
  }
  const malformed = new Request('https://hope.example/api/auth/password-reset/request', {
    method: 'POST', headers: { origin: 'https://hope.example', 'content-type': 'application/json' }, body: '{',
  });
  assert.equal((await handlePasswordResetRequest(malformed, dependencies())).status, 400);
});

test('reset requests are same-origin and require JSON', async () => {
  assert.equal((await handlePasswordResetRequest(post('/api/auth/password-reset/request', { email: 'user@example.test' }, 'https://attacker.example'), dependencies())).status, 403);
  const form = new Request('https://hope.example/api/auth/password-reset/request', { method: 'POST', headers: { origin: 'https://hope.example', 'content-type': 'text/plain' }, body: 'email=user@example.test' });
  assert.equal((await handlePasswordResetRequest(form, dependencies())).status, 403);
});

test('unknown accounts receive the same non-enumerating response as valid requests', async () => {
  const deps = dependencies({ requestError: { code: 'user_not_found', status: 404 } });
  const response = await handlePasswordResetRequest(post('/api/auth/password-reset/request', { email: 'unknown@example.test' }), deps);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { status: 'sent' });
});

test('rate limits and service failures return generic errors', async () => {
  assert.equal((await handlePasswordResetRequest(post('/api/auth/password-reset/request', { email: 'user@example.test' }), dependencies({ requestError: { code: 'over_email_send_rate_limit', status: 429 } }))).status, 429);
  const failed = await handlePasswordResetRequest(post('/api/auth/password-reset/request', { email: 'user@example.test' }), dependencies({ requestError: new Error('private SMTP detail') }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private SMTP detail/);
});

test('recovery verification fixes the token type and rejects invalid, expired, or reused links', async () => {
  const deps = dependencies();
  assert.equal((await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: 'opaque-token-hash' }), deps)).status, 200);
  assert.deepEqual(deps.calls, [['verifyRecovery', 'opaque-token-hash', 'recovery']]);
  const expired = await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: 'opaque-token-hash' }), dependencies({ verifyError: { code: 'otp_expired', status: 403 } }));
  assert.equal(expired.status, 400);
  assert.match(await expired.text(), /invalid, expired, or already used/);
  assert.equal((await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: 'opaque-token-hash' }), dependencies({ verified: false }))).status, 400);
});

test('recovery verification validates input and fails closed on provider errors', async () => {
  assert.equal((await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: ' ' }), dependencies())).status, 400);
  assert.equal((await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: 'x'.repeat(513) }), dependencies())).status, 400);
  const failed = await handleVerifyPasswordReset(post('/api/auth/password-reset/verify', { tokenHash: 'opaque-token-hash' }), dependencies({ verifyError: new Error('private Auth detail') }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private Auth detail/);
});

test('status endpoint requires an authenticated Supabase recovery session', async () => {
  assert.equal((await handlePasswordResetStatus(dependencies())).status, 200);
  assert.equal((await handlePasswordResetStatus(dependencies({ authenticated: false }))).status, 401);
  assert.equal((await handlePasswordResetStatus(dependencies({ statusError: new Error('private Auth detail') }))).status, 503);
});

test('password reset validates matching passwords and requires a same-origin request', async () => {
  for (const body of [
    { password: 'short', confirmation: 'short' },
    { password: 'ValidPassword1', confirmation: 'different' },
    { password: 'ValidPassword1', confirmation: 'ValidPassword1', role: 'admin' },
  ]) assert.equal((await handleCompletePasswordReset(post('/api/auth/password-reset/complete', body), dependencies())).status, 400);
  assert.equal((await handleCompletePasswordReset(post('/api/auth/password-reset/complete', { password: 'ValidPassword1', confirmation: 'ValidPassword1' }, 'https://attacker.example'), dependencies())).status, 403);
});

test('password reset updates only an authenticated user and reports successful logout state', async () => {
  const deps = dependencies();
  const response = await handleCompletePasswordReset(post('/api/auth/password-reset/complete', { password: 'ValidPassword1', confirmation: 'ValidPassword1' }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'updated', signedOut: true });
  assert.deepEqual(deps.calls, [['completeReset', 'ValidPassword1']]);
  const signedOutFailed = await handleCompletePasswordReset(post('/api/auth/password-reset/complete', { password: 'ValidPassword1', confirmation: 'ValidPassword1' }), dependencies({ completion: { updated: true, signedOut: false } }));
  assert.deepEqual(await signedOutFailed.json(), { status: 'updated', signedOut: false });
  assert.equal((await handleCompletePasswordReset(post('/api/auth/password-reset/complete', { password: 'ValidPassword1', confirmation: 'ValidPassword1' }), dependencies({ completion: { updated: false, reason: 'unauthenticated' } }))).status, 401);
  assert.equal((await handleCompletePasswordReset(post('/api/auth/password-reset/complete', { password: 'ValidPassword1', confirmation: 'ValidPassword1' }), dependencies({ completion: { updated: false, reason: 'weak-password' } }))).status, 400);
});

test('recovery email keeps the one-time token in the URL fragment', async () => {
  const template = await readFile(new URL('../supabase/templates/password_recovery.html', import.meta.url), 'utf8');
  assert.match(template, /\{\{ \.RedirectTo \}\}#token_hash=\{\{ \.TokenHash \}\}&amp;type=recovery/);
  assert.doesNotMatch(template, /\?token_hash=/);
});
