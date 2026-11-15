import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/auth/user-management.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { canManageUserRole, visibleRoleCodes, accountStatusLabel, handleListManagedUsers, handleCreateManagedUser, handleUpdateManagedUser } =
  await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

const post = (path, body, origin = 'https://hope.example') => new Request(`https://hope.example${path}`, {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const patch = (body, origin = 'https://hope.example') => new Request('https://hope.example/api/user-management', {
  method: 'PATCH', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    getActor: async () => overrides.actor === undefined ? { userId: 'manager-1', role: 'admin' } : overrides.actor,
    listUsers: async (role) => { calls.push(['listUsers', role]); return overrides.users ?? []; },
    createUser: async (input) => { calls.push(['createUser', input]); return overrides.createResponse ?? Response.json({ status: 'pending' }, { status: 201 }); },
    updateUser: async (actor, userId, changes) => {
      calls.push(['updateUser', actor, userId, changes]);
      if (overrides.updateError) throw overrides.updateError;
      return overrides.updatedUser === undefined ? { authUserId: userId, ...changes } : overrides.updatedUser;
    },
  };
}

test('role hierarchy limits Admins and leaves Superadmin account safety to the database guard', () => {
  assert.equal(canManageUserRole('admin', 'user'), true);
  assert.equal(canManageUserRole('admin', 'admin'), false);
  assert.equal(canManageUserRole('admin', 'superadmin'), false);
  assert.equal(canManageUserRole('superadmin', 'user'), true);
  assert.equal(canManageUserRole('superadmin', 'admin'), true);
  assert.equal(canManageUserRole('superadmin', 'superadmin'), true);
  assert.equal(canManageUserRole('user', 'user'), false);
  assert.deepEqual(visibleRoleCodes('admin'), ['user']);
  assert.deepEqual(visibleRoleCodes('superadmin'), ['user', 'admin', 'superadmin']);
});

test('account status gives Blocked precedence over Pending and recognizes deleted rows', () => {
  assert.equal(accountStatusLabel({ is_deleted: true, is_blocked: true, account_state: 'pending' }), 'Deleted');
  assert.equal(accountStatusLabel({ is_deleted: false, is_blocked: true, account_state: 'pending' }), 'Blocked');
  assert.equal(accountStatusLabel({ is_deleted: false, is_blocked: false, account_state: 'pending' }), 'Pending');
  assert.equal(accountStatusLabel({ is_deleted: false, is_blocked: false, account_state: 'approved' }), 'Approved');
});

test('only Admin and Superadmin can list managed users', async () => {
  assert.equal((await handleListManagedUsers(dependencies({ actor: null }))).status, 401);
  assert.equal((await handleListManagedUsers(dependencies({ actor: { userId: 'user-1', role: 'user' } }))).status, 403);
  const admin = dependencies();
  assert.equal((await handleListManagedUsers(admin)).status, 200);
  assert.deepEqual(admin.calls, [['listUsers', 'admin']]);
  const superadmin = dependencies({ actor: { userId: 'root-1', role: 'superadmin' } });
  assert.equal((await handleListManagedUsers(superadmin)).status, 200);
  assert.deepEqual(superadmin.calls, [['listUsers', 'superadmin']]);
});

test('Add User accepts only name and email, normalizes values, and creates a Pending account', async () => {
  const deps = dependencies();
  const response = await handleCreateManagedUser(post('/api/user-management', { firstName: ' Ana ', lastName: ' Santos ', email: ' ANA@example.test ' }), deps);
  assert.equal(response.status, 201);
  assert.deepEqual(deps.calls, [['createUser', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }]]);
  assert.deepEqual(await response.json(), { status: 'pending' });
});

test('Admin creation rejects malformed input, privilege fields, and cross-origin posts', async () => {
  for (const body of [
    { firstName: '', lastName: 'Santos', email: 'ana@example.test' },
    { firstName: 'Ana', lastName: 'Santos', email: 'bad' },
    { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test', role: 'admin' },
    { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test', account_state: 'approved' },
    { firstName: 'x'.repeat(101), lastName: 'Santos', email: 'ana@example.test' },
  ]) assert.equal((await handleCreateManagedUser(post('/api/user-management', body), dependencies())).status, 400);
  assert.equal((await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }, 'https://attacker.example'), dependencies())).status, 403);
  assert.equal((await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ actor: { userId: 'user-1', role: 'user' } }))).status, 403);
});

test('duplicate and unavailable provisioning errors stay generic', async () => {
  const duplicate = await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ createResponse: Response.json({ error: 'duplicate details' }, { status: 409 }) }));
  assert.equal(duplicate.status, 409);
  assert.doesNotMatch(await duplicate.text(), /duplicate details/);
  assert.equal((await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ createResponse: Response.json({ error: 'private details' }, { status: 503 }) }))).status, 503);
});

