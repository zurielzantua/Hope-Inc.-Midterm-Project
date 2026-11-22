import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source, jsx = false) => ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    jsx: jsx ? ts.JsxEmit.ReactJSX : undefined,
  },
}).outputText;

const listSource = await readFile(new URL('../lib/customer-list.ts', import.meta.url), 'utf8');
const listModule = uri(compile(listSource));
const { loadCustomerList, handleCustomerListRequest, customerSearchFilter } = await import(listModule);
const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__customerListState.access;');
const adminModule = uri('export const createSupabaseAdminClient = () => globalThis.__customerListState.client;');
const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'sb_publishable_test' });");
const serverSource = (await readFile(new URL('../lib/customer-list-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
  .replace("from '@/lib/customer-list'", `from '${listModule}'`)
  .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
  .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
const serverModule = await import(uri(compile(serverSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const customerModule = { code: 'customer' };
const activeRow = {
  custno: 'C0001', custname: 'Acme Clinic', address: '42 Main Street', payterm: '30D',
  is_deleted: false, stamp: 'EDIT actor 2026-11-21 10:00 AM',
};
const inactiveRow = {
  custno: 'C0002', custname: 'Northshore Medical', address: '80 Pine Street', payterm: 'COD',
  is_deleted: true, stamp: 'DELETE actor 2026-11-20 02:40 PM',
};

function setup({ role = 'admin', modules = [customerModule], unavailable = false, errorTable } = {}) {
  const state = {
    access: { role, modules, unavailable },
    calls: [],
    rows: { customer: [activeRow, inactiveRow], customer_active: [activeRow] },
    errorTable,
  };
  state.client = {
    from(table) {
      const queryState = { table, columns: '', filters: [], search: null, order: null };
      const query = {
        select(columns) { queryState.columns = columns; return this; },
        eq(column, value) { queryState.filters.push([column, value]); return this; },
        or(expression) { queryState.search = expression; return this; },
        order(column, options) { queryState.order = [column, options]; return this; },
        then(resolve, reject) {
          state.calls.push(queryState);
          if (state.errorTable === table) {
            return Promise.resolve({ data: null, error: { message: 'private database detail' } }).then(resolve, reject);
          }
          const data = (state.rows[table] ?? []).filter((row) => queryState.filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  globalThis.__customerListState = state;
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  return state;
}

function request(url) {
  return new Request(`https://hope.example.test${url}`);
}

test('Admin and Superadmin receive status and stamp for active, inactive, and all filters', async () => {
  for (const role of ['admin', 'superadmin']) {
    const state = setup({ role });
    const deps = serverModule.customerListDependencies();
    const defaultView = await loadCustomerList({}, deps);
    assert.equal(defaultView.kind, 'ok');
    assert.equal(defaultView.filters.status, 'all');
    assert.equal(defaultView.customers.length, 2);

    const active = await loadCustomerList({ status: 'active' }, deps);
    assert.equal(active.kind, 'ok');
    assert.deepEqual(active.customers.map((row) => row.status), ['active']);
    assert.equal(active.customers[0].stamp, activeRow.stamp);
    assert.deepEqual(state.calls[1].filters, [['is_deleted', false]]);
    assert.match(state.calls[1].columns, /is_deleted,stamp/);

    const inactive = await loadCustomerList({ status: 'inactive' }, deps);
    assert.deepEqual(inactive.customers.map((row) => row.customerNo), ['C0002']);
    assert.deepEqual(state.calls[2].filters, [['is_deleted', true]]);

    const all = await loadCustomerList({ status: 'all' }, deps);
    assert.equal(all.customers.length, 2);
    assert.deepEqual(state.calls[3].filters, []);
  }
});

test('User requests always use active view and never receive status or stamp', async () => {
  const state = setup({ role: 'user' });
  const result = await loadCustomerList({ status: 'inactive' }, serverModule.customerListDependencies());
  assert.equal(result.kind, 'ok');
  assert.equal(result.filters.status, 'active');
  assert.deepEqual(result.customers, [{
    customerNo: 'C0001', name: 'Acme Clinic', address: '42 Main Street', paymentTerms: '30D',
  }]);
  assert.equal(state.calls[0].table, 'customer_active');
  assert.equal(state.calls[0].columns, 'custno,custname,address,payterm');
  assert.deepEqual(state.calls[0].filters, []);

  const response = await handleCustomerListRequest(
    request('/api/customer?role=admin&status=inactive'),
    serverModule.customerListDependencies(),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'active');
  assert.equal(body.customers.some((customer) => customer.status === 'inactive'), false);
});

test('search filters ID, name, address, and payment terms with a safely quoted literal', async () => {
  const state = setup();
  const result = await loadCustomerList({ search: '42, Main' }, serverModule.customerListDependencies());
  assert.equal(result.kind, 'ok');
  assert.deepEqual([...state.calls[0].search.matchAll(/([a-z]+)\.ilike\./g)].map((match) => match[1]), [
    'custno', 'custname', 'address', 'payterm',
  ]);
  assert.ok(state.calls[0].search.includes('address.ilike."%42, Main%"'));

  const hostileSearch = 'x),status.eq.false';
  const expression = customerSearchFilter(hostileSearch);
  assert.equal(expression, [
    'custno.ilike."%x),status.eq.false%"',
    'custname.ilike."%x),status.eq.false%"',
    'address.ilike."%x),status.eq.false%"',
    'payterm.ilike."%x),status.eq.false%"',
  ].join(','));
  assert.ok(customerSearchFilter('100%_').includes('"%100\\\\%\\\\_%"'));
  assert.ok(customerSearchFilter('a"b').includes('"%a\\"b%"'));
  assert.ok(customerSearchFilter('a\\b').includes('"%a\\\\\\\\b%"'));
});

test('unauthorized and non-Customer-module API requests are denied before database access', async () => {
  const state = setup();
  state.access = null;
  let response = await handleCustomerListRequest(request('/api/customer'), serverModule.customerListDependencies());
  assert.equal(response.status, 401);
  assert.equal(state.calls.length, 0);

  state.access = { role: 'user', modules: [{ code: 'reports' }], unavailable: false };
  response = await handleCustomerListRequest(request('/api/customer'), serverModule.customerListDependencies());
  assert.equal(response.status, 403);
  assert.equal(state.calls.length, 0);
});

test('API validates repeated, oversized, and invalid filters without querying customer data', async () => {
  const state = setup();
  for (const url of [
    '/api/customer?q=one&q=two',
    `/api/customer?q=${'x'.repeat(101)}`,
    '/api/customer?status=deleted',
  ]) {
    const response = await handleCustomerListRequest(request(url), serverModule.customerListDependencies());
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(state.calls.length, 0);
});

test('database and configuration errors fail closed without leaking details', async () => {
  const state = setup({ errorTable: 'customer' });
  let response = await handleCustomerListRequest(request('/api/customer'), serverModule.customerListDependencies());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private database detail/);

  setup();
  delete process.env.SUPABASE_SECRET_KEY;
  response = await handleCustomerListRequest(request('/api/customer'), serverModule.customerListDependencies());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /Server authentication configuration missing/);
});

test('customer API responses are non-cacheable and omit restricted fields for Users', async () => {
  setup({ role: 'user' });
  const response = await handleCustomerListRequest(request('/api/customer?status=all'), serverModule.customerListDependencies());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.status, 'active');
  assert.equal('stamp' in body.customers[0], false);
  assert.equal('status' in body.customers[0], false);
});

test('Customer page is a force-dynamic protected route backed by the same authorized loader', async () => {
  const pageSource = (await readFile(new URL('../app/erp/modules/customer/page.tsx', import.meta.url), 'utf8'))
    .replace("from 'next/link'", `from '${uri('export default function Link() {}')}'`)
    .replace("from 'next/navigation'", `from '${uri("export const redirect = (path) => { throw new Error('redirect:' + path); }; export const notFound = () => { throw new Error('not-found'); };")}'`)
    .replace("from '@/lib/customer-list-server'", `from '${uri('export const customerListDependencies = () => ({});')}'`)
    .replace("from '@/lib/customer-list'", `from '${uri('export const loadCustomerList = async () => globalThis.__customerPageResult;')}'`)
    .replace("from '../../erp-shell'", `from '${uri('export const ErpShell = () => null;')}'`);
  const jsxRuntime = uri('export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = Symbol.for("react.fragment");');
  const pageModule = await import(uri(compile(pageSource, true).replace('from "react/jsx-runtime"', `from '${jsxRuntime}'`)));

  globalThis.__customerPageResult = { kind: 'unauthenticated' };
  await assert.rejects(() => pageModule.default({ searchParams: Promise.resolve({}) }), /redirect:\//);
  globalThis.__customerPageResult = { kind: 'forbidden' };
  await assert.rejects(() => pageModule.default({ searchParams: Promise.resolve({}) }), /not-found/);
  globalThis.__customerPageResult = {
    kind: 'ok', access: { role: 'user', modules: [] }, filters: { search: '', status: 'active' }, customers: [],
  };
  const page = await pageModule.default({ searchParams: Promise.resolve({}) });
  assert.equal(page.props.currentPath, '/erp/modules/customer');
});

test('Customer API route delegates list and create requests to their authorization handlers', async () => {
  const mutationModule = uri(`export const handleCreateCustomerRequest = async () => new Response('created', { status: 201 });`);
  const mutationServerModule = uri('export const customerMutationDependencies = () => ({});');
  const routeSource = (await readFile(new URL('../app/api/customer/route.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/customer-mutations'", `from '${mutationModule}'`)
    .replace("from '@/lib/customer-mutations-server'", `from '${mutationServerModule}'`)
    .replace("from '@/lib/customer-list'", `from '${listModule}'`)
    .replace("from '@/lib/customer-list-server'", `from '${uri('export const customerListDependencies = () => globalThis.__customerRouteState.deps;')}'`);
  const route = await import(uri(compile(routeSource)));
  const state = setup();
  state.access = null;
  globalThis.__customerRouteState = { deps: serverModule.customerListDependencies() };
  try {
    const response = await route.GET(request('/api/customer?role=admin'));
    assert.equal(response.status, 401);
    assert.equal(state.calls.length, 0);
    const created = await route.POST(request('/api/customer', { customerNo: 'C0091' }));
    assert.equal(created.status, 201);
  } finally {
    delete globalThis.__customerRouteState;
  }
});
