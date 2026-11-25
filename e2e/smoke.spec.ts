import { expect, test, type Page } from '@playwright/test';

// S1-TST-05 automated smoke cases (SMK-01 to SMK-06).
// Case detail and expected results live in docs/test-cases/smoke-test-cases.md.

const EMAIL = process.env.HOPE_SMOKE_EMAIL ?? '';
const PASSWORD = process.env.HOPE_SMOKE_PASSWORD ?? '';
const HAS_ACCOUNT = Boolean(EMAIL && PASSWORD);
const NO_ACCOUNT = 'Set HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD to run the authenticated cases.';

const GENERIC_LOGIN_ERROR = 'Email or password is incorrect, or the account is not ready to sign in.';
const LOGIN_TAB = 'Login';

async function openLoginTab(page: Page) {
  await page.goto('/');
  await expect(page.locator('#login-email')).toBeVisible();
}

async function signIn(page: Page, email = EMAIL, password = PASSWORD) {
  await openLoginTab(page);
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('S1-TST-05 smoke: login and main page', () => {
  test('SMK-01 login page loads', async ({ page }) => {
    await openLoginTab(page);
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: LOGIN_TAB })).toBeVisible();
  });

  test('SMK-02 login with valid credentials', async ({ page, context }) => {
    test.skip(!HAS_ACCOUNT, NO_ACCOUNT);
    await signIn(page);
    await expect(page).toHaveURL(/\/erp($|\?)/);
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((cookie) => cookie.name.startsWith('sb-'));
    expect(sessionCookie, 'login did not create a Supabase session cookie').toBeTruthy();
  });

  test('SMK-03 login with a wrong password is rejected', async ({ page }) => {
    const email = HAS_ACCOUNT ? EMAIL : `smoke.missing.${Date.now()}@example.test`;
    await signIn(page, email, `wrong-password-${Date.now()}`);
    await expect(page.locator('form[action="/api/auth/login"] p[role="alert"]')).toHaveText(GENERIC_LOGIN_ERROR);
    await expect(page).not.toHaveURL(/\/erp($|\?)/);
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toHaveCount(0);
  });

  test('SMK-04 main page loads after login', async ({ page }) => {
    test.skip(!HAS_ACCOUNT, NO_ACCOUNT);
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Hope/i }).first()).toBeVisible();
  });

  test('SMK-05 logout ends the session', async ({ page }) => {
    test.skip(!HAS_ACCOUNT, NO_ACCOUNT);
    await signIn(page);
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await openLoginTab(page);

    await page.goto('/erp');
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test('SMK-06 main page is blocked when signed out', async ({ page }) => {
    await page.goto('/erp');
    await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#login-email')).toBeVisible();
  });
});
