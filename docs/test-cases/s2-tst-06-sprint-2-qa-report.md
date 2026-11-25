# HOPE Inc. ERP – Sprint 2 Defect and Fix Verification Report (S2-TST-06)

**Role:** Tester
**Related issue:** #135 – Sprint 2 Bug Reports and Fix Verification
**Consolidates:** S2-TST-01 (#156), S2-TST-02 (#149), S2-TST-03 (#143), S2-TST-04 (#140), S2-TST-05 (#136)
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`, 2026-11-24) and the automated suites on that commit
**Report date:** 2026-11-25
**Prepared for:** S2-SM-05 (Sprint 2 review)

> This report does not declare Sprint 2 accepted. A large share of the by-hand screen steps and every real email delivery are still untested because no approved test account and no mailbox were supplied. Those cases are marked Partial, Blocked, or Not Run, and they stay that way until someone can actually run them.

---

## 1. Test Totals

| Task | Cases | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| S2-TST-01 Customer Management | 22 | 16 | 0 | 5 | 1 | 0 |
| S2-TST-02 Product and Price History | 28 | 22 | 0 | 4 | 2 | 0 |
| S2-TST-03 Soft Delete and Restore | 18 | 12 | 0 | 4 | 2 | 0 |
| S2-TST-04 Per-Right Authorization | 31 | 29 | 0 | 1 | 0 | 1 |
| S2-TST-05 Sprint 1 Regression | 35 | 26 | 0 | 5 | 2 | 2 |
| **Sprint 2 total** | **134** | **105** | **0** | **19** | **7** | **3** |

Sprint 1 tester tasks, for the same picture:

| Task | Cases | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| S1-TST-04 Permission Matrix | 15 | 9 | 0 | 5 | 0 | 1 |
| S1-TST-05 Automated Smoke | 6 | 3 | 0 | 0 | 3 | 0 |
| S1-TST-06 Defect Register | 2 bugs | 0 verified fixes | 0 | 0 | 0 | 2 closed – not reproducible |

No case in any task was marked Fail: no behavior contradicted its expected result during the run. Zero failures is not the same as zero risk; read §3 and §4 before treating the totals as healthy.

---

## 2. Automated Evidence Behind the Totals

| Command | Result | Files |
|---|---|---|
| `npm test` (`node --test tests/`) | 237 tests, 237 pass, 0 fail | 23 files |
| `node --test tests/s1-tst-04-permission-matrix.test.mjs` | 8 pass | 1 file |
| `npm run test:e2e` (Playwright, deployment) | 3 pass, 3 skipped (no test account) | `e2e/smoke.spec.ts` |
| `npm run test:smoke` (`node:test`, deployment) | 4 pass, 3 skipped | `tests/s1-tst-05-smoke.test.mjs` |

Per-area coverage of the 237: registration 23, authentication and sessions 28, first password 49, password reset 20, User Management 17, rights 12, ERP access and protected routes 12, Customer 30, Product 31, Price History 11, permission matrix 8.

The automated suite runs the real source files: it compiles the project's own TypeScript modules and calls the real handlers with stubbed dependencies. It proves the server rules. It does not prove what a signed-in person sees on the screen, and it does not touch the production database.

---

## 3. Verified Fixes

| Item | Count | Detail |
|---|---|---|
| Defects found in Sprint 2 | 0 | No case produced a result that contradicted its expected behavior |
| Defects fixed and retested | 0 | Nothing to retest |
| Sprint 1 defects verified fixed | 0 | BUG-01 and BUG-02 were closed as not reproducible; no code fix was ever linked to them (`docs/test-cases/bug-reports-and-fix-verification.md`) |
| Open observations carried forward | 2 | OBS-01 (Admin role change seen by hand) and OBS-02 (System Settings link visible to lower roles) |

Nothing is claimed as verified without a retest that actually ran. The two Sprint 1 reports are closed as "not reproducible" rather than "fixed", because the validation the walkthrough thought was missing was already in the code before the report.

---

## 4. Outstanding Items by Owner

| # | Item | Owner | Why it blocks completion | What closes it |
|---|---|---|---|---|
| 1 | No approved Superadmin, Admin, or User test account was supplied | Scrum Master | Blocks every by-hand screen step: list loads, search boxes, filter buttons, Add/Edit forms, and button visibility. That is 19 Partial and 7 Blocked cases across S2-TST-01 to S2-TST-03. | One approved account per role with the matching rights, created by the DB Admin |
| 2 | No rights-mismatch account | DB Admin | S2-TST-04 RTS-30 needs a Superadmin whose assigned rights were deliberately cleared, to prove a role does not imply a permission | One such account, then one add attempt |
| 3 | Real email delivery never observed | Scrum Master / DB Admin | S2-TST-05 PWD-R2 and PWD-R8: an accepted email request does not prove the mail arrived | One Gmail, one Yahoo, one institutional mailbox, with the setup and reset links followed to the end |
| 4 | Expired and reused tokens never minted live | DB Admin | S2-TST-05 PWD-R4 and PWD-R7 stay Not Run | Tokens generated for a disposable test account and then reused |
| 5 | Database trigger runs | DB Admin | S2-TST-03 DEL-04, DEL-11, DEL-15 need `psql` and an isolated database; neither is on this machine | DB Admin runs `supabase/tests/s2_dba_04_child_record_delete_rules.sql` and posts the result |
| 6 | RLS at the database boundary | DB Admin | S1-TST-04 SRV-05 and the RLS check in S2-TST-04 §11 | A User JWT queried against `product`, `pricehist`, `salesdetail`, and `app_user` |
| 7 | OBS-01 and OBS-02 | Tester, once an account exists | Two by-hand observations from Sprint 1 that contradict the current source | One Admin session and one User session |

---

## 5. What Was Actually Proven This Sprint

Worth stating plainly, because it is the useful part of the result:

- Every write endpoint refuses a request that has no session, has a foreign `Origin`, or is not JSON, and it refuses before any data is read or written. Verified live on the production deployment.
- Every protected page, including the new Customer and Product routes, redirects a signed-out visitor and renders no content. Verified live.
- The nine Customer, Product, and Price rights are each read from the account's assigned rights, not from its role name, and each has a refused case that never reaches the database adapter.
- Input validation is strict and typed: field sets are exact, codes are fixed-length and normalized, dates are calendar-checked including leap years, and prices are bounded and rounded to two decimals.
- Search is safely quoted, so a hostile search string cannot add its own filter terms.
- A soft delete changes only `is_deleted` and compares the expected previous state, so a rejected or stale transition does not report success.
- The last active Superadmin, self-block, and the child-record rules all have server-side guards with tests.

---

## 6. Sprint 3 Readiness

| Question | Assessment |
|---|---|
| Can Sprint 3 build on this? | Yes. The authorization, validation, and soft-delete layers are in place, and every automated suite is green on `6f229eb`. |
| Is Sprint 2 accepted? | No. 29 of 134 cases are Partial, Blocked, or Not Run, and they include every by-hand screen check and every real email delivery. |
| What must happen before Sprint 3 starts? | The Scrum Master supplies one test account per role; the DB Admin runs the two disposable-database scripts and confirms RLS; the first real invitation and reset are sent to a real mailbox. |

Sprint 3 should not start any new Human Resources work that reads the permissions layer until RTS-30 is settled. A permission rule that no one has observed with a real account is a rule the next sprint will copy.

---

## 7. Defect Register

| Bug ID | Feature / case | Environment and commit | Steps | Expected | Actual | Severity | Owner | Fix | Retest | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - | - | - | - | No confirmed Sprint 2 defect |

| Observation | Case | Status |
|---|---|---|
| OBS-01 – an Admin appeared to promote another user to Admin by hand | S2-TST-05 / S1 PRM-04 | Open; the source forbids it, so either the observation saw a rights change or the deployment differs |
| OBS-02 – System Settings link visible to lower roles | S2-TST-05 ERP-R4 | Open; the page redirects lower roles, so the question is only whether the link should be hidden |

---

## 8. Evidence Index

| Document | Covers |
|---|---|
| `docs/test-cases/s2-tst-01-customer-management.md` | 22 Customer cases |
| `docs/test-cases/s2-tst-02-product-price-history.md` | 28 Product and Price cases |
| `docs/test-cases/s2-tst-03-soft-delete-and-restore.md` | 18 delete and restore cases |
| `docs/test-cases/s2-tst-04-per-right-authorization.md` | 31 right-by-right cases |
| `docs/test-cases/s2-tst-05-sprint-1-regression.md` | 35 regression cases |
| `docs/test-cases/permission-matrix-test-cases.md` | Sprint 1 matrix plus the live probe table |
| `docs/test-cases/bug-reports-and-fix-verification.md` | Sprint 1 defect register |
| `docs/test-cases/smoke-test-cases.md` | Six smoke cases, browser and HTTP runs |

---

## 9. Closing Note

The totals above are honest: 105 cases really ran and passed, and 29 did not finish. Counting a skipped case as a pass, or reporting a green deployment check as functional evidence, would have made this report look better and told the team nothing. The next reader should take §4 as the to-do list.
