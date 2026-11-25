# HOPE Inc. ERP – Automated Smoke Test Cases: Login and Main Page

**Role:** Tester
**Scope:** Quick checks that the login and main page (dashboard) work after each deployment
**Environment:** Deployed website (https://hope-erp-phi.vercel.app)
**Execution date:** Manual run 2026-11-23; automated run 2026-11-25
**Execution status:** Manual run: 6 of 6 Pass with a User account. Automated run: 3 Pass, 4 skipped because no test credentials were available in the local environment.

> **Status legend:** Not Run / Pass / Fail / Blocked / Skipped
> **Pass criteria:** all 6 cases pass on every run. If any case fails, the build is not considered healthy and the failure is reported.

---

## 1. Setup

| Item | Value |
|---|---|
| Base URL | `HOPE_SMOKE_BASE_URL`, default `https://hope-erp-phi.vercel.app` |
| Test account | One dedicated approved test account. Credentials are read from `HOPE_SMOKE_EMAIL` and `HOPE_SMOKE_PASSWORD`; they are never stored in the repository. |
| Tool | Node.js 20.9 or newer with the built-in `node:test` runner and `fetch`, so the check has no browser dependency |
| Automated file | `tests/s1-tst-05-smoke.test.mjs` |
| Command | `npm run test:smoke` |
| Run when | After each deployment, and before demos |

The authenticated cases are skipped when the two credential variables are not set. Public cases still run, so a deployment that loses its login page or exposes the dashboard to a signed-out visitor is still caught.

---

## 2. Smoke Test Cases

| ID | Test case | Automated steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| SMK-01 | Login page loads | `GET /` and check the email field, password field, and sign-in button | The page loads and shows `login-email`, `login-password`, and `Sign in` | Automated run: HTTP 200 and all three markers found. Manual run: login page loaded with no errors. | Pass (automated) |
| SMK-02 | Login with valid credentials | `POST /api/auth/login` with the test email and password, and keep the returned session cookies | HTTP 200 and at least one session cookie is set | Manual run: signed in with the User account and was sent to the dashboard. Automated run skipped because credentials were not set. | Pass (manual); automated Not Run |
| SMK-03 | Login with a wrong password | `POST /api/auth/login` with the test email and a wrong password, or an unknown smoke address when no test account is configured | HTTP 401 and the generic message, with no session cookie | Automated run: HTTP 401 with "Email or password is incorrect, or the account is not ready to sign in." Manual run: same message. | Pass (automated and manual) |
| SMK-04 | Main page loads after login | `GET /erp` with the session cookies from SMK-02 | HTTP 200 and the dashboard heading and ERP navigation are present | Manual run: dashboard loaded within 4 seconds. Automated run skipped because credentials were not set. | Pass (manual); automated Not Run |
| SMK-05 | Logout | `POST /api/auth/logout`, then `GET /erp` with the updated cookies | HTTP 200 from logout, then the dashboard is no longer rendered | Manual run: logout returned to the login page with no errors. Automated run skipped because credentials were not set. | Pass (manual); automated Not Run |
| SMK-06 | Main page blocked when signed out | `GET /erp` with no session cookies | No dashboard content; the response redirects or returns the login page | Automated run: no dashboard heading and the protected page returned the login redirect payload. Manual run: pasted dashboard URL stayed on the login page. | Pass (automated) |

---

## 3. Test Summary

### Manual run (2026-11-23)

| Total | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|
| 6 | 6 | 0 | 0 | 0 |

### Automated run (2026-11-25)

| Total | Pass | Fail | Skipped |
|---|---|---|---|
| 7 | 4 | 0 | 3 |

The automated total counts the parent suite plus the six cases. SMK-01, SMK-03, and SMK-06 pass without credentials; SMK-02, SMK-04, and SMK-05 are skipped until `HOPE_SMOKE_EMAIL` and `HOPE_SMOKE_PASSWORD` are provided.

---

## 4. Notes

- Run the suite with a dedicated approved account, for example:

  ```bash
  HOPE_SMOKE_EMAIL=smoke.user@example.test \
  HOPE_SMOKE_PASSWORD='<test-only password>' \
  npm run test:smoke
  ```

  On PowerShell, set the two variables with `$env:HOPE_SMOKE_EMAIL` and `$env:HOPE_SMOKE_PASSWORD` first.

- The automated check is HTTP-level. It verifies status codes, session cookies, and server-rendered markers. It does not execute client JavaScript, so it cannot detect console errors, failed asset requests, or client-side paint timing. Keep the manual SMK-04 observation for those until a browser runner is added.

- Run the cases in order, since SMK-04 and SMK-05 depend on the login from SMK-02. The automated file keeps that order inside one parent test.

- Use a dedicated test account and keep its credentials in environment variables or CI secrets, not in the test files. Never use a real Superadmin account for the smoke run.

- If SMK-03 is run repeatedly against the live deployment, keep the wrong-password attempts to one per run so the authentication rate limit is not triggered.
