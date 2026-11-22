import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const originModule = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const mutationSource = (await readFile(new URL('../lib/customer-mutations.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`);
const { handleCustomerStatusRequest } = await import(uri(compile(mutationSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const actor = (rights = ['delete_customer'], modules = ['customer']) => ({
  userId: '11111111-1111-4111-8111-111111111111', role: 'user',
  modules: modules.map((code) => ({ code })), rights,
});
const request = (body, headers = {}) => new Request('https://hope.example.test/api/customer/C0001/status', {
  method: 'PATCH',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const dependencies = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor(),
  createCustomer: async () => {},
  updateCustomer: async () => true,
  updateCustomerStatus: async () => true,
  ...overrides,
});

test('Soft delete and restore both require the server-derived Customer delete right', async () => {
  let writes = 0;
  for (const deniedActor of [null, actor([]), actor(['delete_customer'], ['reports'])]) {
    const response = await handleCustomerStatusRequest(request({ isDeleted: true }), 'C0001', dependencies({
      getActor: async () => deniedActor,
      updateCustomerStatus: async () => { writes += 1; return true; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(writes, 0);
});

test('Cross-origin and non-JSON status requests fail before authorization or mutation', async () => {
  let actorReads = 0;
  const deps = dependencies({ getActor: async () => { actorReads += 1; return actor(); } });
  assert.equal((await handleCustomerStatusRequest(request({ isDeleted: true }, { origin: 'https://attacker.example' }), 'C0001', deps)).status, 403);
  assert.equal((await handleCustomerStatusRequest(request({ isDeleted: true }, { 'content-type': 'text/plain' }), 'C0001', deps)).status, 403);
  assert.equal(actorReads, 0);
});

test('Status API accepts only the target transition field', async () => {
  let writes = 0;
  for (const body of [
    {},
    { isDeleted: 'true' },
    { isDeleted: true, role: 'superadmin' },
    { isDeleted: true, userId: '22222222-2222-4222-8222-222222222222' },
  ]) {
    const response = await handleCustomerStatusRequest(request(body), 'C0001', dependencies({
      updateCustomerStatus: async () => { writes += 1; return true; },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Soft delete and restore use the route identity and return success without client-supplied status fields', async () => {
  const transitions = [];
  for (const isDeleted of [true, false]) {
    const response = await handleCustomerStatusRequest(request({ isDeleted }), 'c0001', dependencies({
      updateCustomerStatus: async (...args) => { transitions.push(args); return true; },
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { saved: true });
  }
  assert.deepEqual(transitions, [['C0001', true], ['C0001', false]]);
});

test('Active child-record trigger errors map to a safe conflict response', async () => {
  const response = await handleCustomerStatusRequest(request({ isDeleted: true }), 'C0001', dependencies({
    updateCustomerStatus: async () => { throw {
      code: 'P0001', message: 'Cannot delete customer row: 2 active related record(s) still exist.',
    }; },
  }));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), {
    code: 'ACTIVE_DEPENDENTS',
    message: 'This customer has active related records and cannot be deactivated.',
  });
});

test('Unrecognized database failures do not leak internal details and stale state does not report success', async () => {
  const failed = await handleCustomerStatusRequest(request({ isDeleted: true }), 'C0001', dependencies({
    updateCustomerStatus: async () => { throw { code: 'P0001', message: 'private database detail' }; },
  }));
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private database detail/);

  const stale = await handleCustomerStatusRequest(request({ isDeleted: true }), 'C0001', dependencies({
    updateCustomerStatus: async () => false,
  }));
  assert.equal(stale.status, 404);
});

async function mockServer() {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = { calls: [], result: { data: { custno: 'C0001' }, error: null } };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__customerStatusServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = () => ({
    from(table) {
      const call = { table, filters: [] };
      return {
        update(values) { call.update = values; return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        select(columns) { call.columns = columns; return this; },
        async maybeSingle() { globalThis.__customerStatusServer.calls.push(call); return globalThis.__customerStatusServer.result; },
      };
    },
  });`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/customer-mutations-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__customerStatusServer = {
    ...state,
    access: { userId: actor().userId, role: 'user', modules: [{ code: 'customer' }], rights: ['delete_customer'], unavailable: false },
  };
  const { customerMutationDependencies } = await import(uri(compile(source)));
  return { state: globalThis.__customerStatusServer, deps: customerMutationDependencies() };
}

test('Database adapter changes only is_deleted and guards the expected prior state', async () => {
  const { state, deps } = await mockServer();
  assert.equal(await deps.updateCustomerStatus('C0001', true), true);
  assert.deepEqual(state.calls[0], {
    table: 'customer', update: { is_deleted: true }, filters: [['custno', 'C0001'], ['is_deleted', false]], columns: 'custno',
  });
  assert.equal(await deps.updateCustomerStatus('C0001', false), true);
  assert.deepEqual(state.calls[1].filters, [['custno', 'C0001'], ['is_deleted', true]]);
});

test('Customer list exposes status actions only when the server loader returns delete_customer', async () => {
  const page = await readFile(new URL('../app/erp/modules/customer/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /rights\.includes\('delete_customer'\)/);
  assert.match(page, /<CustomerStatusAction/);
  assert.match(page, /status === 'inactive'/);
  const action = await readFile(new URL('../app/erp/modules/customer/customer-status-action.tsx', import.meta.url), 'utf8');
  assert.match(action, /\/status/);
  assert.match(action, /router\.replace/);
});
