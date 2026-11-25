import { defineConfig } from '@playwright/test';

// S1-TST-05: browser smoke configuration.
//
// Point HOPE_SMOKE_BASE_URL at the site to test (the hosted deployment by default,
// or http://127.0.0.1:3000 after `npm run dev`). The login cases read the account
// from HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD so no credential is stored here.
//
// HOPE_E2E_CHANNEL lets a machine reuse a browser it already has installed
// (`msedge` or `chrome`) instead of downloading Playwright's bundled browser.
const channel = process.env.HOPE_E2E_CHANNEL?.trim() || undefined;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: (process.env.HOPE_SMOKE_BASE_URL ?? 'https://hope-erp-phi.vercel.app').replace(/\/$/, ''),
    channel,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
});
