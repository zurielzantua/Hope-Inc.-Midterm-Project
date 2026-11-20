# S1-SM-05: Sprint 1 Review and Retrospective Report

**Issue:** [#57](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/57)

**Prepared:** 2026-11-20
**Evidence baseline:** GitHub issue/PR state, integration commit `286ac83`, task plan, Vercel deployment status, and Supabase Auth URL Configuration viewed on 2026-11-20

This is an asynchronous evidence-based review prepared from project records. No live demo attendance, meeting date, or individual retrospective feedback was supplied, so this report does not invent those details.

## Sprint review

### Delivery snapshot

GitHub shows 26 of 30 Sprint 1 task issues closed. S1-SM-04 issue #31 was closed after PR #164 merged. The four still open are:

| Issue | Task | State |
|---|---|---|
| #52 | S1-TST-04 Permission matrix tests by role and right | Open |
| #53 | S1-TST-05 Automated smoke test: login and main page | Open |
| #54 | S1-TST-06 Bug reports and fix verification | Open |
| #57 | S1-SM-05 Sprint 1 review and retrospective report | Open |

The repository contains merged implementation PRs for registration, authentication, password reset, user management, Superadmin controls, rights management, and the ERP landing page. Closed issue status is recorded as delivery evidence, not as proof that every deployed flow passed acceptance testing.

PR #73 merged as commit `257257b`, adding the Seoul Function region configuration. After SM-04 PR #164 merged, Vercel reported the Production deployment for commit `286ac83` as **READY**. The Supabase Auth dashboard now shows Site URL `https://hope-erp-phi.vercel.app/` and allowlist entries for the Vercel set-password/reset-password paths plus `localhost` development paths. Production first-password setup remains disabled; SMTP/template delivery and real email-link redemption have not been verified.

### Demonstration and acceptance evidence

The task plan's demonstration path is:

1. Register and confirm Pending status.
2. Approve the user and assign rights.
3. Set the first password and sign in.
4. Open an allowed module and verify an unauthorized action is denied.
5. Block/unblock the account and verify the access change.
6. Sign out and exercise password reset.

No end-to-end demonstration record is attached to this report. The Tester issues #52-#54 remain open, and setup/reset email flows still need authorized hosted verification. The local `.env.local` app origin was `http://127.0.0.1:3000`, while the current Supabase allowlist snapshot showed `localhost` URLs; verify/add the matching `127.0.0.1` callbacks if local email-link testing is required. **Recommendation: record Sprint 1 implementation as delivered, but leave final acceptance pending those tests and email checks.**

## Retrospective

The following observations are based on repository and issue evidence, not attributed team-member feedback.

### What went well

- The Sprint 1 board separates work by role and records task dependencies.
- Core implementation tasks were tracked through issue-linked PRs and merged into the integration branch.
- The Vercel deployment is now attached to the Seoul region configuration, close to the Supabase project region.

### What needs improvement

- Production Auth redirects were configured after the implementation PRs; SMTP/template delivery and actual link redemption still need hosted tests.
- Tester coverage for the role/right matrix, login smoke path, and bug retests remains open at Sprint review.
- The working agreement document still says “Proposed - Pending Team Review” even though SM-03 issue #18 is closed; the team should confirm its approval status.

## Carryover actions

| Action | Owner | Evidence required |
|---|---|---|
| Verify SMTP/template delivery and real first-password/reset-link redemption on Vercel; test supported external email domains as tracked by #159. Add matching `127.0.0.1` callbacks if local email-link testing is required. | Authorized Supabase project administrator and Tester; Scrum Master coordinates | Received email, correct Vercel callback, successful authorized setup/reset, and expected behavior on each tested domain. Keep first-password setup disabled until this passes. |
| Execute the role/right permission matrix. | Tester, @laurencechua; issue #52 | Results for each role/right, including denied direct requests. |
| Run the login/main-page smoke test on a recorded deployment. | Tester, @laurencechua; issue #53 | Commit/deployment ID, test account role/state, and pass/fail result. |
| Record discovered bugs and verify fixes. | Tester, @laurencechua; issue #54 | Linked bug, fix reference, and retest result. |
| Verify that the team reviewed and adopted the working agreement. | Scrum Master, @zurielzantua | Updated status only after actual team review. |
| Carry unresolved invitation, reset, and external-email-domain checks into Sprint 2. | Scrum Master coordinates; owners to be confirmed | Continue in [S2-SM-02 #159](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/159) until hosted tests pass. |

## Completion note

This report documents the evidence available on 2026-11-20. Add the actual review date, attendees, and any team feedback if a live review/retrospective is required by the instructor. Do not mark the remaining verification tasks complete until their results are recorded.
