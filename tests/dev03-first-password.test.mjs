import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const coreSource = await readFile(new URL('../lib/auth/core.ts', import.meta.url), 'utf8');
const coreOutput = ts.transpileModule(coreSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const coreUrl = `data:text/javascript;base64,${Buffer.from(coreOutput).toString('base64')}`;
const source = (await readFile(new URL('../lib/auth/first-password.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/core'", `from '${coreUrl}'`);
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { handleIssueFirstPasswordInvite, handleVerifyFirstPasswordInvite, handleFirstPasswordStatus, handleCompleteFirstPassword, isInvalidInviteError } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

const approvedSetupAccount = {
  account_state: 'approved', is_blocked: false, is_deleted: false,
  role_code: 'user', role_is_deleted: false, setup_complete: false,
};
const targetId = '11111111-1111-4111-8111-111111111111';
const json = (value) => new Request('https://hope.example/api/auth/first-password', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://hope.example' }, body: JSON.stringify(value),
});

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    enabled: true,
    appOrigin: 'https://hope.example',
    authorizeIssuer: async () => overrides.issuer ?? { allowed: true, role: 'superadmin' },
    loadTarget: async (id) => {
      calls.push(['loadTarget', id]);
      if (overrides.targetError) throw new Error('private target details');
      return overrides.target === undefined ? {
        authUserId: id, email: 'user@example.test', authEmail: 'user@example.test', emailConfirmedAt: null, setupClaimId: null,
        account: approvedSetupAccount,
      } : overrides.target;
    },
    prepareInvitation: async (id, type, expiresAt) => {
      calls.push(['prepareInvitation', id, type, expiresAt]);
      if (overrides.prepareError) throw new Error('private metadata details');
      return overrides.invitationId ?? '33333333-3333-4333-8333-333333333333';
    },
    sendInvite: async (email, redirectTo, id, type, invitationId) => {
      calls.push(['sendInvite', email, redirectTo, id, type, invitationId]);
      if (overrides.inviteError) throw new Error('private mail details');
      return overrides.invitedId ?? targetId;
    },
    clearInvitation: async (id, invitationId) => calls.push(['clearInvitation', id, invitationId]),
    verifyInvite: async (tokenHash, type, invitationId) => {
      calls.push(['verifyInvite', tokenHash, type, invitationId]);
      if (overrides.verifyError) throw new Error('private auth details');
      return overrides.verifiedSession === undefined ? { userId: 'user-1', accessToken: 'setup-access-token', sessionId: 'session-1', expiresAt: 2000000000, type, invitationId } : overrides.verifiedSession;
    },
    getSetupSession: async () => {
      calls.push(['getSetupSession']);
      if (overrides.sessionError) throw new Error('private session details');
      return overrides.session === undefined ? { userId: 'user-1', accessToken: 'setup-access-token', sessionId: 'session-1' } : overrides.session;
    },
    lookupAccount: async (id) => {
      calls.push(['lookupAccount', id]);
      if (overrides.accountError) throw new Error('private database details');
      return overrides.account === undefined ? approvedSetupAccount : overrides.account;
    },
    claimSetup: async (id, sessionId) => {
      calls.push(['claimSetup', id, sessionId]);
      if (overrides.claimError) throw new Error('private database claim error');
      return overrides.claimId === undefined ? '44444444-4444-4444-8444-444444444444' : overrides.claimId;
    },
    releaseSetupClaim: async (id, claimId) => {
      calls.push(['releaseSetupClaim', id, claimId]);
      if (overrides.releaseError) throw new Error('private release error');
    },
    markSetupSession: async (id, sessionId, expiresAt, type, invitationId) => {
      calls.push(['markSetupSession', id, sessionId, expiresAt, type, invitationId]);
      if (overrides.bindError) throw new Error('private metadata error');
    },
    setPassword: async (id, password, sessionId, claimId) => {
      calls.push(['setPassword', id, password, sessionId, claimId]);
      if (overrides.passwordError) throw new Error('private auth error');
      return overrides.passwordResult ?? 'success';
    },
    revokeRefreshTokens: async (token) => {
      calls.push(['revokeRefreshTokens', token]);
      if (overrides.revokeError) throw new Error('private revoke error');
    },
    clearLocalSession: async () => {
      calls.push(['clearLocalSession']);
      if (overrides.clearError) throw new Error('private cookie error');
    },
    markSetupComplete: async (id, sessionId, claimId) => {
      calls.push(['markSetupComplete', id, sessionId, claimId]);
      if (overrides.markError) throw new Error('private metadata error');
    },
  };
}

test('trusted Superadmin can issue an invite for an approved existing unconfirmed identity', async () => {
  const deps = dependencies();
  const response = await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), deps);
  assert.equal(response.status, 202);
  assert.deepEqual(deps.calls.at(-1), ['sendInvite', 'user@example.test', 'https://hope.example/set-password?setup_invite_id=33333333-3333-4333-8333-333333333333', targetId, 'invite', '33333333-3333-4333-8333-333333333333']);
  assert.doesNotMatch(await response.text(), /user@example\.test|user-1/);
});

