# Tester Final Submission – Tasks, Branches, PR Text, and Blockers

**Role:** Tester
**Date:** 2026-11-25
**Integration branch:** `setup/initial-project-structure` (target for all nine PRs)
**Integration commit tested:** `6f229eb` (2026-11-24)

Every branch below was cut from `origin/setup/initial-project-structure`, contains only the files for its own task, and carries one commit. Nothing has been pushed yet: this machine has no GitHub credentials, so the Tester runs the `git push` commands in §3 and opens the PRs with the text in §4.

A wrong number in a PR is worse than a late PR. Where a case could not be executed, this report says so and the PR text says so too.

---

## 1. Task Table

| Task | Issue | Branch | Commit | Files added or changed | Result |
|---|---|---|---|---|---|
| S1-TST-04 | #52 | `s1/tst-04` | `feb3043` | `docs/test-cases/permission-matrix-test-cases.md` (+ live probe section), `tests/s1-tst-04-permission-matrix.test.mjs`, `.gitignore` | 15 cases: 9 Pass, 5 Partial, 1 Not Run, 0 Fail |
| S1-TST-05 | #53 | `s1/tst-05` | `009e4b9` | `e2e/smoke.spec.ts`, `playwright.config.ts`, `package.json`, `package-lock.json`, `docs/test-cases/smoke-test-cases.md`, `.gitignore` | 6 cases: 3 Pass automated, 3 Blocked on a test account, 0 Fail |
| S1-TST-06 | #54 | `s1/tst-06` | `0e7bfb1` | `docs/test-cases/bug-reports-and-fix-verification.md` | 2 bugs: 2 closed not reproducible, 2 open observations |
| S2-TST-01 | #156 | `s2/tst-01` | `ff56f64` | `docs/test-cases/s2-tst-01-customer-management.md` | 22 cases: 16 Pass, 5 Partial, 1 Blocked, 0 Fail |
| S2-TST-02 | #149 | `s2/tst-02` | `ed3a111` | `docs/test-cases/s2-tst-02-product-price-history.md` | 28 cases: 22 Pass, 4 Partial, 2 Blocked, 0 Fail |
| S2-TST-03 | #143 | `s2/tst-03` | `cfd7c91` | `docs/test-cases/s2-tst-03-soft-delete-and-restore.md` | 18 cases: 12 Pass, 4 Partial, 2 Blocked, 0 Fail |
| S2-TST-04 | #140 | `s2/tst-04` | `2f41f7d` | `docs/test-cases/s2-tst-04-per-right-authorization.md` | 31 cases: 29 Pass, 1 Partial, 1 Not Run, 0 Fail |
| S2-TST-05 | #136 | `s2/tst-05` | `e0333b9` | `docs/test-cases/s2-tst-05-sprint-1-regression.md` | 35 cases: 26 Pass, 5 Partial, 2 Blocked, 2 Not Run, 0 Fail |
| S2-TST-06 | #135 | `s2/tst-06` | branch HEAD, two commits | `docs/test-cases/s2-tst-06-sprint-2-qa-report.md`, `docs/test-cases/tester-final-submission.md` | 134 Sprint 2 cases: 105 Pass, 19 Partial, 7 Blocked, 3 Not Run, 0 Fail |

The `s1/tst-04`, `s1/tst-05`, and `s1/tst-06` remotes already hold an earlier version of each branch, so a plain `git push` fast-forwards them; no force-push is needed or allowed. The six Sprint 2 branches are new and are pushed with `-u`.

---

## 2. PR #194

The brief says to publish a clean replacement and then ask the Scrum Master to close #194 as superseded.

- `s1/tst-04` **is** that replacement. It carries only the permission-matrix document plus the automated matrix test. It does not carry `auth-test-cases.md`, `user-management-test-cases.md`, the PNG files, or the register page screenshot that #194 bundled in.
- During this run, `git fetch --prune` reported `[deleted] origin/pr-194`, which means the branch that backed PR #194 has already been removed upstream. Check the PR state before sending the "superseded" note; if it is already closed, only the s1/tst-04 PR needs to be opened.

---

## 3. Push Commands

Run these one at a time after signing in with `git push` once (your Credential Manager will remember it).

