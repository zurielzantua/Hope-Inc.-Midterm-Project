# HOPE Inc. ERP G혀 Sprint 1 Bug Reports and Fix Verification

**Role:** Tester
**Related issue:** S1-TST-06 (#54) G혀 Bug reports and fix verification
**Scope:** Defects found during Sprint 1 testing, and verification of their fixes
**Environment:** Production deployment https://hope-erp-phi.vercel.app (integration commit `6f229eb`, 2026-11-24)
**Status:** 2 bugs recorded. Both were retested and could not be reproduced; triage found no code fix because the expected validation was already in place. 0 open product defects remain from this register. 2 open observations (OBS-01, OBS-02) are carried below; each needs one signed-in test session to settle, so neither is filed as a defect yet.

> **Status legend:** Open / Fixed (ready to retest) / Verified / Closed G혀 not reproducible / Reopened
> "Verified" means a fix exists and the retest passed. "Closed G혀 not reproducible" means the retest passed but no fix could be linked, so the original observation is treated as a test artifact until new evidence appears.

---

## 1. Bug Reports

| Bug ID | Found in | Summary | Steps to reproduce | Expected result | Actual result (when found) | Severity | Issue # | Status |
|---|---|---|---|---|---|---|---|---|
| BUG-01 | REG-03 | An invalid email format was accepted on registration | 1. Open the register page. 2. Fill the required fields with an invalid email (the exact value was not recorded; candidates were `abc@` or `abc.com`). 3. Submit. | A validation error is shown and the form is not submitted | "Registration submitted. An admin must approve your account before you can sign in." | Medium | Not filed G혀 closed during triage | Closed G혀 not reproducible |
| BUG-02 | LOG-03 | Login with an unregistered email revealed that the email is not registered | 1. Open the login page. 2. Enter an email that is not registered and any password. 3. Submit. | The same generic error as a wrong password: "Email or password is incorrect, or the account is not ready to sign in." | "Email unidentified" | Medium | Not filed G혀 closed during triage | Closed G혀 not reproducible |

### Triage detail

- **BUG-01:** The register form has used `type="email"` and the API has used the same email pattern since `0557b4f` (`S1-DEV-02`, PR #34). `lib/supabase/registration.ts` rejects a malformed address with HTTP 400 before any account is created. The exact input used in the original run was not recorded, so the "Registration submitted" observation cannot be tied to a code path.
- **BUG-02:** `app/api/auth/login/route.ts` and `lib/auth/core.ts` have returned the generic 401 message for invalid, unconfirmed, and missing identities since `7d7eef6` (`S1-DEV-03`, PR #43). The string "Email unidentified" does not exist in `app/`, `lib/`, or `supabase/`. The observation is most likely a transient Supabase Auth response or a test-account mix-up; it is not a product defect in the recorded build.

No code change was made for either bug. If a future run reproduces either observation on a recorded commit, reopen it and attach the request/response evidence.

---

## 2. Fix Verification

| Bug ID | Fix (PR or commit) | Retest steps | Retest result | Date verified | Status |
|---|---|---|---|---|---|
| BUG-01 | No code fix. Existing validation: `0557b4f` (PR #34), `lib/supabase/registration.ts`, `app/page.tsx` | Enter an invalid email on the register page and submit; also send a malformed email directly to `POST /api/register` | The form blocks the value with the browser email check; the API returns 400 and creates no account. The deployed site did not accept the fake email. | 2026-11-23 (manual); 2026-11-25 (automated) | Closed G혀 not reproducible |
| BUG-02 | No code fix. Existing generic handling: `7d7eef6` (PR #43), `app/api/auth/login/route.ts`, `lib/auth/core.ts` | Enter an unregistered email and any password; also call `POST /api/auth/login` with an unknown address | The live site returned "Email or password is incorrect, or the account is not ready to sign in.", the same message as a wrong password. No session cookie was set. The browser smoke case SMK-03 asserts this message and passes. | 2026-11-23 (manual); 2026-11-25 (automated browser + HTTP) | Closed G혀 not reproducible |

---

## 3. Automated Regression Evidence (2026-11-25)

Command:

```bash
node --test tests/
```

Result: 237 tests, 237 pass, 0 fail. The per-file counts for the two reports and the areas they cover:

| Command | Result | Coverage |
|---|---|---|
| `node --test tests/register-api.test.mjs` | 23 tests, 23 pass, 0 fail | Missing, blank, invalid, and incorrectly typed registration fields are rejected before an account is created; rollback and rate-limit paths also pass |
| `node --test tests/dev03-auth.test.mjs` | 28 tests, 28 pass, 0 fail | Invalid credentials return 401 without a session; pending, blocked, deleted, and missing accounts stay denied; no token values are exposed |
| `npm run test:e2e` (Playwright, deployed site) | 3 pass, 0 fail, 3 skipped | Login page loads, a wrong password shows the generic error, and a signed-out visitor cannot reach `/erp`. The three authenticated cases are skipped without a test account. |

These are source-level tests plus one browser run against the deployment. The manual retest recorded above is the by-hand evidence.

---

## 4. Open Observations (not yet confirmed defects)

| ID | Observation | Found in | Why it is not confirmed | What settles it | Status |
|---|---|---|---|---|---|
| OBS-01 | The 2026-11-22 walkthrough recorded that an Admin could make another user an Admin. | PRM-04 | `handleUpdateManagedUser` returns 403 for `roleCode: admin` when the actor is an Admin, and `canManageUserRole('admin', 'admin')` is false. The walkthrough may have seen a Rights change instead of a role change, or the deployed site may differ from the branch. | One Admin session: try to set another user's role to Admin and capture the request and the response. | Open G혀 needs an Admin test account |
| OBS-02 | The sidebar showed System Settings to every role in the walkthrough. | UI-01 | `canAccessSystemSettings()` allows only Superadmin and `app/erp/settings/page.tsx` redirects lower roles, so the page itself refuses access. The question is only whether the link should be hidden for lower roles. | One User session: open `/erp/settings` and record whether the page renders or redirects, and whether the sidebar link is shown. | Open G혀 needs a User test account |

Both observations were re-checked against the current integration source on 2026-11-25 and behave as the code says. They stay open only because the by-hand UI step needs a signed-in session.

---

## 5. Summary

| Total bugs | Open | Fixed (ready to retest) | Verified | Closed G혀 not reproducible | Reopened |
|---|---|---|---|---|---|
| 2 | 0 | 0 | 0 | 2 | 0 |

| Open observations | Settled | Waiting on a test account |
|---|---|---|
| 2 | 0 | 2 |

---

## 6. Notes

- Both original observations now behave as expected on retest. Neither has a linked product fix because the validation was already present in the recorded implementation. The earlier "Verified" label was corrected to "Closed G혀 not reproducible" during this review.
- The exact invalid email used in the BUG-01 retest was not recorded. Future defect reports must include the exact input, the account, the deployment URL, commit `6f229eb`, and the request/response.
- The server-side permission cases (SRV-01 to SRV-04 in `docs/test-cases/permission-matrix-test-cases.md`) produced no new defect. Live unauthenticated probes on 2026-11-25 returned 401 for reads and 403 for writes from a foreign origin, with no data and no changes.
- A defect is only recorded as verified when a retest ran and passed. Nothing in this register is reported as fixed without that retest.