test('disabled setup and unauthorized issuers cannot send invitations', async () => {
  const disabled = dependencies({});
  disabled.enabled = false;
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), disabled)).status, 503);
  const nonAdmin = dependencies({ issuer: { allowed: true, role: 'admin' } });
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), nonAdmin)).status, 403);
  assert.equal(nonAdmin.calls.some(([name]) => name === 'sendInvite'), false);
});

test('cross-origin requests and unsafe callback origins cannot issue invitations', async () => {
  const crossOrigin = new Request('https://hope.example/api/auth/first-password', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example' },
    body: JSON.stringify({ authUserId: targetId }),
  });
  const deps = dependencies();
  assert.equal((await handleIssueFirstPasswordInvite(crossOrigin, deps)).status, 403);
  assert.equal(deps.calls.some(([name]) => name === 'sendInvite'), false);
  const unsafe = dependencies();
  unsafe.appOrigin = 'https://hope.example/other?next=https://other.example';
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), unsafe)).status, 503);
});

test('invalid and ineligible invite targets are rejected before email delivery', async () => {
  const invalidId = dependencies();
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: 'not-a-uuid' }), invalidId)).status, 400);
  const pending = dependencies({ target: {
    authUserId: targetId, email: 'user@example.test', authEmail: 'user@example.test', emailConfirmedAt: null, setupClaimId: null,
    account: { ...approvedSetupAccount, account_state: 'pending' },
  } });
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), pending)).status, 409);
  const confirmed = dependencies({ target: {
    authUserId: targetId, email: 'user@example.test', authEmail: 'user@example.test', emailConfirmedAt: '2026-11-01T00:00:00Z', setupClaimId: null, account: approvedSetupAccount,
  } });
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), confirmed)).status, 202);
  assert.equal(confirmed.calls.at(-1)[4], 'magiclink');
});

test('a UUID is normalized before matching the existing Auth identity', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const deps = dependencies({ invitedId: id, target: {
    authUserId: id, email: 'user@example.test', authEmail: 'user@example.test', emailConfirmedAt: null, setupClaimId: null, account: approvedSetupAccount,
  } });
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: id.toUpperCase() }), deps)).status, 202);
  assert.deepEqual(deps.calls[0], ['loadTarget', id]);
  assert.equal(deps.calls.at(-1)[3], id);
});

test('invite delivery and target lookup errors return generic unavailable responses', async () => {
  const delivery = dependencies({ inviteError: true });
  const deliveryResponse = await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), delivery);
  assert.equal(deliveryResponse.status, 503);
  assert.doesNotMatch(await deliveryResponse.text(), /private mail details|user@example\.test/);
  assert.ok(delivery.calls.some(([name]) => name === 'clearInvitation'));
  const target = dependencies({ targetError: true });
  assert.equal((await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), target)).status, 503);
});

test('an invitation that returns a different Auth identity is not reported as successful', async () => {
  const deps = dependencies({ invitedId: '22222222-2222-4222-8222-222222222222' });
  const response = await handleIssueFirstPasswordInvite(json({ authUserId: targetId }), deps);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /22222222|user@example\.test/);
});