test('Edit accepts names only; Block/Unblock accepts a boolean only', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const edit = dependencies({ actor: { userId: 'root-1', role: 'superadmin' } });
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, firstName: 'Ana', lastName: 'Reyes' }), edit)).status, 200);
  assert.deepEqual(edit.calls, [['updateUser', { userId: 'root-1', role: 'superadmin' }, id, { firstName: 'Ana', lastName: 'Reyes' }]]);
  const block = dependencies();
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), block)).status, 200);
  assert.deepEqual(block.calls, [['updateUser', { userId: 'manager-1', role: 'admin' }, id, { isBlocked: true }]]);
  for (const body of [
    { userId: id, email: 'new@example.test' },
    { userId: id, role: 'admin' },
    { userId: id, account_state: 'approved' },
    { userId: id, isBlocked: 'true' },
  ]) assert.equal((await handleUpdateManagedUser(patch(body), dependencies())).status, 400);
});

test('Update rejects invalid IDs, cross-origin calls, and unavailable targets safely', async () => {
  assert.equal((await handleUpdateManagedUser(patch({ userId: 'not-an-id', isBlocked: true }), dependencies())).status, 400);
  assert.equal((await handleUpdateManagedUser(patch({ userId: '11111111-1111-4111-8111-111111111111', isBlocked: true }, 'https://attacker.example'), dependencies())).status, 403);
  const missing = await handleUpdateManagedUser(patch({ userId: '11111111-1111-4111-8111-111111111111', isBlocked: true }), dependencies({ updatedUser: null }));
  assert.equal(missing.status, 404);
  const failed = await handleUpdateManagedUser(patch({ userId: '11111111-1111-4111-8111-111111111111', isBlocked: true }), dependencies({ updateError: new Error('private database details') }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private database details/);
});

test('only Superadmin can approve Pending Users or designate approved Users as Admin', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const pendingUpdate = { userId: id, accountState: 'approved' };
  const adminApproval = dependencies();
  assert.equal((await handleUpdateManagedUser(patch(pendingUpdate), adminApproval)).status, 403);
  assert.equal(adminApproval.calls.length, 0);
  const superadmin = dependencies({ actor: { userId: 'root-1', role: 'superadmin' } });
  assert.equal((await handleUpdateManagedUser(patch(pendingUpdate), superadmin)).status, 200);
  assert.deepEqual(superadmin.calls, [['updateUser', { userId: 'root-1', role: 'superadmin' }, id, { accountState: 'approved' }]]);
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, roleCode: 'admin' }), dependencies())).status, 403);
  const promote = dependencies({ actor: { userId: 'root-1', role: 'superadmin' } });
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, roleCode: 'admin' }), promote)).status, 200);
  assert.deepEqual(promote.calls, [['updateUser', { userId: 'root-1', role: 'superadmin' }, id, { roleCode: 'admin' }]]);
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, accountState: 'pending' }), dependencies({ actor: { userId: 'root-1', role: 'superadmin' } }))).status, 400);
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, roleCode: 'superadmin' }), dependencies({ actor: { userId: 'root-1', role: 'superadmin' } }))).status, 400);
});

test('last active Superadmin guard failures return a conflict instead of a generic service error', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const blocked = await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), dependencies({
    actor: { userId: 'root-2', role: 'superadmin' },
    updateError: { code: '23514', message: 'last_active_superadmin' },
  }));
  assert.equal(blocked.status, 409);
  assert.match(await blocked.text(), /last active Superadmin/);
});

test('a missing database action fails closed with an explicit unavailable error', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const unavailable = await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), dependencies({
    actor: { userId: 'root-1', role: 'superadmin' },
    updateError: { code: 'RPC_UNAVAILABLE', message: 'Account management RPC is unavailable' },
  }));
  assert.equal(unavailable.status, 503);
  assert.match(await unavailable.text(), /database update that has not been deployed/);
});

test('database actor checks surface as authorization errors, not service failures', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const forgedActor = await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), dependencies({
    actor: { userId: 'root-1', role: 'superadmin' },
    updateError: { code: '42501', message: 'superadmin_actor_required' },
  }));
  assert.equal(forgedActor.status, 403);
  assert.match(await forgedActor.text(), /active Superadmin/);
  const selfBlock = await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), dependencies({
    actor: { userId: 'root-1', role: 'superadmin' },
    updateError: { code: '42501', message: 'self_block_forbidden' },
  }));
  assert.equal(selfBlock.status, 403);
  assert.match(await selfBlock.text(), /cannot block your own account/);
});
