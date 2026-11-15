import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://hope.example';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const authModule = uri(`
  export const authorizeRequest = async () => globalThis.__userManagementState.access;
  export const createSessionClient = async () => ({
    auth: { getUser: async () => ({ data: { user: globalThis.__userManagementState.actorUser }, error: null }) },
    rpc: async (name, args) => globalThis.__userManagementState.sessionRpc(name, args),
  });
`);
const coreModule = uri(`export const readSetupCompletion = (user, id) => user?.id === id ? user.app_metadata?.hope_first_password_complete ?? null : null;`);
const helperSource = compile(await readFile(new URL('../lib/auth/user-management.ts', import.meta.url), 'utf8'));
const helperModule = uri(helperSource);
const serverModule = uri(`export const createSupabaseAdminClient = () => globalThis.__userManagementState.admin;`);
const configModule = uri(`export const getSupabaseConfig = () => ({ url: 'https://hope.example', key: 'sb_publishable_test' });`);
const registrationModule = uri(`export const handleRegistrationRequest = async (request, environment, factory) => {
  globalThis.__userManagementState.registration = { body: await request.json(), environment, factoryType: typeof factory };
  return Response.json({ status: 'pending' }, { status: 201 });
};`);
const source = (await readFile(new URL('../lib/auth/user-management-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/server'", `from '${authModule}'`)
  .replace("from '@/lib/auth/core'", `from '${coreModule}'`)
  .replace("from '@/lib/auth/user-management'", `from '${helperModule}'`)
  .replace("from '@/lib/supabase/server'", `from '${serverModule}'`)
  .replace("from '@/lib/supabase/config'", `from '${configModule}'`)
  .replace("from '@/lib/supabase/registration'", `from '${registrationModule}'`);
const { userManagementDependencies } = await import(uri(compile(source)));

const roleRows = [
  { role_id: 1, role_code: 'user', role_name: 'User', is_deleted: false },
  { role_id: 2, role_code: 'admin', role_name: 'Admin', is_deleted: false },
  { role_id: 3, role_code: 'superadmin', role_name: 'Superadmin', is_deleted: false },
];
const profiles = roleRows.map((role, i) => ({
  auth_user_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  first_name: `First${i + 1}`, last_name: `Last${i + 1}`, email: `user${i + 1}@example.test`,
  role_id: role.role_id, account_state: 'approved', is_blocked: false, is_deleted: false,
}));

function setup() {
  const state = { calls: [], access: { allowed: true, role: 'admin' }, actorUser: { id: 'actor-admin' }, targets: new Map(profiles.map((row) => [row.auth_user_id, { ...row, role: roleRows[row.role_id - 1] }])) };
  const builder = (table) => {
    const filters = {};
    let roleCodes = null;
    let roleIds = null;
    let patch = null;
    const q = {
      select() { return this; },
      in(field, values) { if (field === 'role_code') roleCodes = values; if (field === 'role_id') roleIds = values; return this; },
      eq(field, value) { filters[field] = value; return this; },
      order() { return this; },
      update(values) { patch = values; return this; },
      async maybeSingle() {
        if (table === 'role') {
          const matching = roleRows.filter((row) => (!roleCodes || roleCodes.includes(row.role_code)) && (!('is_deleted' in filters) || row.is_deleted === filters.is_deleted));
          return { data: filters.role_code ? matching[0] ?? null : matching, error: null };
        }
        const target = state.targets.get(filters.auth_user_id);
        if (!target) return { data: null, error: null };
        if (patch) {
          if (target.role_id !== filters.role_id || (filters.is_deleted === false && target.is_deleted)) return { data: null, error: null };
          const updated = { ...target, ...patch };
          if (patch.role_id) updated.role = roleRows.find((row) => row.role_id === patch.role_id);
          state.targets.set(target.auth_user_id, updated);
          return { data: updated, error: null };
        }
        return { data: target, error: null };
      },
      then(resolve, reject) {
        if (table === 'role') return Promise.resolve({ data: roleRows.filter((row) => (!roleCodes || roleCodes.includes(row.role_code)) && (!('is_deleted' in filters) || row.is_deleted === filters.is_deleted)), error: null }).then(resolve, reject);
        const data = profiles.filter((row) => !roleIds || roleIds.includes(row.role_id));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return q;
  };
  state.sessionRpc = async (name, args) => {
    state.calls.push(['rpc', name, args]);
    if (state.rpcError) return { data: null, error: state.rpcError };
    const target = state.targets.get(args.p_auth_user_id);
    if (!target || target.is_deleted) return { data: false, error: null };
    if (name === 'set_superadmin_blocked') {
      if (target.role_id !== 3) return { data: false, error: null };
      state.targets.set(target.auth_user_id, { ...target, is_blocked: args.p_is_blocked });
      return { data: true, error: null };
    }
    if (name === 'approve_pending_user') {
      if (target.role_id !== 1 || target.account_state !== 'pending' || target.is_blocked) return { data: false, error: null };
      state.targets.set(target.auth_user_id, { ...target, account_state: 'approved' });
      return { data: true, error: null };
    }
    if (name === 'promote_user_to_admin') {
      if (target.role_id !== 1 || target.account_state !== 'approved' || target.is_blocked) return { data: false, error: null };
      state.targets.set(target.auth_user_id, { ...target, role_id: 2, role: roleRows[1] });
      return { data: true, error: null };
    }
    return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
  };
  state.admin = {
    from: (table) => { state.calls.push(['from', table]); return builder(table); },
    auth: { admin: { getUserById: async (id) => ({ data: { user: { id, app_metadata: { hope_first_password_complete: false } } }, error: null }) } },
  };
  globalThis.__userManagementState = state;
  return state;
}

test('admin listing queries only User role rows; Superadmin can see all three role rows', async () => {
  const state = setup();
  const deps = userManagementDependencies();
  const adminRows = await deps.listUsers('admin');
  assert.deepEqual(adminRows.map((row) => row.roleCode), ['user']);
  const superRows = await deps.listUsers('superadmin');
  assert.deepEqual(superRows.map((row) => row.roleCode), ['user', 'admin', 'superadmin']);
  assert.equal(state.calls.filter(([name]) => name === 'from').length, 4);
});

test('server update enforces the hierarchy and matches the target role in the update', async () => {
  const state = setup();
  const deps = userManagementDependencies();
  const userId = profiles[0].auth_user_id;
  assert.ok(await deps.updateUser({ userId: 'actor-admin', role: 'admin' }, userId, { isBlocked: true }));
  assert.equal(state.targets.get(userId).is_blocked, true);
  assert.equal(await deps.updateUser({ userId: 'actor-admin', role: 'admin' }, profiles[1].auth_user_id, { isBlocked: true }), null);
  assert.ok(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { isBlocked: true }));
  assert.deepEqual(state.calls.find(([name]) => name === 'rpc').slice(1), ['set_superadmin_blocked', { p_auth_user_id: profiles[2].auth_user_id, p_is_blocked: true }]);
  assert.deepEqual(Object.keys(state.calls.find(([name]) => name === 'rpc')[2]), ['p_auth_user_id', 'p_is_blocked']);
  assert.equal(await deps.updateUser({ userId: profiles[2].auth_user_id, role: 'superadmin' }, profiles[2].auth_user_id, { isBlocked: true }), null);
  assert.ok(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, userId, { isBlocked: false }));
  const promoted = await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[0].auth_user_id, { roleCode: 'admin' });
  assert.equal(promoted?.roleCode, 'admin');
  const pending = { ...state.targets.get(profiles[0].auth_user_id), role_id: 1, role: roleRows[0], account_state: 'pending', is_blocked: false };
  state.targets.set(profiles[0].auth_user_id, pending);
  assert.equal(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[0].auth_user_id, { roleCode: 'admin' }), null);
  const approved = await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[0].auth_user_id, { accountState: 'approved' });
  assert.equal(approved?.accountState, 'approved');
  assert.equal(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[0].auth_user_id, { accountState: 'approved' }), null);
  assert.equal(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { roleCode: 'admin' }), null);
  assert.equal(await deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { accountState: 'approved' }), null);
  state.targets.set(profiles[2].auth_user_id, { ...state.targets.get(profiles[2].auth_user_id), is_blocked: false });
  state.rpcError = { code: '23514', message: 'last_active_superadmin' };
  await assert.rejects(() => deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { isBlocked: true }), (error) => error.code === '23514' && error.message === 'last_active_superadmin');
});

test('missing account-management RPCs fail closed with an explicit unavailable error', async () => {
  const state = setup();
  const deps = userManagementDependencies();
  state.rpcError = { code: 'PGRST202', message: 'Could not find the function public.set_superadmin_blocked' };
  await assert.rejects(
    () => deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { isBlocked: true }),
    (error) => error.code === 'RPC_UNAVAILABLE',
  );
  const pending = { ...state.targets.get(profiles[0].auth_user_id), role_id: 1, role: roleRows[0], account_state: 'pending', is_blocked: false };
  state.targets.set(profiles[0].auth_user_id, pending);
  await assert.rejects(
    () => deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[0].auth_user_id, { accountState: 'approved' }),
    (error) => error.code === 'RPC_UNAVAILABLE',
  );
  state.rpcError = { code: '42501', message: 'permission denied for function set_superadmin_blocked' };
  await assert.rejects(
    () => deps.updateUser({ userId: 'root-1', role: 'superadmin' }, profiles[2].auth_user_id, { isBlocked: true }),
    (error) => error.code === 'RPC_UNAVAILABLE',
  );
});

test('managed-user provisioning delegates to the existing Pending User registration handler', async () => {
  setup();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://hope.example';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  const response = await userManagementDependencies().createUser({ firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' });
  assert.equal(response.status, 201);
  assert.deepEqual(globalThis.__userManagementState.registration.body, { firstName: 'Ana', lastName: 'Santos', email: 'ana@example.test' });
  assert.equal(globalThis.__userManagementState.registration.factoryType, 'function');
});