test('explicit invite verification exposes only a setup-ready result', async () => {
  const deps = dependencies();
  const response = await handleVerifyFirstPasswordInvite(json({ tokenHash: 'one-time-hash', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333' }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { verified: true });
  assert.deepEqual(deps.calls.slice(-3), [['verifyInvite', 'one-time-hash', 'invite', '33333333-3333-4333-8333-333333333333'], ['lookupAccount', 'user-1'], ['markSetupSession', 'user-1', 'session-1', 2000000000, 'invite', '33333333-3333-4333-8333-333333333333']]);
});

test('a verified invite session is revoked if its trusted session binding cannot be saved', async () => {
  const deps = dependencies({ bindError: true });
  const response = await handleVerifyFirstPasswordInvite(json({ tokenHash: 'valid-hash', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333' }), deps);
  assert.equal(response.status, 503);
  assert.ok(deps.calls.some(([name]) => name === 'revokeRefreshTokens'));
  assert.ok(deps.calls.some(([name]) => name === 'clearLocalSession'));
});

test('malformed, expired, or reused invitation tokens fail without exposing Auth details', async () => {
  const malformed = dependencies();
  assert.equal((await handleVerifyFirstPasswordInvite(json({ tokenHash: '', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333', role: 'admin' }), malformed)).status, 400);
  const expired = dependencies({ verifiedSession: null });
  const response = await handleVerifyFirstPasswordInvite(json({ tokenHash: 'expired-or-used', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333' }), expired);
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /private auth details|expired-or-used/);
});

test('Supabase expired or used invite errors are classified as invalid links', () => {
  assert.equal(isInvalidInviteError({ status: 403, code: 'otp_expired' }), true);
  assert.equal(isInvalidInviteError({ status: 404, code: 'invite_not_found' }), true);
  assert.equal(isInvalidInviteError({ status: 400, code: 'validation_failed' }), true);
  assert.equal(isInvalidInviteError({ status: 401, code: 'invalid_api_key' }), false);
  assert.equal(isInvalidInviteError({ status: 503 }), false);
});

test('cross-origin verification and password completion are rejected before Auth operations', async () => {
  const request = (body) => new Request('https://hope.example/api/auth/first-password', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example' }, body: JSON.stringify(body),
  });
  const verification = dependencies();
  assert.equal((await handleVerifyFirstPasswordInvite(request({ tokenHash: 'valid-hash', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333' }), verification)).status, 403);
  assert.equal(verification.calls.some(([name]) => name === 'verifyInvite'), false);
  const completion = dependencies();
  assert.equal((await handleCompleteFirstPassword(request({ password: 'SecurePass123' }), completion)).status, 403);
  assert.equal(completion.calls.some(([name]) => name === 'setPassword'), false);
});

test('verification rejects and revokes sessions for accounts that are Pending, blocked, or deleted', async () => {
  for (const account of [
    { ...approvedSetupAccount, account_state: 'pending' },
    { ...approvedSetupAccount, is_blocked: true },
    { ...approvedSetupAccount, is_deleted: true },
  ]) {
    const deps = dependencies({ account });
    const response = await handleVerifyFirstPasswordInvite(json({ tokenHash: 'valid-hash', type: 'invite', invitationId: '33333333-3333-4333-8333-333333333333' }), deps);
    assert.equal(response.status, 403);
    assert.ok(deps.calls.some(([name]) => name === 'revokeRefreshTokens'));
    assert.ok(deps.calls.some(([name]) => name === 'clearLocalSession'));
  }
});

test('setup status requires a live eligible setup session', async () => {
  assert.equal((await handleFirstPasswordStatus(dependencies({ session: null }))).status, 401);
  assert.equal((await handleFirstPasswordStatus(dependencies())).status, 200);
  assert.equal((await handleFirstPasswordStatus(dependencies({ account: { ...approvedSetupAccount, is_blocked: true } }))).status, 403);
});

test('password completion revokes refresh tokens before setting the trusted completion marker', async () => {
  const deps = dependencies();
  const response = await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(deps.calls.slice(-5), [
    ['claimSetup', 'user-1', 'session-1'],
    ['setPassword', 'user-1', 'SecurePass123', 'session-1', '44444444-4444-4444-8444-444444444444'],
    ['revokeRefreshTokens', 'setup-access-token'],
    ['markSetupComplete', 'user-1', 'session-1', '44444444-4444-4444-8444-444444444444'],
    ['clearLocalSession'],
  ]);
  assert.doesNotMatch(await response.text(), /SecurePass123|setup-access-token/);
});

test('invalid passwords can be retried while the verified setup session remains active', async () => {
  const deps = dependencies({ passwordResult: 'invalid' });
  const response = await handleCompleteFirstPassword(json({ password: 'weak' }), deps);
  assert.equal(response.status, 400);
  assert.ok(deps.calls.some(([name]) => name === 'claimSetup'));
  assert.ok(deps.calls.some(([name]) => name === 'releaseSetupClaim'));
  assert.equal(deps.calls.some(([name]) => name === 'revokeRefreshTokens'), false);
  assert.equal(deps.calls.some(([name]) => name === 'markSetupComplete'), false);
});

test('concurrent completion requests allow only the atomic claim winner to set a password', async () => {
  const deps = dependencies();
  let claimed = false;
  let passwordCalls = 0;
  deps.claimSetup = async () => {
    if (claimed) return null;
    claimed = true;
    return '44444444-4444-4444-8444-444444444444';
  };
  deps.setPassword = async () => { passwordCalls += 1; return 'success'; };
  const [left, right] = await Promise.all([
    handleCompleteFirstPassword(json({ password: 'SecurePass123' }), deps),
    handleCompleteFirstPassword(json({ password: 'SecurePass123' }), deps),
  ]);
  assert.deepEqual([left.status, right.status].sort(), [200, 409]);
  assert.equal(passwordCalls, 1);
});

test('a failed Auth password update releases only its own claim for a valid retry', async () => {
  const deps = dependencies({ passwordResult: 'invalid' });
  assert.equal((await handleCompleteFirstPassword(json({ password: 'weak' }), deps)).status, 400);
  assert.ok(deps.calls.some(([name, , claimId]) => name === 'releaseSetupClaim' && claimId === '44444444-4444-4444-8444-444444444444'));
});

test('completion fails closed for missing sessions and ineligible accounts', async () => {
  assert.equal((await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), dependencies({ session: null }))).status, 401);
  for (const account of [
    { ...approvedSetupAccount, account_state: 'pending' },
    { ...approvedSetupAccount, is_blocked: true },
    { ...approvedSetupAccount, is_deleted: true },
  ]) {
    const deps = dependencies({ account });
    assert.equal((await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), deps)).status, 403);
    assert.ok(deps.calls.some(([name]) => name === 'revokeRefreshTokens'));
  }
});

test('completion does not mark setup complete when password setting or session revocation fails', async () => {
  const passwordFailure = dependencies({ passwordError: true });
  assert.equal((await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), passwordFailure)).status, 503);
  assert.equal(passwordFailure.calls.some(([name]) => name === 'markSetupComplete'), false);
  const revokeFailure = dependencies({ revokeError: true });
  assert.equal((await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), revokeFailure)).status, 503);
  assert.equal(revokeFailure.calls.some(([name]) => name === 'markSetupComplete'), false);
});

test('metadata update failure after revocation never reports setup success', async () => {
  const deps = dependencies({ markError: true });
  const response = await handleCompleteFirstPassword(json({ password: 'SecurePass123' }), deps);
  assert.equal(response.status, 503);
  assert.ok(deps.calls.some(([name]) => name === 'revokeRefreshTokens'));
  assert.doesNotMatch(await response.text(), /private metadata error|SecurePass123/);
});

test('malformed requests and unexpected database failures return controlled responses', async () => {
  const extra = await handleCompleteFirstPassword(json({ password: 'SecurePass123', app_metadata: { hope_first_password_complete: true } }), dependencies());
  assert.equal(extra.status, 400);
  const broken = dependencies({ accountError: true });
  const response = await handleFirstPasswordStatus(broken);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database details/);
});