```powershell
git push -u origin s1/tst-04
git push -u origin s1/tst-05
git push -u origin s1/tst-06
git push -u origin s2/tst-01
git push -u origin s2/tst-02
git push -u origin s2/tst-03
git push -u origin s2/tst-04
git push -u origin s2/tst-05
git push -u origin s2/tst-06
```

Every one of those branches is based on `origin/setup/initial-project-structure` with no other branch merged in, so each push is a fast-forward or a new branch.

---

## 4. PR Titles and Descriptions

Open each PR against `setup/initial-project-structure`, link the issue, and request a teammate review. Do not approve your own PR.

### S1-TST-04 → `s1/tst-04`

**Title:** S1-TST-04: test(auth): complete role-and-rights permission matrix

```
Related task: S1-TST-04 (#52)

Summary
- Permission matrix coverage for Superadmin, Admin, and User.
- Navigation and individual action-right verification.
- Server-side authorization and RLS testing.
- Completion of previously incomplete test cases.

Validation
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb (2026-11-24)
- Passed: 9
- Failed: 0
- Partial: 5 (handler rule proven; the signed-in request was not run)
- Blocked: 0
- Not Run: 1 (RLS query needs a low-privilege database token)
- Evidence: docs/test-cases/permission-matrix-test-cases.md (sections 4.1, 4.2, 4.3); node --test tests/s1-tst-04-permission-matrix.test.mjs -> 8 pass
- Live probes: GET /api/user-management, /api/user-management/rights, /api/customer, /api/product -> 401; PATCH /api/user-management/update with no session and with a foreign Origin -> 403; /erp, /erp/users, /erp/settings, /erp/modules/customer -> redirect payload, no content
- Outstanding defects: none confirmed. OBS-01 (Admin role change seen by hand) and OBS-02 (System Settings link visible to lower roles) stay open until one signed-in session each is run.

Supersedes PR #194, which bundled unrelated test-case documents and screenshots. This PR carries only the permission matrix document and the matrix test.
```

### S1-TST-05 → `s1/tst-05`

**Title:** S1-TST-05: test(e2e): add automated login and dashboard smoke tests

```
Related task: S1-TST-05 (#53)

Summary
- Automated login and dashboard smoke tests with Playwright (e2e/smoke.spec.ts).
- Successful and unsuccessful authentication scenarios.
- Logout and protected-route verification.
- Secure test configuration and execution instructions.

Validation
- Test command: npm run test:e2e (add HOPE_SMOKE_EMAIL / HOPE_SMOKE_PASSWORD for the authenticated cases)
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb (2026-11-24)
- Automated results: SMK-01 pass, SMK-03 pass, SMK-06 pass, SMK-02 / SMK-04 / SMK-05 skipped (no approved test account), 3 passed 0 failed 3 skipped
- Also kept: npm run test:smoke (HTTP-level node:test suite) -> 4 pass, 3 skipped
- Evidence: docs/test-cases/smoke-test-cases.md (sections 2 and 3); failed runs keep a screenshot and trace in test-results/, ignored by Git
- Credentials are read from HOPE_SMOKE_EMAIL and HOPE_SMOKE_PASSWORD only; no account is stored in the repository
- Remaining failures: none in the executed cases. The three authenticated cases cannot run until a dedicated approved account is supplied.

Note for reviewers: package.json gains @playwright/test plus npm test / test:e2e / test:e2e:report scripts. On a machine with Edge installed, set HOPE_E2E_CHANNEL=msedge so Playwright does not download its own browser.
```

### S1-TST-06 → `s1/tst-06`

**Title:** S1-TST-06: docs(qa): document Sprint 1 defects and fix verification

```
Related task: S1-TST-06 (#54)

Summary
- Sprint 1 defect register.
- Reproducible bug reports and supporting evidence.
- Fix verification linked to implementation changes.
- Remaining defects and blockers.

Validation
- Defects recorded: 2 (BUG-01 invalid email on registration, BUG-02 login revealing an unregistered address)
- Fixes verified: 0 with a linked code change; both close as "not reproducible" because the expected validation was already present at 0557b4f (PR #34) and 7d7eef6 (PR #43)
- Outstanding defects: 0 open; 2 open observations (OBS-01, OBS-02) need one signed-in session each
- Evidence: docs/test-cases/bug-reports-and-fix-verification.md; npm test -> 237 pass, 0 fail; npm run test:e2e -> 3 pass, 3 skipped

No defect is reported as fixed without a retest that ran.
```

