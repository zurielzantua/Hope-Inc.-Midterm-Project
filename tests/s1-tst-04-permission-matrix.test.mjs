import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

const originModule = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const managementSource = compile((await readFile(new URL('../lib/auth/user-management.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`));
const rightsSource = compile((await readFile(new URL('../lib/auth/user-rights.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`));
const management = await import(uri(managementSource));
const rights = await import(uri(rightsSource));

const APP_ORIGIN = 'https://hope.example';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const headers = { origin: APP_ORIGIN, 'content-type': 'application/json' };

function request(path, method = 'GET', body) {
  return new Request(`${APP_ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function managementDeps({ role = 'user', actor = true } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      appOrigin: APP_ORIGIN,
      getActor: async () => (actor ? { userId: ACTOR_ID, role } : null),
      listUsers: async (actorRole) => { calls.push(['listUsers', actorRole]); return []; },
      createUser: async (input) => { calls.push(['createUser', input]); return Response.json({}, { status: 201 }); },
      updateUser: async (actor, userId, change) => {
        calls.push(['updateUser', actor, userId, change]);
        return { authUserId: userId, roleCode: 'user', accountState: 'approved', isBlocked: false };
      },
    },
  };
}

function rightsDeps({ role = 'user', actor = true } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      appOrigin: APP_ORIGIN,
      getActor: async () => (actor ? { userId: ACTOR_ID, role } : null),
      loadRights: async (userId) => { calls.push(['loadRights', userId]); return []; },
      saveRights: async (userId, rightIds) => { calls.push(['saveRights', userId, rightIds]); return true; },
    },
  };
}

test('SRV-01: a User cannot list, create, or update users through the server handlers', async () => {
  const { deps, calls } = managementDeps({ role: 'user' });

  for (const response of [
    await management.handleListManagedUsers(deps),
    await management.handleCreateManagedUser(request('/api/user-management', 'POST', {
      firstName: 'Test', lastName: 'User', email: 'test.user@example.test',
    }), deps),
    await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
      userId: TARGET_ID, isBlocked: true,
    }), deps),
  ]) {
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'You cannot access User Management.' });
  }

  assert.deepEqual(calls, []);
});

test('SRV-01 and SRV-02: a User cannot read or save access rights', async () => {
  const read = rightsDeps({ role: 'user' });
  const write = rightsDeps({ role: 'user' });

  const readResponse = await rights.handleReadUserRights(
    request(`/api/user-management/rights?userId=${TARGET_ID}`), read.deps,
  );
  const writeResponse = await rights.handleSaveUserRights(
    request('/api/user-management/rights', 'PATCH', { userId: TARGET_ID, rightIds: [1, 2, 3] }), write.deps,
  );

  assert.equal(readResponse.status, 403);
  assert.equal(writeResponse.status, 403);
  assert.deepEqual(read.calls, []);
  assert.deepEqual(write.calls, []);
});

test('SRV-02: an Admin cannot approve accounts or designate Admins', async () => {
  const { deps, calls } = managementDeps({ role: 'admin' });

  const approve = await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
    userId: TARGET_ID, accountState: 'approved',
  }), deps);
  const promote = await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
    userId: TARGET_ID, roleCode: 'admin',
  }), deps);

  assert.equal(approve.status, 403);
  assert.equal(promote.status, 403);
  assert.deepEqual(await approve.json(), { error: 'Only a Superadmin can approve accounts.' });
  assert.deepEqual(await promote.json(), { error: 'Only a Superadmin can designate Admin accounts.' });
  assert.deepEqual(calls, []);
});

test('SRV-02: the Admin hierarchy never includes Superadmin accounts', () => {
  assert.equal(management.canManageUserRole('admin', 'user'), true);
  assert.equal(management.canManageUserRole('admin', 'admin'), false);
  assert.equal(management.canManageUserRole('admin', 'superadmin'), false);
  assert.equal(management.canManageUserRole('superadmin', 'superadmin'), true);
  assert.deepEqual(management.visibleRoleCodes('admin'), ['user']);
  assert.deepEqual(management.visibleRoleCodes('superadmin'), ['user', 'admin', 'superadmin']);
});

test('SRV-03: a re-enabled User control is still refused by the server', async () => {
  const block = managementDeps({ role: 'user' });
  const save = rightsDeps({ role: 'user' });

  const blockResponse = await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
    userId: TARGET_ID, isBlocked: true,
  }), block.deps);
  const saveResponse = await rights.handleSaveUserRights(request('/api/user-management/rights', 'PATCH', {
    userId: TARGET_ID, rightIds: [1],
  }), save.deps);

  assert.equal(blockResponse.status, 403);
  assert.equal(saveResponse.status, 403);
  assert.deepEqual(block.calls, []);
  assert.deepEqual(save.calls, []);
});

test('SRV-04: requests without an authenticated session are declined with 401', async () => {
  const managementAccess = managementDeps({ actor: false });
  const rightsAccess = rightsDeps({ actor: false });

  const listResponse = await management.handleListManagedUsers(managementAccess.deps);
  const rightsResponse = await rights.handleReadUserRights(
    request(`/api/user-management/rights?userId=${TARGET_ID}`), rightsAccess.deps,
  );

  assert.equal(listResponse.status, 401);
  assert.equal(rightsResponse.status, 401);
  assert.deepEqual(managementAccess.calls, []);
  assert.deepEqual(rightsAccess.calls, []);
});

test('SRV-02: a Superadmin can approve and designate an Admin', async () => {
  const { deps, calls } = managementDeps({ role: 'superadmin' });

  const approve = await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
    userId: TARGET_ID, accountState: 'approved',
  }), deps);
  const promote = await management.handleUpdateManagedUser(request('/api/user-management/update', 'PATCH', {
    userId: TARGET_ID, roleCode: 'admin',
  }), deps);

  assert.equal(approve.status, 200);
  assert.equal(promote.status, 200);
  assert.deepEqual(calls.map(([name, , userId, change]) => [name, userId, change]), [
    ['updateUser', TARGET_ID, { accountState: 'approved' }],
    ['updateUser', TARGET_ID, { roleCode: 'admin' }],
  ]);
});

test('writes from another origin or without JSON are refused before authorization', async () => {
  const { deps, calls } = managementDeps({ role: 'superadmin' });
  const crossOrigin = new Request('https://hope.example/api/user-management/update', {
    method: 'PATCH',
    headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify({ userId: TARGET_ID, isBlocked: true }),
  });
  const formPost = new Request('https://hope.example/api/user-management/update', {
    method: 'PATCH',
    headers: { origin: APP_ORIGIN, 'content-type': 'text/plain' },
    body: JSON.stringify({ userId: TARGET_ID, isBlocked: true }),
  });

  assert.equal((await management.handleUpdateManagedUser(crossOrigin, deps)).status, 403);
  assert.equal((await management.handleUpdateManagedUser(formPost, deps)).status, 403);
  assert.deepEqual(calls, []);
});
