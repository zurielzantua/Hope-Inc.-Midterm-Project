import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const originModule = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const mutationSource = (await readFile(new URL('../lib/product-mutations.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`);
const { handleProductStatusRequest } = await import(uri(compile(mutationSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const actor = (role = 'user', rights = ['delete_product'], modules = ['product']) => ({
  userId: '11111111-1111-4111-8111-111111111111', role, modules: modules.map((code) => ({ code })), rights,
});
const request = (body, headers = {}) => new Request('https://hope.example.test/api/product/AD0001/status', {
  method: 'PATCH',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const dependencies = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor(),
  updateProductStatus: async () => true,
  ...overrides,
});

test('Soft delete requires delete_product and the verified Product module', async () => {
  let writes = 0;
  for (const deniedActor of [null, actor('user', []), actor('admin', ['delete_product'], ['customer'])]) {
    const response = await handleProductStatusRequest(request({ isDeleted: true }), 'AD0001', dependencies({
      getActor: async () => deniedActor,
      updateProductStatus: async () => { writes += 1; return true; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(writes, 0);
});

test('Users may deactivate with the assigned right, but only Admins and Superadmins may restore', async () => {
  const transitions = [];
  for (const [role, isDeleted] of [['user', true], ['admin', false], ['superadmin', false]]) {
    const response = await handleProductStatusRequest(request({ isDeleted }), 'ad0001', dependencies({
      getActor: async () => actor(role, role === 'user' ? ['delete_product'] : []),
      updateProductStatus: async (...args) => { transitions.push(args); return true; },
    }));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(transitions, [['AD0001', true], ['AD0001', false], ['AD0001', false]]);

  let writes = 0;
  const denied = await handleProductStatusRequest(request({ isDeleted: false }), 'AD0001', dependencies({
    updateProductStatus: async () => { writes += 1; return true; },
  }));
  assert.equal(denied.status, 403);
  assert.equal(writes, 0);

  const wrongModuleRestore = await handleProductStatusRequest(request({ isDeleted: false }), 'AD0001', dependencies({
    getActor: async () => actor('admin', [], ['customer']),
    updateProductStatus: async () => { writes += 1; return true; },
  }));
  assert.equal(wrongModuleRestore.status, 403);
  assert.equal(writes, 0);
});

test('Direct requests reject forged identity, status, and generated fields', async () => {
  let writes = 0;
  for (const body of [
    {}, { isDeleted: 'true' }, { isDeleted: true, role: 'superadmin' },
    { isDeleted: true, userId: '22222222-2222-4222-8222-222222222222' },
    { isDeleted: true, stamp: 'forged' }, { isDeleted: true, prodcode: 'AD0002' },
    { isDeleted: true, is_deleted: false },
  ]) {
    const response = await handleProductStatusRequest(request(body), 'AD0001', dependencies({
      updateProductStatus: async () => { writes += 1; return true; },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Stale status and malformed route keys do not report success', async () => {
  const stale = await handleProductStatusRequest(request({ isDeleted: true }), 'AD0001', dependencies({
    updateProductStatus: async () => false,
  }));
  assert.equal(stale.status, 404);
  assert.match((await stale.json()).error, /status has changed/);
  assert.equal((await handleProductStatusRequest(request({ isDeleted: true }), 'bad', dependencies())).status, 404);
});

test('Only the exact Product active-dependents trigger error maps to the safe conflict response', async () => {
  const blocked = await handleProductStatusRequest(request({ isDeleted: true }), 'AD0001', dependencies({
    updateProductStatus: async () => { throw {
      code: 'P0001', message: 'Cannot delete product row: 2 active related record(s) still exist.',
    }; },
  }));
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), {
    code: 'ACTIVE_DEPENDENTS',
    message: 'This product has active related records and cannot be deactivated.',
  });

  for (const error of [
    { code: '23514', message: 'Cannot delete product row: 2 active related record(s) still exist.' },
    { code: 'P0001', message: 'Cannot delete product row: 2 active related record(s) still exist. private detail' },
    { code: 'P0001', message: 'private database detail' },
  ]) {
    const response = await handleProductStatusRequest(request({ isDeleted: true }), 'AD0001', dependencies({
      updateProductStatus: async () => { throw error; },
    }));
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private database detail|active related record/);
  }
});

test('Database adapter changes only is_deleted and atomically compares the expected previous state', async () => {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = { calls: [] };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__productStatusServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = () => ({ from(table) {
    const call = { table, filters: [] };
    return {
      update(values) { call.update = values; return this; },
      eq(column, value) { call.filters.push([column, value]); return this; },
      select(columns) { call.columns = columns; return this; },
      async maybeSingle() { globalThis.__productStatusServer.calls.push(call); return { data: { prodcode: 'AD0001' }, error: null }; },
    };
  } });`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/product-mutations-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__productStatusServer = { ...state, access: { userId: actor().userId, role: 'admin', modules: [{ code: 'product' }], rights: ['delete_product'], unavailable: false } };
  const { productMutationDependencies } = await import(uri(compile(source)));
  const deps = productMutationDependencies();
  assert.equal(await deps.updateProductStatus('AD0001', true), true);
  assert.equal(await deps.updateProductStatus('AD0001', false), true);
  assert.deepEqual(globalThis.__productStatusServer.calls, [
    { table: 'product', update: { is_deleted: true }, filters: [['prodcode', 'AD0001'], ['is_deleted', false]], columns: 'prodcode' },
    { table: 'product', update: { is_deleted: false }, filters: [['prodcode', 'AD0001'], ['is_deleted', true]], columns: 'prodcode' },
  ]);
});

test('Delete controls follow delete_product while manager Restore stays available', async () => {
  const page = await readFile(new URL('../app/erp/modules/product/page.tsx', import.meta.url), 'utf8');
  const action = await readFile(new URL('../app/erp/modules/product/product-status-action.tsx', import.meta.url), 'utf8');
  assert.match(page, /rights\.includes\('delete_product'\)/);
  assert.match(page, /const canRestore = isManager/);
  assert.match(page, /product\.status === 'inactive' \? canRestore : canDelete/);
  assert.match(page, /<ProductStatusAction/);
  assert.match(page, /canAdd && <Link href="\/erp\/modules\/product\/new"/);
  assert.match(page, /canEdit && <Link href=\{`\/erp\/modules\/product/);
  assert.match(action, /\/api\/product\/.*\/status/);

  const serverList = await readFile(new URL('../lib/product-list-server.ts', import.meta.url), 'utf8');
  assert.match(serverList, /role === 'user' \|\| status === 'active'/);
  assert.match(serverList, /'product_active'/);
});