### S2-TST-01 → `s2/tst-01`

**Title:** S2-TST-01: test(customer): verify customer management functionality

```
Related task: S2-TST-01 (#156)

Summary
- Customer list, search, filter, create, and edit test cases.
- Input validation and identity preservation.
- Role-based visibility and authorization checks.
- Execution results and defects.

Validation
- Tested roles: User, Admin, Superadmin rules checked at the handler boundary; no approved account was available for the on-screen walks
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb
- Results: 22 cases - 16 Pass, 5 Partial, 1 Blocked, 0 Fail
- Evidence: docs/test-cases/s2-tst-01-customer-management.md; node --test tests/s2-dev01-customer-list.test.mjs (9), s2-dev02-customer-mutations.test.mjs (12), s2-dev03-customer-status.test.mjs (9) -> all pass
- Live anonymous probes: GET /api/customer -> 401; POST /api/customer and PATCH /api/customer/[no]/status -> 403; /erp/modules/customer -> redirect, no content
- Outstanding defects: none observed

Safety: no write request was sent to the production database.
```

### S2-TST-02 → `s2/tst-02`

**Title:** S2-TST-02: test(product): verify product management and price history

```
Related task: S2-TST-02 (#149)

Summary
- Product Management functional coverage.
- Price History operations and effective-date validation.
- Current-price calculation verification.
- Historical, future, inactive, and missing-price scenarios.
- Role-based access testing.

Validation
- Product results: 14 cases - 11 Pass, 2 Partial, 1 Blocked, 0 Fail
- Price History results: 14 cases - 11 Pass, 2 Partial, 1 Blocked, 0 Fail
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb
- Evidence: docs/test-cases/s2-tst-02-product-price-history.md; node --test tests/s2-dev04-product-list.test.mjs (14), s2-dev05-product-mutations.test.mjs (10), s2-dev06-product-status.test.mjs (7), s2-dev07-price-history.test.mjs (11) -> all pass
- Fixtures: seeded D5P001 (historical + current), D5P002 (future only), D5P003 (no price), D5P004 (inactive) with fixed dates
- Outstanding defects: none. A GET on the write-only price-history route returns 405 by design and is recorded as an observation, not a defect.
```

### S2-TST-03 → `s2/tst-03`

**Title:** S2-TST-03: test(records): verify soft delete restore and dependency restrictions

```
Related task: S2-TST-03 (#143)

Summary
- Customer and Product soft-delete and restore coverage.
- Active child-record restrictions.
- Identity, relationship, Status, and Stamp verification.
- Inactive-record visibility and restore permissions.

Validation
- Delete and restore results: Customer 8 cases - 6 Pass, 2 Partial; Product 8 cases - 4 Pass, 2 Partial, 2 Blocked
- Dependency restriction results: handler mapping to 409 ACTIVE_DEPENDENTS proven for the exact trigger message only; the database trigger run itself is Blocked (no psql and no isolated connection string on the Tester's machine)
- Visibility: 2 cases - 2 Pass (managers see inactive rows with Status and Stamp; Users never do)
- Total: 18 cases - 12 Pass, 4 Partial, 2 Blocked, 0 Fail
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb
- Evidence: docs/test-cases/s2-tst-03-soft-delete-and-restore.md; node --test tests/s2-dev03-customer-status.test.mjs (9), s2-dev06-product-status.test.mjs (7), s2-dev07-price-history.test.mjs (11) -> all pass
- Outstanding defects: none. Ask the DB Admin to run supabase/tests/s2_dba_04_child_record_delete_rules.sql in the disposable database.
```

### S2-TST-04 → `s2/tst-04`

**Title:** S2-TST-04: test(rbac): verify customer product and price permissions

