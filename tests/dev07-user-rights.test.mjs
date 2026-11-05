import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/auth/user-rights.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
const { handleReadUserRights, handleSaveUserRights, groupRights, getModuleSelection, setRightsSelection } = await import(moduleUrl);

const targetId = '11111111-1111-4111-8111-111111111111';
const moduleNames = [
  ['customer', 'Customer', 3],
  ['product', 'Product', 6],
  ['human_resources', 'Human Resources', 13],
  ['sales', 'Sales', 7],
  ['reports', 'Reports', 7],
];
const catalog = moduleNames.flatMap(([moduleCode, moduleName, count], moduleIndex) =>
  Array.from({ length: count }, (_, index) => ({
    moduleId: moduleIndex + 1,
    moduleCode,
    moduleName,
    rightId: moduleIndex * 20 + index + 1,
    rightCode: `${moduleCode}_right_${index + 1}`,
    rightName: `${moduleName} right ${index + 1}`,
    isAssigned: false,
  })),
);

function request(method, body, url = 'https://hope.example/api/user-management/rights', origin = 'https://hope.example') {
  return new Request(url, {
    method,
    headers: { origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    getActor: async () => overrides.actor === undefined ? { userId: targetId, role: 'admin' } : overrides.actor,
    loadRights: async (userId) => {
      calls.push(['loadRights', userId]);
      if (overrides.readError) throw overrides.readError;
      return overrides.rights ?? catalog;
    },
    saveRights: async (userId, rightIds) => {
      calls.push(['saveRights', userId, rightIds]);
      if (overrides.saveError) throw overrides.saveError;
      return overrides.saveResult ?? true;
    },
  };
}

test('User Management shows the full seeded catalogue grouped into five modules', async () => {
  const deps = dependencies({ actor: { userId: '22222222-2222-4222-8222-222222222222', role: 'superadmin' } });
  const response = await handleReadUserRights(request('GET', undefined, `https://hope.example/api/user-management/rights?userId=${targetId}`), deps);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.rights.length, 36);
  assert.deepEqual(groupRights(body.rights).map((module) => module.moduleName), [
    'Customer', 'Product', 'Human Resources', 'Sales', 'Reports',
  ]);
});

test('regular Users cannot read or update Rights Management', async () => {
  const read = dependencies({ actor: { userId: targetId, role: 'user' } });
  const readResponse = await handleReadUserRights(request('GET', undefined, `https://hope.example/api/user-management/rights?userId=${targetId}`), read);
  assert.equal(readResponse.status, 403);
  assert.equal(read.calls.length, 0);

  const save = dependencies({ actor: { userId: targetId, role: 'user' } });
  const saveResponse = await handleSaveUserRights(request('PATCH', { userId: targetId, rightIds: [1] }), save);
  assert.equal(saveResponse.status, 403);
  assert.equal(save.calls.length, 0);
});

test('Admin and Superadmin updates carry only the target and permission IDs', async () => {
  for (const role of ['admin', 'superadmin']) {
    const deps = dependencies({ actor: { userId: '22222222-2222-4222-8222-222222222222', role } });
    const response = await handleSaveUserRights(request('PATCH', { userId: targetId, rightIds: [2, 8] }), deps);
    assert.equal(response.status, 200);
    assert.deepEqual(deps.calls, [['saveRights', targetId, [2, 8]]]);
  }
});

test('invalid target IDs, forged actor fields, duplicate rights, and cross-origin writes are rejected', async () => {
  const invalidTarget = await handleReadUserRights(request('GET', undefined, 'https://hope.example/api/user-management/rights?userId=not-a-uuid'), dependencies());
  assert.equal(invalidTarget.status, 400);

  for (const body of [
    { userId: targetId, rightIds: [1], actorUserId: '22222222-2222-4222-8222-222222222222' },
    { userId: targetId, rightIds: [1], role: 'superadmin' },
    { userId: targetId, rightIds: [1, 1] },
    { userId: targetId, rightIds: [0] },
  ]) {
    assert.equal((await handleSaveUserRights(request('PATCH', body), dependencies())).status, 400);
  }

  const crossOrigin = await handleSaveUserRights(
    request('PATCH', { userId: targetId, rightIds: [] }, undefined, 'https://attacker.example'),
    dependencies(),
  );
  assert.equal(crossOrigin.status, 403);
});

test('a missing rights RPC fails closed without leaking database details', async () => {
  const deps = dependencies({ readError: { code: 'PGRST202', message: 'private RPC details' } });
  const response = await handleReadUserRights(request('GET', undefined, `https://hope.example/api/user-management/rights?userId=${targetId}`), deps);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private RPC details/);

  const saveResponse = await handleSaveUserRights(request('PATCH', { userId: targetId, rightIds: [] }), dependencies({
    saveError: { code: 'PGRST202', message: 'private RPC details' },
  }));
  assert.equal(saveResponse.status, 503);
  assert.doesNotMatch(await saveResponse.text(), /private RPC details/);
});

test('incomplete permission catalogues are unavailable instead of silently omitting rights', async () => {
  const response = await handleReadUserRights(
    request('GET', undefined, `https://hope.example/api/user-management/rights?userId=${targetId}`),
    dependencies({ rights: catalog.slice(0, 35) }),
  );
  assert.equal(response.status, 503);
});

test('module checkbox and All/None updates change only rights in that module', () => {
  const current = [1, 2, 4];
  assert.deepEqual(setRightsSelection(current, [1, 2, 3], true), [1, 2, 3, 4]);
  assert.deepEqual(setRightsSelection(current, [1, 2, 3], false), [4]);
  assert.deepEqual(setRightsSelection(current, [2], false), [1, 4]);
  assert.deepEqual(getModuleSelection([1, 2, 3], [1, 2]), { checked: false, indeterminate: true });
  assert.deepEqual(getModuleSelection([1, 2, 3], [1, 2, 3]), { checked: true, indeterminate: false });
  assert.deepEqual(getModuleSelection([1, 2, 3], []), { checked: false, indeterminate: false });
});

test('server and database permission errors remain denied, and false save results are not success', async () => {
  const denied = await handleReadUserRights(
    request('GET', undefined, `https://hope.example/api/user-management/rights?userId=${targetId}`),
    dependencies({ readError: { code: '42501', message: 'rights_target_forbidden' } }),
  );
  assert.equal(denied.status, 403);

  const falseSave = await handleSaveUserRights(
    request('PATCH', { userId: targetId, rightIds: [] }),
    dependencies({ saveResult: false }),
  );
  assert.equal(falseSave.status, 503);
});
