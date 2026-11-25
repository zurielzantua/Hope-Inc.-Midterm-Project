# HOPE Inc. ERP – Automated Smoke Test Cases: Login and Main Page

**Role:** Tester
**Scope:** Quick checks that the login and main page (dashboard) work after each deployment
**Environment:** Deployed website (https://hope-erp-phi.vercel.app)
**Execution date:** Manual run 2026-11-23; automated HTTP run 2026-11-25; automated browser run 2026-11-25
**Execution status:** Three automated cases pass in a browser with no test account. The three cases that need a signed-in session are automated but skipped until a dedicated approved test account is supplied through environment variables.

> **Status legend:** Not Run / Pass / Fail / Blocked / Skipped
> **Pass criteria:** all 6 cases pass on every run. If any case fails, the build is not considered healthy and the failure is reported.

---

## 1. Setup

| Item | Value |
|---|---|
| Base URL | `HOPE_SMOKE_BASE_URL`, default `https://hope-erp-phi.vercel.app` |
| Test account | One dedicated approved test account. Credentials are read from `HOPE_SMOKE_EMAIL` and `HOPE_SMOKE_PASSWORD`; they are never stored in the repository. |
| Browser runner | Playwright, file `e2e/smoke.spec.ts`, config `playwright.config.ts` |
| Browser command | `npm run test:e2e` |
| HTTP runner | Node.js built-in `node:test` and `fetch`, file `tests/s1-tst-05-smoke.test.mjs` |
| HTTP command | `npm run test:smoke` |
| Run when | After each deployment, and before demos |

The browser run is the primary evidence: it clicks the real form, follows the redirect, and checks what is on the page. The HTTP run is kept as a fast deployment check that needs no browser download.

On a machine that already has a browser installed, set `HOPE_E2E_CHANNEL` to `msedge` or `chrome` so Playwright does not download its own browser. Otherwise run `npx playwright install --with-deps` once.

The authenticated cases are skipped when the two credential variables are not set. The public cases still run, so a deployment that loses its login page or exposes the dashboard to a signed-out visitor is still caught.

---

## 2. Smoke Test Cases

| ID | Test case | Automated steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| SMK-01 | Login page loads | Open `/` and assert the email field, the password field, the `Sign in` button, and the `Login` tab are visible | All four controls are visible | Browser run: all four controls found on the first paint. HTTP run: HTTP 200 and the three markup markers present. | Pass (automated) |
| SMK-02 | Login with valid credentials | Fill the email and password fields, click `Sign in`, assert the URL is `/erp`, the workspace heading is shown, and a `sb-` session cookie exists | Signed in, dashboard shown, session cookie set | Skipped: no test account was supplied in this environment. Verified by hand on 2026-11-23 with a User account. | Skipped (Blocked on test credentials) |
| SMK-03 | Login with a wrong password | Fill a wrong password and submit, assert the login form shows the generic rejection message and the page stays on `/` | Generic "Email or password is incorrect…" message, no dashboard, no session | Browser run: the login form showed the generic message, the page stayed on `/`, no dashboard heading. HTTP run: HTTP 401 with the same message and no session cookie. | Pass (automated) |
| SMK-04 | Main page loads after login | After a valid sign-in, assert the workspace heading, the `Sign out` button, and the Hope header are visible | Dashboard renders with its heading and navigation | Skipped: no test account was supplied. Verified by hand on 2026-11-23 (dashboard loaded within 4 seconds). | Skipped (Blocked on test credentials) |
| SMK-05 | Logout | Sign in, click `Sign out`, assert the app returns to `/`, then visit `/erp` again | Back on the login page, and `/erp` no longer renders the dashboard | Skipped: no test account was supplied. Verified by hand on 2026-11-23. | Skipped (Blocked on test credentials) |
| SMK-06 | Main page blocked when signed out | Visit `/erp` with no session | `/erp` redirects to `/` and shows the login form, with no dashboard content | Browser run: `/erp` redirected to `/`, no dashboard heading, login form visible. HTTP run: no dashboard marker in the response. | Pass (automated) |

---

## 3. Test Summary

### Manual run (2026-11-23)

| Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|
| 6 | 6 | 0 | 0 | 0 |

### Automated browser run (2026-11-25)

```
npm run test:e2e
```

| Total | Pass | Fail | Skipped |
|---|---|---|---|
| 6 | 3 | 0 | 3 |

`SMK-01`, `SMK-03`, and `SMK-06` pass without credentials. `SMK-02`, `SMK-04`, and `SMK-05` are skipped until `HOPE_SMOKE_EMAIL` and `HOPE_SMOKE_PASSWORD` are provided.

### Automated HTTP run (2026-11-25)

```
npm run test:smoke
```

| Total | Pass | Fail | Skipped |
|---|---|---|---|
| 7 | 4 | 0 | 3 |

The HTTP total counts the parent suite plus the six cases. The same three authenticated cases are skipped.

---

## 4. Notes

- Run the browser suite with a dedicated approved account, for example:

  ```powershell
  $env:HOPE_SMOKE_EMAIL = 'smoke.user@example.test'
  $env:HOPE_SMOKE_PASSWORD = '<test-only password>'
  $env:HOPE_E2E_CHANNEL = 'msedge'
  npm run test:e2e
  ```

  On macOS or Linux use `HOPE_SMOKE_EMAIL=... npm run test:e2e`.

- Failures keep a screenshot and a Playwright trace under `test-results/`, and the HTML report goes to `playwright-report/`. Both folders are ignored by Git; the report is evidence for the run, not a committed file.

- The earlier HTTP-only check did not execute client JavaScript, so it could not see the login form's own error message or the redirect the browser performs. The browser suite closes that gap: SMK-01, SMK-03, SMK-06 now assert on rendered controls and on the URL after the click.

- Run the cases in order, since SMK-04 and SMK-05 depend on the login from SMK-02. Each Playwright test is independent because each one signs in itself, so a single case can also be run alone.

- Use a dedicated test account and keep its credentials in environment variables or CI secrets, not in the test files. Never use a real Superadmin account for the smoke run.

- If SMK-03 is run repeatedly against the live deployment, keep the wrong-password attempts to one per run so the authentication rate limit is not triggered.

- Do not report the manual run as automated evidence. The manual 2026-11-23 run covers all six cases by hand; the automated runs above cover the cases a machine can run without a test account.
