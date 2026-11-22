import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source, jsx = false) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined },
}).outputText;
const originSource = compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8'));
const mutationSource = (await readFile(new URL('../lib/customer-mutations.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${uri(originSource)}'`);
const mutations = await import(uri(compile(mutationSource)));
const { handleCreateCustomerRequest, handleUpdateCustomerRequest } = mutations;
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const actor = (role = 'user', rights = ['add_customer', 'edit_customer'], modules = ['customer']) => ({
  userId: '11111111-1111-4111-8111-111111111111', role, modules: modules.map((code) => ({ code })), rights,
});
const details = { name: 'Acme Clinic', address: '42 Main Street', paymentTerms: '30D' };
const request = (path, body, headers = {}) => new Request(`https://hope.example.test${path}`, {
  method: 'POST',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const dependencies = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor(),
  createCustomer: async () => {},
  updateCustomer: async () => true,
  ...overrides,
});

test('Add and Edit require the assigned Customer module and matching action right on the server', async () => {
  let writes = 0;
  for (const deniedActor of [null, actor('admin', []), actor('admin', ['add_customer'], ['reports'])]) {
    const response = await handleCreateCustomerRequest(request('/api/customer', { customerNo: 'C0091', ...details }), dependencies({
      getActor: async () => deniedActor,
      createCustomer: async () => { writes += 1; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  for (const deniedActor of [null, actor('admin', ['add_customer']), actor('user', ['edit_customer'], ['reports'])]) {
    const response = await handleUpdateCustomerRequest(request('/api/customer/C0091', details), 'C0091', dependencies({
      getActor: async () => deniedActor,
      updateCustomer: async () => { writes += 1; return true; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(writes, 0);
});

test('Add rejects cross-origin and non-JSON requests before authorization or mutation', async () => {
  let actorReads = 0;
  const deps = dependencies({ getActor: async () => { actorReads += 1; return actor(); } });
  const crossOrigin = await handleCreateCustomerRequest(request('/api/customer', { customerNo: 'C0091', ...details }, { origin: 'https://attacker.example' }), deps);
  const formPost = await handleCreateCustomerRequest(request('/api/customer', { customerNo: 'C0091', ...details }, { 'content-type': 'text/plain' }), deps);
  assert.equal(crossOrigin.status, 403);
  assert.equal(formPost.status, 403);
  assert.equal(actorReads, 0);
});

test('Add validates required values and accepts only the five requested fields', async () => {
  let writes = 0;
  for (const body of [
    { customerNo: 'C091', ...details },
    { customerNo: 'C0091', ...details, status: 'active' },
    { customerNo: 'C0091', ...details, name: 'x'.repeat(21) },
    { customerNo: 'C0091', ...details, address: 'x'.repeat(51) },
    { customerNo: 'C0091', ...details, paymentTerms: '60D' },
    { customerNo: 'C0091', ...details, name: '   ' },
  ]) {
    const response = await handleCreateCustomerRequest(request('/api/customer', body), dependencies({
      createCustomer: async () => { writes += 1; },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Add normalizes the customer number and trims required fields before insert', async () => {
  let inserted;
  const response = await handleCreateCustomerRequest(request('/api/customer', {
    customerNo: ' c0091 ', name: ' Acme Clinic ', address: ' 42 Main Street ', paymentTerms: '30D',
  }), dependencies({ createCustomer: async (input) => { inserted = input; } }));
  assert.equal(response.status, 201);
  assert.deepEqual(inserted, { customerNo: 'C0091', ...details });
  assert.deepEqual(await response.json(), { saved: true });
});

test('Duplicate customer number returns a safe conflict response', async () => {
  const response = await handleCreateCustomerRequest(request('/api/customer', { customerNo: 'C0091', ...details }), dependencies({
    createCustomer: async () => { throw { code: '23505', message: 'private database detail' }; },
  }));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private database detail/);
});

test('Edit is action-right checked and updates only the customer selected by its immutable path key', async () => {
  let update;
  const response = await handleUpdateCustomerRequest(request('/api/customer/c0091', details), 'c0091', dependencies({
    updateCustomer: async (...args) => { update = args; return true; },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(update, ['C0091', details, 'user']);
  assert.deepEqual(await response.json(), { saved: true });
});

test('Edit rejects identity, status, stamp, and soft-delete fields from the client', async () => {
  let writes = 0;
  for (const extra of [
    { customerNo: 'C0002' },
    { is_deleted: true },
    { stamp: 'forged' },
    { status: 'inactive' },
  ]) {
    const response = await handleUpdateCustomerRequest(request('/api/customer/C0001', { ...details, ...extra }), 'C0001', dependencies({
      updateCustomer: async () => { writes += 1; return true; },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Edit rejects a missing or malformed customer key without querying data', async () => {
  let reads = 0;
  const deps = dependencies({ updateCustomer: async () => { reads += 1; return true; } });
  assert.equal((await handleUpdateCustomerRequest(request('/api/customer/bad', details), 'bad', deps)).status, 404);
  assert.equal(reads, 0);
});

test('Database failures do not leak service details; absent updates return not found', async () => {
  const failure = await handleUpdateCustomerRequest(request('/api/customer/C0001', details), 'C0001', dependencies({
    updateCustomer: async () => { throw new Error('private Supabase detail'); },
  }));
  assert.equal(failure.status, 503);
  assert.doesNotMatch(await failure.text(), /private Supabase detail/);
  assert.equal((await handleUpdateCustomerRequest(request('/api/customer/C0001', details), 'C0001', dependencies({
    updateCustomer: async () => false,
  }))).status, 404);
});

async function mockServer({ role = 'user', rights = ['add_customer', 'edit_customer'], queryResult = { data: {
  custno: 'C0001', custname: details.name, address: details.address, payterm: '30D', is_deleted: false, stamp: 'EDIT actor',
}, error: null } } = {}) {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = { queries: [], access: { userId: actor().userId, role, modules: [{ code: 'customer' }], rights, unavailable: false }, queryResult };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__customerMutationServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = () => ({
    from(table) {
      const call = { table, filters: [] };
      const query = {
        select(columns) { call.columns = columns; return this; },
        insert(values) { call.insert = values; return this; },
        update(values) { call.update = values; return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        async maybeSingle() { globalThis.__customerMutationServer.queries.push(call); return globalThis.__customerMutationServer.queryResult; },
        then(resolve, reject) { globalThis.__customerMutationServer.queries.push(call); return Promise.resolve(globalThis.__customerMutationServer.queryResult).then(resolve, reject); },
      };
      return query;
    },
  });`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/customer-mutations-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__customerMutationServer = state;
  const { customerMutationDependencies } = await import(uri(compile(source)));
  return { state, deps: customerMutationDependencies() };
}

test('Service writes omit generated and identity fields and Users can update active rows only', async () => {
  const { state, deps } = await mockServer({ queryResult: { data: { custno: 'C0001' }, error: null } });
  await deps.createCustomer({ customerNo: 'C0001', ...details });
  assert.equal(state.queries[0].table, 'customer');
  assert.deepEqual(state.queries[0].insert, { custno: 'C0001', custname: details.name, address: details.address, payterm: '30D' });

  assert.equal(await deps.updateCustomer('C0001', details, 'user'), true);
  assert.deepEqual(state.queries[1].update, { custname: details.name, address: details.address, payterm: '30D' });
  assert.deepEqual(state.queries[1].filters, [['custno', 'C0001'], ['is_deleted', false]]);
});

test('Edit form reads active view for Users and Status/Stamp only for managers', async () => {
  const { state, deps } = await mockServer();
  await deps.getCustomerForEdit('C0001', 'user');
  assert.equal(state.queries[0].table, 'customer_active');
  assert.equal(state.queries[0].columns, 'custno,custname,address,payterm');

  await deps.getCustomerForEdit('C0001', 'admin');
  assert.equal(state.queries[1].table, 'customer');
  assert.match(state.queries[1].columns, /is_deleted,stamp/);
});

test('Customer list exposes only the actor’s assigned action rights to the server page', async () => {
  const page = await readFile(new URL('../app/erp/modules/customer/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /rights\.includes\('add_customer'\)/);
  assert.match(page, /rights\.includes\('edit_customer'\)/);
  assert.match(page, /customer\/new/);
  assert.match(page, /encodeURIComponent\(customer\.customerNo\)/);
  assert.match(page, /\/edit/);
});
