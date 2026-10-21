# HOPE ERP Sprint 1 Test Plan and Acceptance Criteria

Task: S1-TST-01. Owner: Tester. Status: draft. No case in this plan has been run yet.

## 1. Purpose and scope

This plan defines how Sprint 1 account and access behavior is tested and what must be true for the sprint to be accepted. Detailed cases live in separate files so each task can be reviewed on its own.

In scope for Sprint 1:

- Registration, login/logout and sessions, first-password setup, password recovery
- User Management, approval, Admin designation, last-Superadmin protection
- Per-action rights (36 rights across 5 modules) and their enforcement
- The permission-aware main page
- Audit records that identify the logged-in actor
- Reproducible database setup with no keys or passwords committed

Out of scope: Customer, Product, Human Resources, Sales and Reports CRUD screens. Those belong to later sprints. Sprint 1 tests only that access to them is granted or denied correctly.

## 2. Assumptions and open decisions

Expected results assume the Sprint 1 plan. If the team decides otherwise, update the affected cases before running them.

- Public signup creates an ordinary User in a pending state. There is no public role selector, and a caller cannot choose their own role or approval state.
- Team Superadmins are provisioned deliberately and set their first password through a one-time link.
- Pending and blocked accounts cannot enter the protected application.

Open decisions the Scrum Master records in SM-03:

1. Signup role policy. The repository README currently says new signups get the superadmin role in development, which conflicts with the assumption above.
2. How initial password setup and recovery tokens map to Supabase.

## 3. Acceptance criteria

Sprint 1 is accepted when each item below has a passed case with a recorded actual result.

| Area | Acceptance criterion | Case file |
| --- | --- | --- |
| Registration | A new registration creates one linked profile in a pending state. Role and approval cannot be set by the caller. Invalid and duplicate input is handled safely. | test-cases-auth.md |
| Login and sessions | Approved users sign in and out. Sessions survive refresh. Signed-out access to protected pages fails. | test-cases-auth.md |
| Pending and blocked | Pending and blocked users cannot gain protected access, including a user blocked while signed in. | test-cases-auth.md |
| Password setup and recovery | First-password setup works. Reset replaces the password. Invalid, expired and reused links are rejected. | Planned |
| User Management | Admin sees and manages Users only. Superadmin accounts are hidden from Admins. Direct requests follow the same rules. | Planned |
| Approval and Admin designation | Superadmin approves pending users and designates Admins. The last active Superadmin cannot be removed, demoted or blocked. | Planned |
| Rights | All 36 rights are stored and enforced at the server or database boundary. Save persists, Cancel does not, unauthorized updates fail. | Planned |
| Main page | Menus and tiles match stored rights. A user with no rights sees an honest empty state. Direct URL requests follow the same rules. | Planned |
| Audit | Audit events record the authenticated actor and old/new values, not a generic database login. | Planned |
| Setup | Migrations rebuild in a disposable database. No keys or passwords are committed. | Planned |

A hidden button never counts as denial. Each access rule is tested through the interface and through a direct request.

## 4. Test approach

- **Manual functional testing:** each case is run by hand against a recorded commit and environment.
- **Direct-request testing:** protected URLs and actions are called without the interface, with tampered fields and with the wrong role.
- **Automated smoke test (S1-TST-05):** one runnable login-to-main-page check plus signed-out denial, added once the real login and main page exist.
- **Fixtures:** approved, pending and blocked Users, an Admin and a Superadmin, supplied by the DB Admin. No real passwords in the repository.

## 5. Planned case files

| Area | Case ID prefix | Task | Depends on | Status |
| --- | --- | --- | --- | --- |
| Registration | REG | S1-TST-02 | DEV-02 | Drafted in test-cases-auth.md |
| Login and logout | LOG | S1-TST-02 | DEV-03 | Drafted in test-cases-auth.md |
| Set and reset password | PWD | S1-TST-02 | DEV-03, DEV-04 | To draft |
| User Management and approval | UM | S1-TST-03 | DEV-05, DEV-06 | To draft |
| Rights, all 36 | RT | S1-TST-04 | DEV-07 | To draft |
| Main page | MP | S1-TST-04 | DEV-08 | To draft |
| Smoke test | SMK | S1-TST-05 | DEV-03, DEV-08 | After targets exist |

The 36 rights are grouped as Customer 3, Product 6, Human Resources 13, Sales 7 and Reports 7.

## 6. Entry and exit criteria

A case may be run when:

- Its feature is implemented on a known commit
- The fixtures it needs exist
- Local setup works: dependencies installed from the lockfile and the ignored `.env.local` configured

Testing for the sprint is complete when:

- Every case in the acceptance table has an actual result
- Failed cases have a linked bug and, once fixed, a retest result
- Any case that could not run is listed as carryover with the reason
- Results are summarized for the sprint review (SM-05)

## 7. Environment

Before running any case, record the commit SHA, branch, date, browser and the Supabase project used. Setup follows the repository README: Node.js 20.9 or newer, `npm ci`, then `.env.local` copied from `.env.local.example`. Never commit keys or passwords. Use invented addresses such as alex@example.test.

A local installation failure is not a database failure. Record which one you saw.

## 8. Reporting bugs

Every bug report (S1-TST-06) needs:

- The case ID and the commit or environment it ran on
- Steps to reproduce
- Expected versus actual behavior
- Evidence with private values redacted
- A link to the fix and the retest result

A written case is not a passing test. A case that has not run stays blank.
