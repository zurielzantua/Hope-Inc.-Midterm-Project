# HOPE Inc. ERP – Sprint 1 Bug Reports and Fix Verification

**Role:** Tester
**Related issue:** S1-TST-06 (#54) – Bug reports and fix verification
**Scope:** Defects found during Sprint 1 testing, and verification of their fixes
**Environment:** Production deployment https://hope-erp-phi.vercel.app (the Sprint 1 review records commit `286ac83` as READY)
**Status:** 2 bugs recorded. Both were retested on 2026-11-23 and could not be reproduced. Triage on 2026-11-25 found no code fix because the expected validation was already present. 0 open product defects remain from this register.

> **Status legend:** Open / Fixed (ready to retest) / Verified / Closed – not reproducible / Reopened
> "Verified" means a fix exists and the retest passed. "Closed – not reproducible" means the retest passed but no fix could be linked, so the original observation is treated as a test artifact until new evidence appears.

---

## 1. Bug Reports

| Bug ID | Found in | Summary | Steps to reproduce | Expected result | Actual result (when found) | Severity | Issue # | Status |
|---|---|---|---|---|---|---|---|---|
| BUG-01 | REG-03 | An invalid email format was accepted on registration | 1. Open the register page. 2. Fill the required fields with an invalid email (the exact value was not recorded; candidates were `abc@` or `abc.com`). 3. Submit. | A validation error is shown and the form is not submitted | "Registration submitted. An admin must approve your account before you can sign in." | Medium | Not filed – closed during triage | Closed – not reproducible |
| BUG-02 | LOG-03 | Login with an unregistered email revealed that the email is not registered | 1. Open the login page. 2. Enter an email that is not registered and any password. 3. Submit. | The same generic error as a wrong password: "Email or password is incorrect, or the account is not ready to sign in." | "Email unidentified" | Medium | Not filed – closed during triage | Closed – not reproducible |

### Triage detail

- **BUG-01:** The register form has used `type="email"` and the API has used the same email pattern since `0557b4f` (`S1-DEV-02`, PR #34). `lib/supabase/registration.ts` rejects a malformed address with HTTP 400 before any account is created. The exact input used in the original run was not recorded, so the "Registration submitted" observation cannot be tied to a code path.
- **BUG-02:** `app/api/auth/login/route.ts` and `lib/auth/core.ts` have returned the generic 401 message for invalid, unconfirmed, and missing identities since `7d7eef6` (`S1-DEV-03`, PR #43). The string "Email unidentified" does not exist in `app/`, `lib/`, or `supabase/`. The observation is most likely a transient Supabase Auth response or a test-account mix-up; it is not a product defect in the recorded build.

No code change was made for either bug. If a future run reproduces either observation on a recorded commit, reopen it and attach the request/response evidence.

---

## 2. Fix Verification

| Bug ID | Fix (PR or commit) | Retest steps | Retest result | Date verified | Status |
|---|---|---|---|---|---|
| BUG-01 | No code fix. Existing validation: `0557b4f` (PR #34), `lib/supabase/registration.ts`, `app/page.tsx` | Enter an invalid email on the register page and submit; also send a malformed email directly to `POST /api/register` | The form blocks the value with the browser email check; the API returns 400 and creates no account. The deployed site did not accept the fake email. | 2026-11-23 (manual); 2026-11-25 (automated regression) | Closed – not reproducible |
| BUG-02 | No code fix. Existing generic handling: `7d7eef6` (PR #43), `app/api/auth/login/route.ts`, `lib/auth/core.ts` | Enter an unregistered email and any password; also call `POST /api/auth/login` with an unknown address | The site returned "Email or password is incorrect, or the account is not ready to sign in.", the same message as a wrong password. No session cookie was set. | 2026-11-23 (manual); 2026-11-25 (automated regression) | Closed – not reproducible |

---

## 3. Automated Regression Evidence

The checks that cover the two reports pass on the current integration branch:

| Command | Result | Coverage |
|---|---|---|
| `node --test tests/register-api.test.mjs` | 23 tests, 23 pass, 0 fail | Missing, blank, invalid, and incorrectly typed registration fields are rejected before an account is created; rollback and rate-limit paths also pass |
| `node --test tests/dev03-auth.test.mjs` | 28 tests, 28 pass, 0 fail | Invalid credentials return 401 without a session; pending, blocked, deleted, and missing accounts stay denied; no token values are exposed |

These are source-level tests. The manual retest recorded above is the deployed-site evidence.

---

## 4. Items to Confirm (not yet defects)

| Observation | Found in | What to confirm | Current status |
|---|---|---|---|
| System Settings appeared for Admin and User roles in the UI-01 walkthrough, while `canAccessSystemSettings()` allows only Superadmin and `app/erp/settings/page.tsx` redirects lower roles | UI-01 / PRM notes | Confirm whether the sidebar item itself is hidden for Admin and User. If a lower role can open the page, log it as a permission defect with the account and URL. | Open observation |
| Admin appeared able to make another user an Admin | PRM-04 | The server allows only a Superadmin to send `roleCode: 'admin'` or `accountState: 'approved'`; Admins can manage rights for User accounts. Confirm whether the observed action was a role change or a rights change. If it was a real role change, log it as a defect. | Open observation |
| The register page did not show an "Add User" option in the User Management walkthrough | PRM-02 | Confirm whether account creation is intentionally limited to registration or a separate admin flow. This is a scope question, not a confirmed defect. | Open observation |

---

## 5. Summary

| Total bugs | Open | Fixed (ready to retest) | Verified | Closed – not reproducible | Reopened |
|---|---|---|---|---|---|
| 2 | 0 | 0 | 0 | 2 | 0 |

---

## 6. Notes

- Both original observations now behave as expected on retest. Neither has a linked product fix because the validation was already present in the recorded implementation. The earlier "Verified" label was corrected to "Closed – not reproducible" during this review.
- The exact invalid email used in the BUG-01 retest was not recorded. Future defect reports must include the exact input, the account, the deployment URL, and the commit SHA.
- `docs/test-cases/auth-test-cases.md` still marks REG-03 and LOG-03 as Fail. Update that file to reference this register when the auth test cases are next revised; it is a documentation follow-up, not a product defect.
- Add any new bugs from the server-side permission checks (SRV cases in `permission-matrix-test-cases.md`) in the same format, with a link to the failing request and the fix.
