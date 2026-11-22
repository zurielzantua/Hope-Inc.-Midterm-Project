import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source, jsx = false) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined },
}).outputText;
const originModule = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const priceHistorySource = (await readFile(new URL('../lib/price-history.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`);
const priceHistory = await import(uri(compile(priceHistorySource)));
const { handleCreatePriceRequest, handleDeletePriceRequest, handleUpdatePriceRequest, isValidPriceDate, loadPriceHistoryPage, normalizeUnitPrice } = priceHistory;
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

const actor = (role = 'user', rights = ['add_price', 'edit_price', 'delete_price'], modules = ['product']) => ({
  userId: '11111111-1111-4111-8111-111111111111', role,
  modules: modules.map((code) => ({ code })), rights, unavailable: false,
});
const product = { productCode: 'AD0001', description: 'Demo Widget', unit: 'ea' };
const request = (path, body, headers = {}) => new Request(`https://hope.example.test${path}`, {
  method: 'POST',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const mutationDeps = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor(),
  isProductActive: async () => true,
  createPrice: async () => {},
  updatePrice: async () => true,
  softDeletePrice: async () => true,
  ...overrides,
});

test('Price and date validators reject nonpositive, oversized, excessive-precision, and impossible values', () => {
  assert.equal(normalizeUnitPrice('10.5'), '10.50');
  assert.equal(normalizeUnitPrice('000.01'), '0.01');
  assert.equal(normalizeUnitPrice('99999999.99'), '99999999.99');
  for (const value of ['0', '0.00', '-1', '1.234', '100000000.00', '1e2', '']) assert.equal(normalizeUnitPrice(value), null, value);
  assert.equal(isValidPriceDate('2024-02-29'), true);
  for (const value of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-1-01', 'not-a-date']) assert.equal(isValidPriceDate(value), false, value);
});

test('Price History page access is module-checked and the active price card keeps no-price distinct from data failure', async () => {
  let calls = 0;
  const deps = {
    getActor: async () => actor('user', ['add_price'], ['product']),
    getProduct: async () => { calls += 1; return product; },
    listPriceHistory: async () => [
      { effectiveDate: '2024-01-01', unitPrice: '10.00' },
      { effectiveDate: '2035-01-01', unitPrice: '20.00' },
    ],
    getCurrentPrice: async () => '10.00',
  };
  const result = await loadPriceHistoryPage('ad0001', '2025-01-01', deps);
  assert.equal(result.kind, 'ok');
  assert.equal(result.data.currentPrice, '10.00');
  assert.equal(result.data.currentPriceEffectiveDate, '2024-01-01');
  assert.equal(calls, 1);

  const noCurrent = await loadPriceHistoryPage('AD0001', '2023-01-01', { ...deps, getCurrentPrice: async () => null });
  assert.equal(noCurrent.kind, 'ok');
  assert.equal(noCurrent.data.currentPrice, null);
  assert.equal(noCurrent.data.currentPriceEffectiveDate, null);

  const denied = await loadPriceHistoryPage('AD0001', '2025-01-01', { ...deps, getActor: async () => actor('user', [], ['customer']) });
  assert.equal(denied.kind, 'forbidden');
  assert.equal((await loadPriceHistoryPage('AD0001', '2025-01-01', { ...deps, getCurrentPrice: async () => { throw new Error('RPC missing'); } })).kind, 'unavailable');
});

test('Price add requires Product access and add_price; cross-origin writes fail before actor lookup', async () => {
  let writes = 0;
  for (const deniedActor of [null, actor('admin', [], ['product']), actor('admin', ['add_price'], ['customer'])]) {
    const response = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '10.00' }), 'AD0001', mutationDeps({
      getActor: async () => deniedActor,
      createPrice: async () => { writes += 1; },
    }));
    assert.ok([401, 403].includes(response.status));
  }
  let actorReads = 0;
  const crossOrigin = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '10.00' }, { origin: 'https://attacker.example' }), 'AD0001', mutationDeps({
    getActor: async () => { actorReads += 1; return actor(); },
  }));
  assert.equal(crossOrigin.status, 403);
  assert.equal(actorReads, 0);
  assert.equal(writes, 0);
});

