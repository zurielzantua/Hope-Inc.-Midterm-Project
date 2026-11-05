import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const ssrStub = uri(`
  export function createServerClient(_url, _key, options) {
    globalThis.__hopeProxyProbe.clientOptions = options;
    return { auth: { async getClaims() {
      if (globalThis.__hopeProxyProbe.fail) throw new Error('refresh failed');
      options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'refreshed', options: { httpOnly: true } }]);
      return { data: { claims: { sub: 'user-1' } }, error: null };
    } } };
  }
`);
const nextStub = uri(`
  export const NextResponse = { next({ request }) {
    return { request, headers: new Headers(), cookies: { set(name, value, options) {
      globalThis.__hopeProxyProbe.responseCookies.push({ name, value, options });
    } } };
  } };
`);
const source = (await readFile(new URL('../proxy.ts', import.meta.url), 'utf8'))
  .replace("from '@supabase/ssr'", `from '${ssrStub}'`)
  .replace("from 'next/server'", `from '${nextStub}'`);
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { proxy } = await import(uri(output));

function request() {
  const values = new Map([['sb-test-auth-token', 'old']]);
  return { cookies: {
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set: (name, value) => values.set(name, value),
    values,
  } };
}

test('session refresh passes updated cookies to the request and response without shared caching', async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
    delete globalThis.__hopeProxyProbe;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
  globalThis.__hopeProxyProbe = { responseCookies: [] };
  const req = request();
  const response = await proxy(req);
  assert.equal(req.cookies.values.get('sb-test-auth-token'), 'refreshed');
  assert.deepEqual(globalThis.__hopeProxyProbe.responseCookies, [{ name: 'sb-test-auth-token', value: 'refreshed', options: { httpOnly: true } }]);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('a refresh failure still returns a non-cacheable response for route-level authorization', async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
    delete globalThis.__hopeProxyProbe;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
  globalThis.__hopeProxyProbe = { responseCookies: [], fail: true };
  const response = await proxy(request());
  assert.equal(globalThis.__hopeProxyProbe.responseCookies.length, 0);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});
