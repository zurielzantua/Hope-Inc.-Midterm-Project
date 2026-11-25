# HOPE Inc. ERP – Sprint 1 Regression Test Cases (S2-TST-05)

**Role:** Tester
**Related issue:** #136 – Sprint 1 Regression Testing
**Scope:** Sprint 1 account and access behavior re-tested against the Sprint 2 integration build
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`) and the automated suites from the integration branch
**Execution date:** 2026-11-25
**Execution status:** 35 cases. 26 Pass from automated and live evidence. 5 Partial: the rule ran but the by-hand screen step was not performed. 2 Blocked: real email delivery needs an authorized mailbox and a Superadmin session. 2 Not Run: they need an expired or reused token minted on the live site.

> **Status legend:** Pass / Fail / Partial / Blocked / Not Run
> A green deployment check is not functional evidence. Every Pass below names the test or request that produced it. Nothing here is reported as passing because a Vercel build went green.

---

## 1. What Changed Since Sprint 1

Sprint 2 added Customer and Product Management on top of the Sprint 1 account and permission layer. The regression question is whether the new modules broke any Sprint 1 behavior: sign-up, sign-in, approval, first password, reset, blocking, rights, and the protected dashboard.

| Item | Value |
|---|---|
| Integration commit | `6f229eb` (2026-11-24) |
| Sprint 1 case detail | `docs/test-cases/auth-test-cases.md`, `docs/test-cases/user-management-test-cases.md`, `docs/test-cases/permission-matrix-test-cases.md` |
| Automated suites | 237 tests across 23 files, 0 failures |
| Smoke suite | `npm run test:e2e` (Playwright), 3 pass / 3 skipped without a test account |

---

## 2. Registration, Login, and Logout

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| REG-R1 | Registration accepts valid details | Submit first name, last name, and a valid email | 201, account is created `Pending`, caller cannot pick a role | Automated (`register-api.test.mjs`, 23 tests): the payload is limited to three fields, the role and state are forced server-side, and the response is `pending`. Live registration was not submitted. | Partial |
| REG-R2 | Registration rejects bad input | Submit a missing field, a malformed email, an over-long name, or an extra privilege field | 400, no account created | Automated: every variant returns 400 before account creation, and the rollback path is covered. | Pass |
| REG-R3 | Duplicate registration is handled safely | Register an existing email twice | 409 with a non-revealing message | Automated: the duplicate path returns 409 without disclosing which field matched. | Pass |
| LOG-R1 | Login page loads | Open `/` | Email field, password field, `Sign in` button, `Login` tab all visible | Automated browser run 2026-11-25: all four controls found. HTTP run: 200 with the three markup markers. | Pass |
| LOG-R2 | Valid login signs in | Sign in with an approved account | Redirect to `/erp` and a session cookie | Skipped in automation (no test account). Verified by hand on 2026-11-23. Handler tests cover session persistence and cookie flags. | Partial |
| LOG-R3 | Wrong password is rejected | Sign in with a wrong password | The generic message, no session, page stays on `/` | Automated browser run: the form showed "Email or password is incorrect, or the account is not ready to sign in.", the page stayed on `/`, and no dashboard rendered. HTTP run: 401 with no session cookie. | Pass |
| LOG-R4 | Logout ends the session | Sign out, then open `/erp` | Back on the login page; `/erp` no longer renders the dashboard | Automated (`dev03-auth.test.mjs`): logout calls the session provider and returns no-store; a provider failure returns a generic error. Browser SMK-05 skipped without an account. | Partial |
| LOG-R5 | Signed-out protected access | Open `/erp`, `/erp/users`, `/erp/settings` with no cookie | Redirect to login, no dashboard content | Automated browser run: `/erp` redirected to `/` with no workspace heading. Live probe: all four protected routes returned a redirect payload and rendered nothing. | Pass |

---

## 3. Account State and Approval

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| ACC-R1 | Pending account cannot sign in | Sign in as a pending account | Denied with the generic message | Automated (`dev03-auth.test.mjs`): pending accounts stay denied and no token is exposed. Live: not attempted, no pending account supplied. | Partial |
| ACC-R2 | Blocked account cannot sign in | Sign in as a blocked account | Denied with the generic message | Automated: blocked accounts stay denied; an existing session loses access once its account is blocked. | Pass |
| ACC-R3 | Blocking ends a live session | Block an account that is already signed in, then reuse its cookie | The next request is refused | Automated: "an existing session loses access when its account is blocked" passes. | Pass |
| ACC-R4 | Superadmin approval | As a Superadmin, approve a pending account | The account becomes approved | Automated (`dev05-user-management.test.mjs`, 13 tests): only a Superadmin may send `accountState: approved`; an Admin attempt returns 403. | Pass |
| ACC-R5 | Admin designation | As a Superadmin, promote an approved user to Admin | The role becomes admin | Automated: only a Superadmin may send `roleCode: admin`; Admins and Users get 403. The walkthrough observation OBS-01 is still open. | Pass |
| ACC-R6 | Admin cannot approve or promote | As an Admin, send both requests | 403 on both, nothing changed | Automated: both return the specific 403 messages, and no adapter is called. | Pass |
| ACC-R7 | Last-Superadmin protection | Try to block, demote, or delete the last active Superadmin | 409 and the account stays a Superadmin | Automated: the database guard's failure maps to 409 "The last active Superadmin cannot be disabled."; the database script `hope_last_superadmin_guard.sql` covers the trigger itself. | Pass |
| ACC-R8 | Self-block is refused | Try to block your own account | 403 | Automated: the `self_block_forbidden` database error maps to a 403. | Pass |

---

## 4. User Management

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| UMG-R1 | Admin sees only User rows | Open User Management as an Admin | No Superadmin or Admin rows | Automated: the Admin listing filters to the User role only; a Superadmin sees all three. | Pass |
| UMG-R2 | User is refused | Open `/erp/users` as a User | Redirect or not found, no list | Automated: only Admin and Superadmin may list managed users, and the page boundary rejects a User; a User request returns 403 before the database is read. | Pass |
| UMG-R3 | Add User with name and email | As an Admin, add a user | 201, account is Pending | Automated: Add User accepts exactly name and email, normalizes them, and delegates to the existing Pending registration path. | Pass |
| UMG-R4 | Edit, block, and unblock | Edit a name, then block and unblock | Each change is saved and the status label updates | Automated: Edit accepts names only; block and unblock accept a boolean only; generated or privilege fields are refused. | Pass |
| UMG-R5 | Right Management saves only the target and the rights | Save a rights change | The stored set matches the selection | Automated (`dev07-user-rights.test.mjs`, 9 tests): the update carries only the target user and right IDs; forged actor fields, duplicate IDs, and cross-origin writes are refused. | Pass |
| UMG-R6 | Rights change takes effect | Change an account's rights, then reload as that account | The menus and buttons match the new set | Automated: module assignments are re-read per request rather than cached. | Pass |

---

## 5. First Password, Reset, and Email

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| PWD-R1 | First-password invitation is issued | As a Superadmin, send a setup invitation to an approved, unconfirmed account | The invitation is prepared and sent, and a claim is recorded | Automated (`dev03-first-password-server.test.mjs`, 16 tests and `dev03-first-password.test.mjs`, 29 tests): only a trusted Superadmin may issue it, the callback origin is fixed, and a claim in progress cannot be re-invited. | Pass |
| PWD-R2 | Real email delivery to Gmail, Yahoo, and institutional addresses | Send to one address per provider and open the mailbox | The mail arrives and the link works | Not exercised: no mailbox was available to the Tester, and the default provider needed for external recipients is not configured. Recorded as Blocked, not Pass. | Blocked |
| PWD-R3 | First-password setup completes | Follow the link and set a password | The password is set and the session becomes usable | Automated: the password and the trusted completion marker are committed in one Auth operation, and only the atomic claim winner may complete. | Pass |
| PWD-R4 | Invalid, expired, and reused setup links | Reuse a link; use an expired one | Rejected with a controlled response, no details leaked | Automated: malformed, expired, and reused invitation tokens fail without exposing Auth details, and expired or used invite errors map to an invalid-link response. A live expired token was not minted. | Not Run |
| PWD-R5 | Password reset request | Request a reset for an existing address | A recovery email is prepared, and the response is identical to the unknown-address case | Automated (`dev04-password-reset.test.mjs`, 15 tests): the request uses only the public recovery method with a fixed callback, and unknown accounts get the same response. | Pass |
| PWD-R6 | Password reset completes | Open the recovery link and set a new password | The password changes and the local session is cleared | Automated: the reset checks the signed-in identity, updates through Auth, and reports the signed-out state. | Pass |
| PWD-R7 | Reused reset token | Reuse a recovery link | Rejected | Automated: recovery verification fixes the token type and rejects invalid, expired, or reused links; a live reused token was not minted. | Not Run |
| PWD-R8 | Anonymous email delivery | Try to receive real mail for the reset flow | Mail arrives | Blocked for the same reason as PWD-R2. | Blocked |

---

## 6. Role, Rights, and the Protected Dashboard

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| ERP-R1 | Dashboard is protected | Open `/erp` with no session | Redirect to login | Automated browser run and live probe both confirmed a redirect with no dashboard content. | Pass |
| ERP-R2 | Tiles follow assigned rights | Open the dashboard as a User with no rights | Honest empty state, no tiles | Automated (`dev08-erp-access.test.mjs`, 9 tests): tiles show only modules with an assigned right, and zero rights yields an empty list. | Pass |
| ERP-R3 | Direct module URL follows the same rule | Request an unassigned module | 404 or redirect | Automated: unknown and unassigned modules are rejected, and an unauthorized request never reads permissions. | Pass |
| ERP-R4 | System Settings is Superadmin-only | As an Admin and a User, open `/erp/settings` | Redirect for lower roles | Automated: `canAccessSystemSettings()` allows only Superadmin and the page redirects lower roles. The sidebar link observation OBS-02 stays open. | Partial |
| ERP-R5 | Sprint 2 modules did not widen Sprint 1 access | As a User with no Customer or Product right, request both modules | Both refused | Automated and live: both module APIs return 401 without a session, both pages redirect, and a User without the module gets 403 or 404. | Pass |

---

## 7. Test Summary

| Area | Total | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| Registration, login, logout | 8 | 5 | 0 | 3 | 0 | 0 |
| Account state and approval | 8 | 7 | 0 | 1 | 0 | 0 |
| User Management | 6 | 6 | 0 | 0 | 0 | 0 |
| First password, reset, email | 8 | 4 | 0 | 0 | 2 | 2 |
| Role, rights, dashboard | 5 | 4 | 0 | 1 | 0 | 0 |
| **Total** | **35** | **26** | **0** | **5** | **2** | **2** |

Counted 2026-11-25. No regression was observed: every Sprint 1 behavior that could be executed still behaves as Sprint 1 recorded. The 5 Partial cases are by-hand screen steps, the 2 Blocked cases are real email delivery, and the 2 Not Run cases need an expired or reused token.

---

## 8. Automated Regression Commands

```bash
npm test                                  # node --test tests/  — 237 tests, 0 failures
npm run test:e2e                          # Playwright against the deployment — 3 pass, 3 skipped
node --test tests/s1-tst-04-permission-matrix.test.mjs
```

Result on 2026-11-25: 237 tests, 237 pass, 0 fail, plus 8 pass in the permission-matrix file and 3 pass / 3 skipped in the browser run.

---

## 9. Email Delivery — Why It Is Blocked

An accepted email API request does not prove delivery. The Tester has no authorized mailbox on this machine and no Superadmin session on the deployment, so neither the delivery nor the opened link could be observed. Both PWD-R2 and PWD-R8 stay Blocked, and no mail is reported as delivered.

What would settle them: one Superadmin test account, one Gmail address, one Yahoo address, and one institutional address, each opened from the real inbox, with the setup and reset links followed to the end.

---

## 10. Regressions Found

| Defect ID | Related case | Summary | Severity | Status |
|---|---|---|---|---|
| - | - | No Sprint 1 regression was observed on `6f229eb`. | - | - |

The two open observations (OBS-01 for the Admin role change, OBS-02 for the System Settings link) are carried from Sprint 1 and are unchanged by this run. They are not regressions; they are unresolved Sprint 1 questions.