```
Related task: S2-TST-04 (#140)

Summary
- Independent testing of all nine action rights.
- Role and permission variants.
- Navigation and action-button verification.
- Direct route and API authorization checks.

Validation
- Rights tested: 9 (add_customer, edit_customer, delete_customer, add_product, edit_product, delete_product, add_price, edit_price, delete_price), each with a granted and a refused case
- Authorized request results: each handler runs only after its own right is present in the account's assigned rights
- Unauthorized request results: 401 without a session, 403 for writes, 403 for a foreign Origin, and no database adapter call on any refusal path
- Total: 31 cases - 29 Pass, 1 Partial, 1 Not Run, 0 Fail
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb
- Evidence: docs/test-cases/s2-tst-04-per-right-authorization.md; the ten relevant suites all pass
- Outstanding security items: RTS-30 needs a Superadmin whose assigned rights were deliberately cleared, to prove a role does not imply a permission (Not Run); RLS at the database boundary is the DB Admin's run
```

### S2-TST-05 → `s2/tst-05`

**Title:** S2-TST-05: test(regression): verify Sprint 1 functionality after Sprint 2

```
Related task: S2-TST-05 (#136)

Summary
- Authentication and account-management regression testing.
- Role and rights verification.
- Hosted invitation and password-reset checks.
- Automated smoke test execution.
- Regression findings and outstanding blockers.

Validation
- Test command: npm test (237 tests), npm run test:e2e (3 pass, 3 skipped), node --test tests/s1-tst-04-permission-matrix.test.mjs (8 pass)
- Regression results: 35 cases - 26 Pass, 5 Partial, 2 Blocked, 2 Not Run, 0 Fail
- Email delivery results: Blocked. No mailbox was available and no Superadmin session exists on the deployment, so real delivery to Gmail, Yahoo, or an institutional address was not observed; no mail is reported as delivered.
- Tested environment and commit: https://hope-erp-phi.vercel.app, integration commit 6f229eb
- Evidence: docs/test-cases/s2-tst-05-sprint-1-regression.md
- Remaining regressions: none observed. OBS-01 and OBS-02 are carried Sprint 1 observations, not regressions.
```

### S2-TST-06 → `s2/tst-06`

**Title:** S2-TST-06: docs(qa): publish Sprint 2 defect and fix verification report

```
Related task: S2-TST-06 (#135)

Summary
- Consolidated Sprint 2 defect register.
- Reproducible reports and supporting evidence.
- Fix verification linked to implementation PRs.
- Outstanding failures and Sprint 3 readiness assessment.

Validation
- Total cases: 134
- Passed: 105
- Failed: 0
- Partial: 19
- Blocked: 7
- Not Run: 3
- Verified fixes: 0 (no confirmed Sprint 2 defect was found to fix; Sprint 1 BUG-01 and BUG-02 closed not reproducible)
- Evidence: docs/test-cases/s2-tst-06-sprint-2-qa-report.md, plus the five task documents it consolidates
- Sprint 3 readiness: build-ready but not accepted. The authorization, validation, and soft-delete layers are in place and every automated suite is green on 6f229eb. Sprint 2 acceptance needs one test account per role, two disposable-database scripts run by the DB Admin, and one real invitation and reset to real mailboxes.
```

---

## 5. Blockers to Report to the Team

| # | Blocker | Owner | Effect |
|---|---|---|---|
| 1 | No approved Superadmin, Admin, or User test account | Scrum Master | 19 Partial and 7 Blocked cases are by-hand screen steps |
| 2 | No rights-mismatch account | DB Admin | S2-TST-04 RTS-30 cannot run |
| 3 | No authorized mailbox | Scrum Master / DB Admin | S2-TST-05 PWD-R2 and PWD-R8 stay Blocked |
| 4 | No expired or reused live token | DB Admin | S2-TST-05 PWD-R4 and PWD-R7 stay Not Run |
| 5 | No `psql` and no isolated connection string | DB Admin | S2-TST-03 trigger runs stay Blocked |
| 6 | No low-privilege database token | DB Admin | S1-TST-04 SRV-05 stays Not Run |
| 7 | GitHub credentials absent on the Tester's machine | Tester | Nothing is pushed yet; §3 has the commands |

---

## 6. What Is Deliberately Not Done

- No test was marked Pass without being executed.
- No write request was sent to the production database; all write rules were proven at the handler level.
- No self-approval, no force-push, and no direct push to the integration branch.
- Nothing in `app/`, `lib/`, or `supabase/` was changed to make a test pass. The only product-facing change is the test tooling in `s1/tst-05` (Playwright plus npm scripts).