test('Price add validates exact fields, valid dates and a positive price, then normalizes the amount', async () => {
  let writes = [];
  for (const body of [
    { effectiveDate: '2024-02-30', unitPrice: '10.00' },
    { effectiveDate: '2026-01-01', unitPrice: '0.00' },
    { effectiveDate: '2026-01-01', unitPrice: '1.234' },
    { effectiveDate: '2026-01-01', unitPrice: '10.00', productCode: 'AD0002' },
  ]) {
    const response = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', body), 'AD0001', mutationDeps({
      createPrice: async (...args) => { writes.push(args); },
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes.length, 0);

  const response = await handleCreatePriceRequest(request('/api/product/ad0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '10.5' }), 'ad0001', mutationDeps({
    createPrice: async (...args) => { writes.push(args); },
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(writes, [['AD0001', { effectiveDate: '2026-01-01', unitPrice: '10.50' }]]);
});

test('Add/edit are denied for inactive Products; duplicate composite identity returns a safe conflict', async () => {
  let writes = 0;
  const inactive = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '1.00' }), 'AD0001', mutationDeps({
    isProductActive: async () => false,
    createPrice: async () => { writes += 1; },
  }));
  assert.equal(inactive.status, 404);
  assert.equal(writes, 0);

  const conflict = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '1.00' }), 'AD0001', mutationDeps({
    createPrice: async () => { throw { code: '23505', message: 'private duplicate detail' }; },
  }));
  assert.equal(conflict.status, 409);
  assert.doesNotMatch(await conflict.text(), /private duplicate detail/);
});

