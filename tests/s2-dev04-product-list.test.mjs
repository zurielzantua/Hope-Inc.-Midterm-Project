import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const listSource = await readFile(new URL('../lib/product-list.ts', import.meta.url), 'utf8');
const listModule = uri(compile(listSource));
const { loadProductList, handleProductListRequest, productSearchFilter } = await import(listModule);
const serverMock = uri(`export const loadCurrentErpModules = async () => globalThis.__productListServer.access;`);
const adminMock = uri(`export const createSupabaseAdminClient = (...args) => {
  globalThis.__productListServer.adminArgs = args;
  return globalThis.__productListServer.admin;
};`);
const configMock = uri(`export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });`);
const serverSource = (await readFile(new URL('../lib/product-list-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/erp-modules-server'", `from '${serverMock}'`)
  .replace("from '@/lib/product-list'", `from '${listModule}'`)
  .replace("from '@/lib/supabase/server'", `from '${adminMock}'`)
  .replace("from '@/lib/supabase/config'", `from '${configMock}'`);
const { productListDependencies } = await import(uri(compile(serverSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const moduleAccess = (role = 'user', modules = ['product'], unavailable = false, rights = []) => ({
  role, modules: modules.map((code) => ({ code })), rights, unavailable,
});

function listDeps(access, products = []) {
  const calls = [];
  return {
    calls,
    getAccess: async () => access,
    listProducts: async (query) => { calls.push(query); return products; },
  };
}

function request(path) {
  return new Request(`https://hope.example.test${path}`);
}

test('User is restricted to active product results and module access is server-derived', async () => {
  const deps = listDeps(moduleAccess('user'), [{ productCode: 'P00001', description: 'Widget', unit: 'ea' }]);
  const result = await loadProductList({ search: 'widget' }, deps);
  assert.equal(result.kind, 'ok');
  assert.deepEqual(result.filters, { search: 'widget', status: 'active' });
  assert.deepEqual(deps.calls, [{ role: 'user', search: 'widget', status: 'active' }]);
});

test('Product action rights from the verified server access are carried to the page', async () => {
  const rights = ['view_product', 'add_product'];
  const result = await loadProductList({}, listDeps(moduleAccess('user', ['product'], false, rights)));
  assert.equal(result.kind, 'ok');
  assert.deepEqual(result.access.rights, rights);
});

test('Admins and Superadmins receive their selected Active, Inactive, or All filter', async () => {
  for (const role of ['admin', 'superadmin']) {
    for (const status of ['active', 'inactive', 'all']) {
      const deps = listDeps(moduleAccess(role));
      const result = await loadProductList({ status }, deps);
      assert.equal(result.kind, 'ok', `${role} ${status}`);
      assert.equal(deps.calls[0].role, role);
      assert.equal(deps.calls[0].status, status);
    }
  }
});

test('User cannot obtain inactive products by sending a status or forged role query', async () => {
  for (const status of ['inactive', 'all']) {
    const deps = listDeps(moduleAccess('user'));
    const response = await handleProductListRequest(request(`/api/product?role=admin&status=${status}`), deps);
    assert.equal(response.status, 403);
    assert.equal(deps.calls.length, 0);
  }
});

test('Unauthenticated and unassigned module requests are rejected before data access', async () => {
  const unauthenticated = listDeps(null);
  assert.equal((await handleProductListRequest(request('/api/product'), unauthenticated)).status, 401);
  assert.equal(unauthenticated.calls.length, 0);

  const unassigned = listDeps(moduleAccess('admin', ['customer']));
  assert.equal((await handleProductListRequest(request('/api/product?status=all'), unassigned)).status, 403);
  assert.equal(unassigned.calls.length, 0);
});

test('Invalid, repeated, overlong, and control-character filters return 400', async () => {
  const deps = listDeps(moduleAccess('admin'));
  for (const path of [
    '/api/product?q=one&q=two',
    '/api/product?status=active&status=all',
    `/api/product?q=${'x'.repeat(101)}`,
    '/api/product?q=%00',
    '/api/product?status=unknown',
  ]) {
    const response = await handleProductListRequest(request(path), deps);
    assert.equal(response.status, 400, path);
  }
  assert.equal(deps.calls.length, 0);
});

test('Database failures return a private generic error without leaking details', async () => {
  const deps = {
    getAccess: async () => moduleAccess('admin'),
    listProducts: async () => { throw new Error('private Supabase detail'); },
  };
  const response = await handleProductListRequest(request('/api/product'), deps);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { error: 'Product records are temporarily unavailable.' });
});

test('Search targets product code, description, and unit while quoting filter syntax', () => {
  const filter = productSearchFilter('P1,description.eq.x")');
  assert.equal((filter.match(/\.ilike\./g) ?? []).length, 3);
  assert.match(filter, /^prodcode\.ilike\."/);
  assert.match(filter, /description\.ilike\./);
  assert.match(filter, /unit\.ilike\./);
  assert.match(filter, /\\"/);
});

function setupServer({ rows = {}, error } = {}) {
  const state = { access: moduleAccess('user'), calls: [], rows, error };
  state.admin = {
    from(table) {
      const call = { table, filters: [] };
      const query = {
        select(columns) { call.columns = columns; return this; },
        eq(column, value) { call.filters.push(['eq', column, value]); return this; },
        or(filter) { call.or = filter; return this; },
        order(column, options) { call.order = [column, options]; return this; },
        then(resolve, reject) {
          state.calls.push(call);
          const errorResult = state.error ? { message: 'private database detail' } : null;
          return Promise.resolve({ data: errorResult ? null : state.rows[table] ?? [], error: errorResult }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  globalThis.__productListServer = state;
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  return state;
}

test('User data path reads product_active without returning Status or Stamp', async () => {
  const state = setupServer({ rows: { product_active: [{ prodcode: 'P00001', description: 'Widget', unit: 'ea' }] } });
  const result = await productListDependencies().listProducts({ role: 'user', status: 'active', search: '' });
  assert.deepEqual(state.calls[0], {
    table: 'product_active', columns: 'prodcode,description,unit', filters: [], order: ['prodcode', { ascending: true }],
  });
  assert.deepEqual(result, [{ productCode: 'P00001', description: 'Widget', unit: 'ea' }]);
});

test('Admin active reads use product_active; inactive and all use the authorized product table', async () => {
  const state = setupServer({ rows: {
    product_active: [{ prodcode: 'P00001', description: 'Widget', unit: 'ea', is_deleted: false, stamp: 'EDIT admin' }],
    product: [{ prodcode: 'P00002', description: 'Old widget', unit: 'pc', is_deleted: true, stamp: 'DELETE admin' }],
  } });
  const deps = productListDependencies();

  const active = await deps.listProducts({ role: 'admin', status: 'active', search: 'widget' });
  assert.equal(state.calls[0].table, 'product_active');
  assert.equal(state.calls[0].columns, 'prodcode,description,unit,is_deleted,stamp');
  assert.equal(active[0].status, 'active');
  assert.match(state.calls[0].or, /prodcode\.ilike\./);

  const inactive = await deps.listProducts({ role: 'admin', status: 'inactive', search: '' });
  assert.equal(state.calls[1].table, 'product');
  assert.deepEqual(state.calls[1].filters, [['eq', 'is_deleted', true]]);
  assert.equal(inactive[0].status, 'inactive');
  assert.equal(inactive[0].stamp, 'DELETE admin');

  await deps.listProducts({ role: 'superadmin', status: 'all', search: '' });
  assert.equal(state.calls[2].table, 'product');
  assert.deepEqual(state.calls[2].filters, []);
});

test('Missing server-only Supabase secret fails closed before product data access', async () => {
  setupServer();
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const result = await loadProductList({}, productListDependencies());
    assert.equal(result.kind, 'unavailable');
    assert.equal(globalThis.__productListServer.adminArgs, undefined);
  } finally {
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
});

test('Data access errors fail closed and the Product page performs the same server-side authorization', async () => {
  setupServer({ error: true });
  await assert.rejects(
    () => productListDependencies().listProducts({ role: 'user', status: 'active', search: '' }),
    (error) => error.message === 'private database detail',
  );

  const page = await readFile(new URL('../app/erp/modules/product/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadProductList\(/);
  assert.match(page, /result\.kind === 'unauthenticated'.*redirect\('\/'\)/s);
  assert.match(page, /result\.kind === 'forbidden'.*notFound\(\)/s);
  assert.match(page, /isManager && <th scope="col" className="px-4 py-3">Status/);
  assert.match(page, /isManager && <th scope="col" className="px-4 py-3">Stamp/);
  assert.match(page, /rights\.includes\('add_product'\)/);
  assert.match(page, /rights\.includes\('edit_product'\)/);
  assert.match(page, /product\/new/);
  assert.match(page, /\/edit/);
});
