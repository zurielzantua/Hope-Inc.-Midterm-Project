import assert from 'node:assert/strict';
import test from 'node:test';

const BASE_URL = (process.env.HOPE_SMOKE_BASE_URL ?? 'https://hope-erp-phi.vercel.app').replace(/\/$/, '');
const EMAIL = process.env.HOPE_SMOKE_EMAIL;
const PASSWORD = process.env.HOPE_SMOKE_PASSWORD;
const HAS_ACCOUNT = Boolean(EMAIL && PASSWORD);
const DASHBOARD_MARKER = 'Welcome to your workspace';
const LOGIN_MARKERS = ['id="login-email"', 'id="login-password"', 'Sign in'];

function cookieJar() {
  const jar = new Map();
  return {
    header: () => Array.from(jar, ([name, value]) => `${name}=${value}`).join('; '),
    absorb(response) {
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const separator = pair.indexOf('=');
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        if (!value || /max-age=0/i.test(cookie)) jar.delete(name);
        else jar.set(name, value);
      }
    },
  };
}

async function get(path, jar) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    headers: jar?.header() ? { cookie: jar.header() } : {},
  });
}

async function post(path, body, jar) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      origin: new URL(BASE_URL).origin,
      'content-type': 'application/json',
      ...(jar?.header() ? { cookie: jar.header() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('S1-TST-05 smoke: login and main page', async (t) => {
  let jar = cookieJar();

  await t.test('SMK-01 login page loads', async () => {
    const response = await get('/');
    assert.equal(response.status, 200);
    const html = await response.text();
    for (const marker of LOGIN_MARKERS) assert.ok(html.includes(marker), `login page is missing ${marker}`);
  });

  await t.test('SMK-03 wrong password is rejected', async () => {
    const email = EMAIL ?? `smoke.missing.${Date.now()}@example.test`;
    const response = await post('/api/auth/login', { email, password: `wrong-${Date.now()}` }, jar);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Email or password is incorrect, or the account is not ready to sign in.' });
  });

  await t.test('SMK-06 main page is blocked when signed out', async () => {
    const response = await get('/erp');
    const html = await response.text();
    assert.ok(!html.includes(DASHBOARD_MARKER), 'signed-out /erp rendered the dashboard');
    assert.ok(response.status === 307 || response.status === 308 || html.includes('NEXT_REDIRECT') || html.includes('login-email'),
      'signed-out /erp did not redirect or show the login page');
  });

  await t.test('SMK-02 login with valid credentials', { skip: HAS_ACCOUNT ? false : 'HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD are not set' }, async () => {
    const response = await post('/api/auth/login', { email: EMAIL, password: PASSWORD }, jar);
    assert.equal(response.status, 200);
    jar.absorb(response);
    assert.ok(jar.header().length > 0, 'login did not set a session cookie');
  });

  await t.test('SMK-04 main page loads after login', { skip: HAS_ACCOUNT ? false : 'HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD are not set' }, async () => {
    const response = await get('/erp', jar);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(DASHBOARD_MARKER), 'dashboard heading was not rendered');
    assert.ok(html.includes('ERP'), 'ERP navigation was not rendered');
  });

  await t.test('SMK-05 logout ends the session', { skip: HAS_ACCOUNT ? false : 'HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD are not set' }, async () => {
    const logout = await post('/api/auth/logout', undefined, jar);
    assert.equal(logout.status, 200);
    jar.absorb(logout);

    const afterLogout = await get('/erp', jar);
    const html = await afterLogout.text();
    assert.ok(!html.includes(DASHBOARD_MARKER), 'dashboard still rendered after logout');
    assert.ok(afterLogout.status === 307 || afterLogout.status === 308 || html.includes('NEXT_REDIRECT') || html.includes('login-email'),
      'after logout, /erp did not redirect or show the login page');
    jar = cookieJar();
  });
});