test('Edit preserves Product/effective-date identity and rejects identity fields from the client', async () => {
  let update;
  const response = await handleUpdatePriceRequest(request('/api/product/AD0001/price-history/2026-01-01', { unitPrice: '25.25' }), 'ad0001', '2026-01-01', mutationDeps({
    updatePrice: async (...args) => { update = args; return true; },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(update, ['AD0001', '2026-01-01', '25.25', 'user']);

  for (const body of [
    { unitPrice: '10.00', effectiveDate: '2026-02-01' },
    { unitPrice: '10.00', productCode: 'AD0002' },
    { unitPrice: '10.00', is_deleted: true },
  ]) {
    const rejected = await handleUpdatePriceRequest(request('/api/product/AD0001/price-history/2026-01-01', body), 'AD0001', '2026-01-01', mutationDeps());
    assert.equal(rejected.status, 400);
  }
});

test('Soft-delete requires delete_price and accepts only the delete transition', async () => {
  let writes = 0;
  const denied = await handleDeletePriceRequest(request('/api/product/AD0001/price-history/2026-01-01/status', { isDeleted: true }), 'AD0001', '2026-01-01', mutationDeps({
    getActor: async () => actor('user', ['edit_price']),
    softDeletePrice: async () => { writes += 1; return true; },
  }));
  assert.equal(denied.status, 403);
  assert.equal(writes, 0);

  const restoreAttempt = await handleDeletePriceRequest(request('/api/product/AD0001/price-history/2026-01-01/status', { isDeleted: false }), 'AD0001', '2026-01-01', mutationDeps());
  assert.equal(restoreAttempt.status, 400);
  assert.equal(writes, 0);

  const saved = await handleDeletePriceRequest(request('/api/product/AD0001/price-history/2026-01-01/status', { isDeleted: true }), 'AD0001', '2026-01-01', mutationDeps({
    softDeletePrice: async () => { writes += 1; return true; },
  }));
  assert.equal(saved.status, 200);
  assert.equal(writes, 1);
});

test('Inactive-parent trigger errors are safe conflicts; unknown errors remain generic', async () => {
  const blocked = await handleCreatePriceRequest(request('/api/product/AD0001/price-history', { effectiveDate: '2026-01-01', unitPrice: '1.00' }), 'AD0001', mutationDeps({
    createPrice: async () => { throw { code: '23514', message: 'active_parent_required' }; },
  }));
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), { code: 'INACTIVE_PARENT', message: 'Price history requires an active Product.' });

  const unknown = await handleUpdatePriceRequest(request('/api/product/AD0001/price-history/2026-01-01', { unitPrice: '2.00' }), 'AD0001', '2026-01-01', mutationDeps({
    updatePrice: async () => { throw new Error('private Supabase detail'); },
  }));
  assert.equal(unknown.status, 503);
  assert.doesNotMatch(await unknown.text(), /private Supabase detail/);
});

async function mockServer({ role = 'user', rpcResult = '10.00', rpcError = null } = {}) {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = {
    calls: [],
    rpcCall: null,
    access: { userId: actor().userId, role, modules: [{ code: 'product' }], rights: ['add_price', 'edit_price', 'delete_price'], unavailable: false },
    rpcResult,
    rpcError,
    rows: {
      product_active: [{ prodcode: 'AD0001', description: 'Demo Widget', unit: 'ea' }],
      product: [{ prodcode: 'AD0001', description: 'Demo Widget', unit: 'ea', is_deleted: false, stamp: 'EDIT admin' }],
      pricehist_active: [{ prodcode: 'AD0001', effdate: '2026-01-01', unitprice: '10.00' }],
      pricehist: [
        { prodcode: 'AD0001', effdate: '2025-01-01', unitprice: '8.00', is_deleted: true, stamp: 'DELETE admin' },
        { prodcode: 'AD0001', effdate: '2026-01-01', unitprice: '10.00', is_deleted: false, stamp: 'EDIT admin' },
      ],
    },
  };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__priceHistoryServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = () => ({
    from(table) {
      const call = { table, filters: [] };
      const query = {
        select(columns) { call.columns = columns; return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        order(column, options) { call.order = [column, options]; return this; },
        insert(values) { call.insert = values; return this; },
        update(values) { call.update = values; return this; },
        maybeSingle() {
          const current = globalThis.__priceHistoryServer;
          current.calls.push(call);
          const data = (current.rows[table] ?? []).find((row) => call.filters.every(([key, value]) => row[key] === value)) ?? null;
          return Promise.resolve({ data, error: null });
        },
        then(resolve, reject) {
          globalThis.__priceHistoryServer.calls.push(call);
          const rows = globalThis.__priceHistoryServer.rows[table] ?? [];
          const data = rows.filter((row) => call.filters.every(([key, value]) => row[key] === value));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      const current = globalThis.__priceHistoryServer;
      current.rpcCall = { name, args };
      return { data: current.rpcResult, error: current.rpcError };
    },
  });`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/price-history-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replaceAll("from '@/lib/price-history'", `from '${uri(compile(priceHistorySource))}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__priceHistoryServer = state;
  const { priceHistoryDependencies } = await import(uri(compile(source)));
  return { state, deps: priceHistoryDependencies() };
}

test('Server data paths use active views for Users and the as-of RPC for the price card', async () => {
  const { state, deps } = await mockServer();
  const userProduct = await deps.getProduct('AD0001', 'user');
  assert.deepEqual(userProduct, product);
  const userRows = await deps.listPriceHistory('AD0001', 'user');
  assert.deepEqual(userRows, [{ effectiveDate: '2026-01-01', unitPrice: '10.00' }]);
  assert.equal(state.calls[0].table, 'product_active');
  assert.equal(state.calls[1].table, 'pricehist_active');
  assert.equal(state.calls[1].columns, 'effdate,unitprice');
  assert.equal(await deps.getCurrentPrice('AD0001', '2026-11-22'), '10.00');
  assert.deepEqual(state.rpcCall, { name: 'product_price_as_of', args: { p_prod_code: 'AD0001', p_as_of: '2026-11-22' } });

  await deps.getProduct('AD0001', 'admin');
  const managerRows = await deps.listPriceHistory('AD0001', 'admin');
  assert.equal(state.calls[2].table, 'product');
  assert.equal(state.calls[3].table, 'pricehist');
  assert.match(state.calls[3].columns, /is_deleted,stamp/);
  assert.deepEqual(managerRows.map(({ status }) => status), ['inactive', 'active']);
});

test('Service mutations preserve price identity and write only the requested fields', async () => {
  const { state, deps } = await mockServer();
  await deps.createPrice('AD0001', { effectiveDate: '2026-01-01', unitPrice: '11.00' });
  assert.deepEqual(state.calls[0].insert, { prodcode: 'AD0001', effdate: '2026-01-01', unitprice: '11.00' });

  assert.equal(await deps.updatePrice('AD0001', '2026-01-01', '12.00', 'user'), true);
  assert.deepEqual(state.calls[1].update, { unitprice: '12.00' });
  assert.deepEqual(state.calls[1].filters, [['prodcode', 'AD0001'], ['effdate', '2026-01-01'], ['is_deleted', false]]);

  assert.equal(await deps.softDeletePrice('AD0001', '2026-01-01'), true);
  assert.deepEqual(state.calls[2].update, { is_deleted: true });
  assert.deepEqual(state.calls[2].filters, [['prodcode', 'AD0001'], ['effdate', '2026-01-01'], ['is_deleted', false]]);
});

test('Product list links to Price History and mutation routes stay permission gated', async () => {
  const page = await readFile(new URL('../app/erp/modules/product/page.tsx', import.meta.url), 'utf8');
  const historyPage = await readFile(new URL('../app/erp/modules/product/[prodCode]/price-history/page.tsx', import.meta.url), 'utf8');
  const addPage = await readFile(new URL('../app/erp/modules/product/[prodCode]/price-history/new/page.tsx', import.meta.url), 'utf8');
  const editPage = await readFile(new URL('../app/erp/modules/product/[prodCode]/price-history/[effectiveDate]/edit/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /price-history`/);
  assert.match(historyPage, /loadPriceHistoryPage/);
  assert.match(historyPage, /currentPriceEffectiveDate/);
  assert.match(addPage, /access\.rights\.includes\('add_price'\)/);
  assert.match(editPage, /access\.rights\.includes\('edit_price'\)/);
});
