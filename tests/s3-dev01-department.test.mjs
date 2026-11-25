import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const originModule = uri(compile(await readFile(new URL('../lib/auth/request-origin.ts', import.meta.url), 'utf8')));
const listSource = compile(await readFile(new URL('../lib/department-list.ts', import.meta.url), 'utf8'));
const mutationSource = compile((await readFile(new URL('../lib/department-mutations.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/request-origin'", `from '${originModule}'`));
const { loadDepartmentList, handleDepartmentListRequest } = await import(uri(listSource));
const {
  handleCreateDepartmentRequest,
  handleUpdateDepartmentRequest,
  handleDepartmentStatusRequest,
} = await import(uri(mutationSource));

const actor = (role = 'user', rights = []) => ({
  userId: '11111111-1111-4111-8111-111111111111',
  role,
  modules: [{ code: 'human_resources' }],
  rights,
  unavailable: false,
});
const request = (url, body, headers = {}) => new Request(`https://hope.example.test${url}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { origin: 'https://hope.example.test', 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const mutationDependencies = (overrides = {}) => ({
  appOrigin: 'https://hope.example.test',
  getActor: async () => actor('admin', ['add_department', 'edit_department', 'delete_department']),
  createDepartment: async () => {},
  updateDepartment: async () => true,
  updateDepartmentStatus: async () => true,
  ...overrides,
});

test('Department list forces active rows for Users and rejects unauthorized module access', async () => {
  let query;
  const result = await loadDepartmentList({ search: ' hr ', status: 'inactive' }, {
    getAccess: async () => actor('user', ['view_job_history']),
    listDepartments: async (value) => { query = value; return [{ departmentCode: 'HRD', name: 'Human Resource' }]; },
  });
  assert.equal(result.kind, 'ok');
  assert.deepEqual(query, { role: 'user', search: 'hr', status: 'active' });

  let reads = 0;
  const forbidden = await loadDepartmentList({}, {
    getAccess: async () => ({ ...actor('user', ['add_customer']), modules: [{ code: 'customer' }] }),
    listDepartments: async () => { reads += 1; return []; },
  });
  assert.equal(forbidden.kind, 'forbidden');
  assert.equal(reads, 0);
});

test('Department list rejects duplicate and malformed filters before querying', async () => {
  let reads = 0;
  const deps = { getAccess: async () => actor('admin'), listDepartments: async () => { reads += 1; return []; } };
  const duplicate = await handleDepartmentListRequest(
    new Request('https://hope.example.test/api/department?q=HR&q=IT'), deps,
  );
  assert.equal(duplicate.status, 400);

  const malformed = await loadDepartmentList({ search: 'x'.repeat(101) }, deps);
  assert.equal(malformed.kind, 'invalid');
  assert.equal(reads, 0);
});

test('Department list API returns private authentication, authorization, and unavailable responses', async () => {
  const url = 'https://hope.example.test/api/department';
  const unauthenticated = await handleDepartmentListRequest(new Request(url), {
    getAccess: async () => null,
    listDepartments: async () => [],
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get('cache-control'), 'private, no-store');

  const forbidden = await handleDepartmentListRequest(new Request(url), {
    getAccess: async () => ({ ...actor('user'), modules: [{ code: 'customer' }] }),
    listDepartments: async () => [],
  });
  assert.equal(forbidden.status, 403);

  const unavailable = await handleDepartmentListRequest(new Request(url), {
    getAccess: async () => { throw new Error('private service detail'); },
    listDepartments: async () => [],
  });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private service detail/);
});

test('Department list search filter quotes user input and searches only code/name', async () => {
  const { departmentSearchFilter } = await import(uri(listSource));
  const filter = departmentSearchFilter('A%"_');
  assert.match(filter, /^deptcode\.ilike\./);
  assert.match(filter, /deptname\.ilike\./);
  assert.ok(!filter.includes(',address.'));
});

test('Department creation requires HR module and add_department before writing', async () => {
  let writes = 0;
  const response = await handleCreateDepartmentRequest(
    request('/api/department', { departmentCode: 'HRD', name: 'Human Resources' }),
    mutationDependencies({ getActor: async () => actor('user', ['edit_department']), createDepartment: async () => { writes += 1; } }),
  );
  assert.equal(response.status, 403);
  assert.equal(writes, 0);
});

test('Department creation normalizes code and name and rejects invalid or extra fields', async () => {
  let inserted;
  const created = await handleCreateDepartmentRequest(
    request('/api/department', { departmentCode: ' it ', name: ' Information Tech ' }),
    mutationDependencies({ createDepartment: async (value) => { inserted = value; } }),
  );
  assert.equal(created.status, 201);
  assert.deepEqual(inserted, { departmentCode: 'IT', name: 'Information Tech' });

  let writes = 0;
  for (const body of [
    { departmentCode: '', name: 'People' },
    { departmentCode: 'LONG', name: 'People' },
    { departmentCode: 'HRD', name: '   ' },
    { departmentCode: 'HRD', name: 'x'.repeat(21) },
    { departmentCode: 'HRD', name: 'People', is_deleted: false },
  ]) {
    const response = await handleCreateDepartmentRequest(request('/api/department', body),
      mutationDependencies({ createDepartment: async () => { writes += 1; } }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});

test('Duplicate Department Code returns a safe conflict response', async () => {
  const response = await handleCreateDepartmentRequest(request('/api/department', {
    departmentCode: 'HRD', name: 'Human Resource',
  }), mutationDependencies({ createDepartment: async () => { throw { code: '23505', message: 'private database detail' }; } }));
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /private database detail/);
});

test('Department edit preserves the code in the route and rejects client-supplied system fields', async () => {
  let update;
  const response = await handleUpdateDepartmentRequest(request('/api/department/it', { name: 'Technology' }), 'it',
    mutationDependencies({ updateDepartment: async (...args) => { update = args; return true; } }));
  assert.equal(response.status, 200);
  assert.deepEqual(update, ['IT', { name: 'Technology' }, 'admin']);

  let writes = 0;
  const forged = await handleUpdateDepartmentRequest(request('/api/department/IT', {
    name: 'Technology', departmentCode: 'FIN', is_deleted: true, stamp: 'forged',
  }), 'IT', mutationDependencies({ updateDepartment: async () => { writes += 1; return true; } }));
  assert.equal(forged.status, 400);
  assert.equal(writes, 0);
});

test('Soft delete needs delete_department; restore is manager-only; active children return conflict', async () => {
  let writes = 0;
  const deleteDenied = await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: true }), 'HRD',
    mutationDependencies({ getActor: async () => actor('user', ['edit_department']), updateDepartmentStatus: async () => { writes += 1; return true; } }));
  assert.equal(deleteDenied.status, 403);

  const restoreDenied = await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: false }), 'HRD',
    mutationDependencies({ getActor: async () => actor('user', ['delete_department']), updateDepartmentStatus: async () => { writes += 1; return true; } }));
  assert.equal(restoreDenied.status, 403);
  assert.equal(writes, 0);

  const blocked = await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: true }), 'HRD',
    mutationDependencies({ updateDepartmentStatus: async () => { throw {
      code: 'P0001', message: 'Cannot delete department row: 2 active related record(s) still exist.',
    }; } }));
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), {
    code: 'ACTIVE_DEPENDENTS', message: 'This department has active Job History records and cannot be deactivated.',
  });
});

test('Department status requests reject cross-origin, non-JSON, malformed, and stale transitions', async () => {
  let reads = 0;
  let writes = 0;
  const deps = mutationDependencies({
    getActor: async () => { reads += 1; return actor('admin', ['delete_department']); },
    updateDepartmentStatus: async () => { writes += 1; return false; },
  });
  assert.equal((await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: true }, { origin: 'https://attacker.example' }), 'HRD', deps)).status, 403);
  assert.equal((await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: true }, { 'content-type': 'text/plain' }), 'HRD', deps)).status, 403);
  assert.equal(reads, 0);
  assert.equal((await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: 'true' }), 'HRD', deps)).status, 400);
  assert.equal((await handleDepartmentStatusRequest(request('/api/department/HRD/status', { isDeleted: true }), 'HRD', deps)).status, 404);
  assert.equal(writes, 1);
});

async function mockServer({ role = 'user', result = { data: [], error: null } } = {}) {
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret';
  const state = { queries: [], access: { ...actor(role, ['add_department']), userId: actor().userId, unavailable: false }, result };
  const accessModule = uri('export const loadCurrentErpModules = async () => globalThis.__departmentServer.access;');
  const adminModule = uri(`export const createSupabaseAdminClient = () => ({
    from(table) {
      const call = { table, filters: [] };
      const query = {
        select(columns) { call.columns = columns; return this; },
        insert(values) { call.insert = values; return this; },
        update(values) { call.update = values; return this; },
        eq(column, value) { call.filters.push([column, value]); return this; },
        or(filter) { call.filter = filter; return this; },
        order(column, options) { call.order = [column, options]; globalThis.__departmentServer.queries.push(call); return Promise.resolve(globalThis.__departmentServer.result); },
        async maybeSingle() { globalThis.__departmentServer.queries.push(call); return globalThis.__departmentServer.result; },
        then(resolve, reject) { globalThis.__departmentServer.queries.push(call); return Promise.resolve(globalThis.__departmentServer.result).then(resolve, reject); },
      };
      return query;
    },
  });`);
  const configModule = uri("export const getSupabaseConfig = () => ({ url: 'https://hope.example.test', key: 'publishable-test-key' });");
  const source = (await readFile(new URL('../lib/department-list-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", `from '${accessModule}'`)
    .replace("from '@/lib/department-list'", `from '${uri(listSource)}'`)
    .replace("from '@/lib/supabase/server'", `from '${adminModule}'`)
    .replace("from '@/lib/supabase/config'", `from '${configModule}'`);
  globalThis.__departmentServer = state;
  const { departmentListDependencies } = await import(uri(compile(source)));
  return { state, deps: departmentListDependencies() };
}

test('Department data adapter limits Users to active fields and managers to authorized filters', async () => {
  const user = await mockServer({ role: 'user', result: { data: [{ deptcode: 'IT', deptname: 'Technology' }], error: null } });
  await user.deps.listDepartments({ role: 'user', status: 'active', search: 'tech' });
  assert.equal(user.state.queries[0].table, 'department_active');
  assert.equal(user.state.queries[0].columns, 'deptcode,deptname');

  const admin = await mockServer({ role: 'admin' });
  await admin.deps.listDepartments({ role: 'admin', status: 'inactive', search: '' });
  assert.equal(admin.state.queries[0].table, 'department');
  assert.match(admin.state.queries[0].columns, /is_deleted,stamp/);
  assert.deepEqual(admin.state.queries[0].filters, [['is_deleted', true]]);
});

test('Department data adapter writes only allowed fields and uses compare-and-set for status', async () => {
  const mutationSource = (await readFile(new URL('../lib/department-mutations-server.ts', import.meta.url), 'utf8'))
    .replace("from '@/lib/auth/erp-modules-server'", "from 'data:text/javascript,export%20const%20loadCurrentErpModules%20=%20async%20()%20=%3E%20globalThis.__departmentServer.access'")
    .replace("from '@/lib/supabase/server'", "from 'data:text/javascript,export%20const%20createSupabaseAdminClient%20=%20()%20=%3E%20({%20from:%20()%20=%3E%20globalThis.__departmentServer.query%20})'")
    .replace("from '@/lib/supabase/config'", "from 'data:text/javascript,export%20const%20getSupabaseConfig%20=%20()%20=%3E%20({url:%20%22https://hope.example.test%22,%20key:%20%22publishable%22})'");
  const calls = [];
  const query = {
    insert(values) { calls.push({ insert: values }); return { then: (resolve) => resolve({ error: null }) }; },
    update(values) { calls.push({ update: values, filters: [] }); return this; },
    eq(column, value) { calls.at(-1).filters.push([column, value]); return this; },
    select(columns) { calls.at(-1).columns = columns; return this; },
    async maybeSingle() { return { data: { deptcode: 'HRD' }, error: null }; },
  };
  globalThis.__departmentServer = {
    access: { ...actor('user', ['add_department', 'edit_department', 'delete_department']), unavailable: false },
    query,
  };
  const { departmentMutationDependencies } = await import(uri(compile(mutationSource)));
  const deps = departmentMutationDependencies();
  await deps.createDepartment({ departmentCode: 'HRD', name: 'Human Resources' });
  assert.deepEqual(calls[0].insert, { deptcode: 'HRD', deptname: 'Human Resources' });

  await deps.updateDepartment('HRD', { name: 'People' }, 'user');
  assert.deepEqual(calls[1].update, { deptname: 'People' });
  assert.deepEqual(calls[1].filters, [['deptcode', 'HRD'], ['is_deleted', false]]);

  await deps.updateDepartmentStatus('HRD', true);
  assert.deepEqual(calls[2].update, { is_deleted: true });
  assert.deepEqual(calls[2].filters, [['deptcode', 'HRD'], ['is_deleted', false]]);
});

test('Department page keeps actions behind current rights and role variants', async () => {
  const page = await readFile(new URL('../app/erp/modules/human-resources/page.tsx', import.meta.url), 'utf8');
  const server = await readFile(new URL('../lib/department-list-server.ts', import.meta.url), 'utf8');
  assert.match(page, /rights\.includes\('add_department'\)/);
  assert.match(page, /rights\.includes\('edit_department'\)/);
  assert.match(page, /rights\.includes\('delete_department'\)/);
  assert.match(page, /const canRestore = isManager/);
  assert.match(server, /'department_active'/);
  assert.match(server, /'deptcode,deptname'/);
  assert.match(page, /Status/);
  assert.match(page, /Stamp/);
});
