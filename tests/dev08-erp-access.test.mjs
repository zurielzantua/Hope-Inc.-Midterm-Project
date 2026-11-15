import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleSource = await readFile(new URL('../lib/auth/erp-modules.ts', import.meta.url), 'utf8');
const moduleApi = await import(uri(compile(moduleSource)));
const serverMock = uri(`
  export const authorizeRequest = async () => {
    globalThis.__erpModuleState.authorizeCalls += 1;
    return globalThis.__erpModuleState.access;
  };
  export const createSessionClient = async () => globalThis.__erpModuleState.client;
`);
const adminMock = uri(`
  export const createSupabaseAdminClient = (url, secret, key) => {
    globalThis.__erpModuleState.adminArgs = [url, secret, key];
    return globalThis.__erpModuleState.admin;
  };
`);
const configMock = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
const serverSource = (await readFile(new URL('../lib/auth/erp-modules-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/server'", `from '${serverMock}'`)
  .replace("from '@/lib/supabase/server'", `from '${adminMock}'`)
  .replace("from '@/lib/supabase/config'", `from '${configMock}'`)
  .replace("from '@/lib/auth/erp-modules'", `from '${uri(compile(moduleSource))}'`);
const { loadCurrentErpModules } = await import(uri(compile(serverSource)));
const originalSecret = process.env.SUPABASE_SECRET_KEY;
after(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecret;
});

test('ERP dashboard loads module assignments before rendering the workspace', async () => {
  const page = await readFile(new URL('../app/erp/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadCurrentErpModules/);
  assert.match(page, /moduleAccess\.modules\.map/);
});

test('module tiles show only modules with an assigned right', () => {
  const modules = moduleApi.getVisibleErpModules(['reports', 'customer', 'unknown', 'customer']);
  assert.deepEqual(modules.map(({ code }) => code), ['customer', 'reports']);
});

test('module access rejects unknown and unassigned modules', () => {
  assert.equal(moduleApi.canAccessErpModule('customer', ['customer']), true);
  assert.equal(moduleApi.canAccessErpModule('customer', ['reports']), false);
  assert.equal(moduleApi.canAccessErpModule('settings', ['settings']), false);
});

test('User Management and System Settings follow their role boundaries', () => {
  assert.equal(moduleApi.canAccessUserManagement('user'), false);
  assert.equal(moduleApi.canAccessUserManagement('admin'), true);
  assert.equal(moduleApi.canAccessUserManagement('superadmin'), true);
  assert.equal(moduleApi.canAccessSystemSettings('user'), false);
  assert.equal(moduleApi.canAccessSystemSettings('admin'), false);
  assert.equal(moduleApi.canAccessSystemSettings('superadmin'), true);
});

test('human resources has a stable direct-route mapping', () => {
  assert.equal(moduleApi.getErpModuleBySlug('human-resources').code, 'human_resources');
  assert.equal(moduleApi.getErpModuleBySlug('not-a-module'), undefined);
});

function setupModuleClient({ permissions, rights, modules, errorTable } = {}) {
  const state = {
    calls: [],
    authorizeCalls: 0,
    access: { allowed: true, role: 'user' },
    user: { id: '11111111-1111-4111-8111-111111111111' },
    rows: {
      user_permission: permissions ?? [
        { auth_user_id: '11111111-1111-4111-8111-111111111111', right_id: 1, is_deleted: false },
        { auth_user_id: '11111111-1111-4111-8111-111111111111', right_id: 2, is_deleted: false },
        { auth_user_id: '11111111-1111-4111-8111-111111111111', right_id: 3, is_deleted: false },
      ],
      right_catalog: rights ?? [
        { right_id: 1, module_id: 10, is_deleted: false },
        { right_id: 2, module_id: 11, is_deleted: false },
        { right_id: 3, module_id: 12, is_deleted: false },
      ],
      module: modules ?? [
        { module_id: 10, module_code: 'customer', is_deleted: false },
        { module_id: 11, module_code: 'reports', is_deleted: false },
        { module_id: 12, module_code: 'unlisted', is_deleted: false },
      ],
    },
    errorTable,
  };
  state.client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
  };
  state.admin = {
    from(table) {
      const filters = [];
      const query = {
        select() { return this; },
        eq(column, value) { filters.push(['eq', column, value]); return this; },
        in(column, value) { filters.push(['in', column, value]); return this; },
        then(resolve, reject) {
          state.calls.push({ table, filters });
          const error = state.errorTable === table ? { message: 'private database detail' } : null;
          const data = (state.rows[table] ?? []).filter((row) => filters.every(([kind, column, value]) =>
            kind === 'eq' ? row[column] === value : value.includes(row[column])));
          return Promise.resolve({ data: error ? null : data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  globalThis.__erpModuleState = state;
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  return state;
}

test('module assignments are read for the verified user and mapped through active catalogue rows', async () => {
  const state = setupModuleClient();
  const result = await loadCurrentErpModules();
  assert.deepEqual(result.modules.map(({ code }) => code), ['customer', 'reports']);
  assert.equal(result.unavailable, false);
  assert.equal(state.authorizeCalls, 1);
  assert.deepEqual(state.adminArgs, ['https://hope.example.test', 'test-only-secret', 'publishable-test-key']);
  assert.deepEqual(state.calls[0].filters, [
    ['eq', 'auth_user_id', state.user.id],
    ['eq', 'is_deleted', false],
  ]);
  assert.deepEqual(state.calls.map(({ table }) => table), ['user_permission', 'right_catalog', 'module']);
});

test('module assignments are reread so Rights Management changes take effect on the next request', async () => {
  const state = setupModuleClient();
  assert.deepEqual((await loadCurrentErpModules()).modules.map(({ code }) => code), ['customer', 'reports']);
  state.rows.user_permission = [{ auth_user_id: state.user.id, right_id: 1, is_deleted: false }];
  assert.deepEqual((await loadCurrentErpModules()).modules.map(({ code }) => code), ['customer']);
});

test('permission query failures return no module access and mark navigation unavailable', async () => {
  setupModuleClient({ errorTable: 'user_permission' });
  const result = await loadCurrentErpModules();
  assert.deepEqual(result.modules, []);
  assert.equal(result.unavailable, true);
});

test('an unauthorized request does not read permissions with the service client', async () => {
  const state = setupModuleClient();
  state.access = { allowed: false };
  assert.equal(await loadCurrentErpModules(), null);
  assert.equal(state.authorizeCalls, 1);
  assert.equal(state.calls.length, 0);
});
