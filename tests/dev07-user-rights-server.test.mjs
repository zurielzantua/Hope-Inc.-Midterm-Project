import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const authModule = uri(`
  export const authorizeRequest = async () => globalThis.__rightsServerState.access;
  export const createSessionClient = async () => globalThis.__rightsServerState.client;
`);
const source = (await readFile(new URL('../lib/auth/user-rights-server.ts', import.meta.url), 'utf8'))
  .replace("from '@/lib/auth/server'", `from '${authModule}'`);
const { userRightsDependencies } = await import(uri(compile(source)));

function setup() {
  const state = {
    calls: [],
    access: { allowed: true, role: 'admin' },
    user: { id: '22222222-2222-4222-8222-222222222222' },
  };
  state.client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    rpc: async (name, args) => {
      state.calls.push([name, args]);
      if (state.rpcError) return { data: null, error: state.rpcError };
      if (name === 'get_user_permissions') return { data: [{
        module_id: 1, module_code: 'customer', module_name: 'Customer',
        right_id: 1, right_code: 'add_customer', right_name: 'Add Customer', is_assigned: true,
      }], error: null };
      return { data: true, error: null };
    },
  };
  globalThis.__rightsServerState = state;
  return state;
}

test('rights dependencies use the verified session and never accept an actor ID argument', async () => {
  const state = setup();
  const deps = userRightsDependencies();
  assert.deepEqual(await deps.getActor(), { userId: state.user.id, role: 'admin' });
  const rows = await deps.loadRights('11111111-1111-4111-8111-111111111111');
  assert.deepEqual(rows, [{
    moduleId: 1, moduleCode: 'customer', moduleName: 'Customer',
    rightId: 1, rightCode: 'add_customer', rightName: 'Add Customer', isAssigned: true,
  }]);
  assert.equal(await deps.saveRights('11111111-1111-4111-8111-111111111111', [1]), true);
  assert.deepEqual(state.calls, [
    ['get_user_permissions', { p_target_user_id: '11111111-1111-4111-8111-111111111111' }],
    ['set_user_permissions', { p_target_user_id: '11111111-1111-4111-8111-111111111111', p_right_ids: [1] }],
  ]);
});

test('rights dependencies do not load a user identity when server authorization fails', async () => {
  const state = setup();
  state.access = { allowed: false };
  let getUserCalls = 0;
  state.client.auth.getUser = async () => { getUserCalls += 1; return { data: { user: state.user }, error: null }; };
  assert.equal(await userRightsDependencies().getActor(), null);
  assert.equal(getUserCalls, 0);
});

test('rights RPC errors are propagated for fail-closed HTTP handling', async () => {
  const state = setup();
  state.rpcError = { code: 'PGRST202', message: 'private missing function detail' };
  await assert.rejects(() => userRightsDependencies().loadRights('11111111-1111-4111-8111-111111111111'),
    (error) => error.code === 'PGRST202');
});
