import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const uri = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const navigation = uri(`
  export const redirect = (path) => { throw new Error('redirect:' + path); };
  export const notFound = () => { throw new Error('not-found'); };
`);
const permissionServer = uri('export const loadCurrentErpModules = async () => globalThis.__dev08RouteAccess;');
const shell = uri('export const ErpShell = () => null;');
const jsxRuntime = uri('export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;');

async function importPage(path, shellImport) {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8'))
    .replace("from 'next/navigation'", `from '${navigation}'`)
    .replace("from '@/lib/auth/erp-modules-server'", `from '${permissionServer}'`)
    .replace("from '@/lib/auth/erp-modules'", `from '${uri(compile(await readFile(new URL('../lib/auth/erp-modules.ts', import.meta.url), 'utf8')))}'`)
    .replace(`from '${shellImport}'`, `from '${shell}'`);
  return import(uri(compile(source).replace('from "react/jsx-runtime"', `from '${jsxRuntime}'`)));
}

const modulePage = await importPage('../app/erp/modules/[moduleCode]/page.tsx', '../../erp-shell');
const settingsPage = await importPage('../app/erp/settings/page.tsx', '../erp-shell');

test('direct module URL is available only with an assigned right in that module', async () => {
  globalThis.__dev08RouteAccess = {
    role: 'user', unavailable: false,
    modules: [{ code: 'customer', slug: 'customer', href: '/erp/modules/customer', name: 'Customer Management' }],
  };
  const page = await modulePage.default({ params: Promise.resolve({ moduleCode: 'customer' }) });
  assert.equal(page.props.currentPath, '/erp/modules/customer');

  globalThis.__dev08RouteAccess.modules = [];
  await assert.rejects(
    () => modulePage.default({ params: Promise.resolve({ moduleCode: 'customer' }) }),
    /not-found/,
  );
});

test('direct settings URL is denied to Admins and allowed to Superadmins', async () => {
  globalThis.__dev08RouteAccess = { role: 'admin', modules: [], unavailable: false };
  await assert.rejects(() => settingsPage.default(), /not-found/);

  globalThis.__dev08RouteAccess = { role: 'superadmin', modules: [], unavailable: false };
  const page = await settingsPage.default();
  assert.equal(page.props.currentPath, '/erp/settings');
});

test('unverified direct-route requests redirect before rendering protected pages', async () => {
  globalThis.__dev08RouteAccess = null;
  await assert.rejects(
    () => modulePage.default({ params: Promise.resolve({ moduleCode: 'customer' }) }),
    /redirect:\//,
  );
  await assert.rejects(() => settingsPage.default(), /redirect:\//);
});
