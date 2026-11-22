import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source, jsx = false) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined },
}).outputText;
const originSource = compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8'));
const mutationSource = (await readFile(new URL('../lib/product-mutations.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${uri(originSource)}'`);
const { handleCreateProductRequest, handleUpdateProductRequest } = await import(uri(compile(mutationSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const actor = (role = 'user', rights = ['add_product', 'edit_product'], modules = ['product']) => ({
  userId: '11111111-1111-4111-8111-111111111111', role, modules: modules.map((code) => ({ code })), rights,
});
const fields = { description: 'Widget', unit: 'ea' };
const request = (path, body, headers = {}) => new Request(`https://hope.example.test${path}`, {
  method: 'POST',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const dependencies = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor(),
  createProduct: async () => {},
  updateProduct: async () => true,
  ...overrides,
});

test('Add and Edit require the Product module and matching action right before any write', async () => {
  let writes = 0;
  for (const deniedActor of [null, actor('admin', []), actor('admin', ['add_product'], ['reports'])]) {
    const response = await handleCreateProductRequest(request('/api/product', { productCode: 'AD0042', ...fields }), dependencies({
      getActor: async () => deniedActor,
      createProduct: async () => { writes += 1; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  for (const deniedActor of [null, actor('admin', ['add_product']), actor('user', ['edit_product'], ['reports'])]) {
    const response = await handleUpdateProductRequest(request('/api/product/AD0001', fields), 'AD0001', dependencies({
      getActor: async () => deniedActor,
      updateProduct: async () => { writes += 1; return true; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  assert.equal(writes, 0);
});

test('Add rejects malformed codes, empty/long descriptions, invalid units, and extra generated fields', async () => {
  let writes = 0;
  for (const body of [
    { productCode: 'AD042', ...fields },
    { productCode: 'AD0042', ...fields, status: 'active' },
    { productCode: 'AD0042', ...fields, description: '   ' },
    { productCode: 'AD0042', ...fields, description: 'x'.repeat(31) },
    { productCode: 'AD0042', ...fields, unit: 'kg' },
    { productCode: 'AD0042', ...fields, unit: '' },
    { productCode: 'AD0042', ...fields, stamp: 'forged' },
  ]) {
    const response = await handleCreateProductRequest(request('/api/product', body), dependencies({
      createProduct: async () => { writes += 1; },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Add normalizes the unique code and trims description before insert', async () => {
  let inserted;
  const response = await handleCreateProductRequest(request('/api/product', {
    productCode: ' ad0042 ', description: ' Widget ', unit: 'ea',
  }), dependencies({ createProduct: async (input) => { inserted = input; } }));
  assert.equal(response.status, 201);
  assert.deepEqual(inserted, { productCode: 'AD0042', ...fields });
});

test('Duplicate Product Code returns a safe conflict response', async () => {
  const response = await handleCreateProductRequest(request('/api/product', { productCode: 'AD0042', ...fields }), dependencies({
    createProduct: async () => { throw { code: '23505', message: 'private database detail' }; },
  }));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private database detail/);
});

test('Edit preserves immutable identity and rejects client-supplied code, status, Stamp, or deletion state', async () => {
  let update;
  const response = await handleUpdateProductRequest(request('/api/product/ad0001', fields), 'ad0001', dependencies({
    updateProduct: async (...args) => { update = args; return true; },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(update, ['AD0001', fields, 'user']);

  let writes = 0;
  for (const extra of [{ productCode: 'AD0002' }, { status: 'inactive' }, { stamp: 'forged' }, { is_deleted: true }]) {
    const rejected = await handleUpdateProductRequest(request('/api/product/AD0001', { ...fields, ...extra }), 'AD0001', dependencies({
      updateProduct: async () => { writes += 1; return true; },
    }));
    assert.equal(rejected.status, 400);
  }
  assert.equal(writes, 0);
});

test('Malformed path keys fail, inactive User rows return not found, and cross-origin writes are denied', async () => {
  let updates = 0;
  const deps = dependencies({ updateProduct: async () => { updates += 1; return false; } });
  assert.equal((await handleUpdateProductRequest(request('/api/product/bad', fields), 'bad', deps)).status, 404);
  assert.equal((await handleUpdateProductRequest(request('/api/product/AD0001', fields), 'AD0001', deps)).status, 404);
  assert.equal(updates, 1);

  const crossOrigin = await handleCreateProductRequest(request('/api/product', { productCode: 'AD0042', ...fields }, { origin: 'https://attacker.example' }), deps);
  assert.equal(crossOrigin.status, 403);
});

test('Database errors fail closed without leaking details', async () => {
  const createFailure = await handleCreateProductRequest(request('/api/product', { productCode: 'AD0042', ...fields }), dependencies({
    createProduct: async () => { throw new Error('private Supabase detail'); },
  }));
  assert.equal(createFailure.status, 503);
  assert.doesNotMatch(await createFailure.text(), /private Supabase detail/);

  const response = await handleUpdateProductRequest(request('/api/product/AD0001', fields), 'AD0001', dependencies({
    updateProduct: async () => { throw new Error('private Supabase detail'); },
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private Supabase detail/);
});

async function mockServer({ role = 'user', rights = ['add_product', 'edit_product'], queryResult = { data: {
  prodcode: 'AD0001', description: fields.description, unit: 'ea', is_deleted: false, stamp: 'EDIT admin',
}, error: null } } = {}) {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = { queries: [], access: { userId: actor().userId, role, modules: [{ code: 'product' }], rights, unavailable: false }, queryResult };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__productMutationServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = (...args) => {
    globalThis.__productMutationServer.adminArgs = args;
    return { from(table) {
      const call = { table, filters: [] };
      const query = {
        insert(values) { call.insert = values; return this; },
        update(values) { call.update = values; return this; },
        select(columns) { call.columns = columns; return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        async maybeSingle() { globalThis.__productMutationServer.queries.push(call); return globalThis.__productMutationServer.queryResult; },
        then(resolve, reject) { globalThis.__productMutationServer.queries.push(call); return Promise.resolve(globalThis.__productMutationServer.queryResult).then(resolve, reject); },
      };
      return query;
    }};
  };`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/product-mutations-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__productMutationServer = state;
  const { productMutationDependencies } = await import(uri(compile(source)));
  return { state, deps: productMutationDependencies() };
}

test('Service writes only product fields; Users can edit active records only', async () => {
  const { state, deps } = await mockServer({ queryResult: { data: { prodcode: 'AD0001' }, error: null } });
  await deps.createProduct({ productCode: 'AD0042', ...fields });
  assert.equal(state.queries[0].table, 'product');
  assert.deepEqual(state.queries[0].insert, { prodcode: 'AD0042', description: 'Widget', unit: 'ea' });

  assert.equal(await deps.updateProduct('AD0001', fields, 'user'), true);
  assert.deepEqual(state.queries[1].update, fields);
  assert.deepEqual(state.queries[1].filters, [['prodcode', 'AD0001'], ['is_deleted', false]]);
  assert.deepEqual(Object.keys(state.queries[1].update).sort(), ['description', 'unit']);
});

test('Edit reads active view for Users and includes read-only Status/Stamp only for managers', async () => {
  const { state, deps } = await mockServer();
  await deps.getProductForEdit('AD0001', 'user');
  assert.equal(state.queries[0].table, 'product_active');
  assert.equal(state.queries[0].columns, 'prodcode,description,unit');

  await deps.getProductForEdit('AD0001', 'admin');
  assert.equal(state.queries[1].table, 'product');
  assert.equal(state.queries[1].columns, 'prodcode,description,unit,is_deleted,stamp');
});

test('Product list exposes Add/Edit affordances only behind the current assigned rights', async () => {
  const page = await readFile(new URL('../app/erp/modules/product/page.tsx', import.meta.url), 'utf8');
  const addPage = await readFile(new URL('../app/erp/modules/product/new/page.tsx', import.meta.url), 'utf8');
  const editPage = await readFile(new URL('../app/erp/modules/product/[prodCode]/edit/page.tsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../app/erp/modules/product/product-form.tsx', import.meta.url), 'utf8');
  assert.match(page, /rights\.includes\('add_product'\)/);
  assert.match(page, /rights\.includes\('edit_product'\)/);
  assert.match(page, /product\/new/);
  assert.match(page, /encodeURIComponent\(product\.productCode\).*\/edit/s);
  assert.match(addPage, /access\.rights\.includes\('add_product'\)/);
  assert.match(editPage, /access\.rights\.includes\('edit_product'\)/);
  assert.match(editPage, /getProductForEdit\(prodCode\.toUpperCase\(\), access\.role\)/);
  assert.match(form, /readOnly=\{isEdit\}/);
  assert.match(form, /isEdit && isManager && product/);
});
