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
    getActorRole: async () => overrides.role === undefined ? 'admin' : overrides.role,
    listUsers: async (role) => { calls.push(['listUsers', role]); return overrides.users ?? []; },
    createUser: async (input) => { calls.push(['createUser', input]); return overrides.createResponse ?? Response.json({ status: 'pending' }, { status: 201 }); },
    updateUser: async (role, userId, changes) => {
      calls.push(['updateUser', role, userId, changes]);
      if (overrides.updateError) throw new Error('private database details');
      return overrides.updatedUser === undefined ? { authUserId: userId, ...changes } : overrides.updatedUser;
    },
  };
}

test('role hierarchy lets Admin manage Users and Superadmin manage User/Admin, never Superadmin', () => {
  assert.equal(canManageUserRole('admin', 'user'), true);
  assert.equal(canManageUserRole('admin', 'admin'), false);
  assert.equal(canManageUserRole('admin', 'superadmin'), false);
  assert.equal(canManageUserRole('superadmin', 'user'), true);
  assert.equal(canManageUserRole('superadmin', 'admin'), true);
  assert.equal(canManageUserRole('superadmin', 'superadmin'), false);
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
  assert.equal((await handleListManagedUsers(dependencies({ role: null }))).status, 401);
  assert.equal((await handleListManagedUsers(dependencies({ role: 'user' }))).status, 403);
  const admin = dependencies();
  assert.equal((await handleListManagedUsers(admin)).status, 200);
  assert.deepEqual(admin.calls, [['listUsers', 'admin']]);
  const superadmin = dependencies({ role: 'superadmin' });
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
  assert.equal((await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ role: 'user' }))).status, 403);
});

test('duplicate and unavailable provisioning errors stay generic', async () => {
  const duplicate = await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ createResponse: Response.json({ error: 'duplicate details' }, { status: 409 }) }));
  assert.equal(duplicate.status, 409);
  assert.doesNotMatch(await duplicate.text(), /duplicate details/);
  assert.equal((await handleCreateManagedUser(post('/api/user-management', { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' }), dependencies({ createResponse: Response.json({ error: 'private details' }, { status: 503 }) }))).status, 503);
});

test('Edit accepts names only; Block/Unblock accepts a boolean only', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const edit = dependencies({ role: 'superadmin' });
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, firstName: 'Ana', lastName: 'Reyes' }), edit)).status, 200);
  assert.deepEqual(edit.calls, [['updateUser', 'superadmin', id, { firstName: 'Ana', lastName: 'Reyes' }]]);
  const block = dependencies();
  assert.equal((await handleUpdateManagedUser(patch({ userId: id, isBlocked: true }), block)).status, 200);
  assert.deepEqual(block.calls, [['updateUser', 'admin', id, { isBlocked: true }]]);
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
  const failed = await handleUpdateManagedUser(patch({ userId: '11111111-1111-4111-8111-111111111111', isBlocked: true }), dependencies({ updateError: true }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private database details/);
});
