# S1-SM-04: Sprint 1 Mid-Sprint Check Notes and Impediment Log

**Issue:** [#31](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/31)

**Prepared:** 2026-11-20
**Record type:** Evidence-based asynchronous status snapshot

This file records the latest verifiable project state. No contemporaneous day-5 meeting notes, attendee list, or team statements were found, so this is not presented as minutes of a meeting that was not recorded.

## Progress check

GitHub shows **25 of 30 Sprint 1 task issues closed**. The five open issues are:

| Issue | Task | Current board state |
|---|---|---|
| #31 | S1-SM-04 Mid-sprint check notes and impediment log | Open |
| #52 | S1-TST-04 Permission matrix tests by role and right | Open |
| #53 | S1-TST-05 Automated smoke test: login and main page | Open |
| #54 | S1-TST-06 Bug reports and fix verification | Open |
| #57 | S1-SM-05 Sprint 1 review and retrospective report | Open |

Issue closure records delivery status; it does not by itself prove hosted behavior or acceptance testing passed.

The foundational Scrum Master issues are closed: SM-01 #13 / PR #14, SM-02 #20 / PR #22, and SM-03 #18 / PR #19. The current `docs/team-working-agreement.md` still labels itself “Proposed - Pending Team Review”; team approval should be confirmed before calling that agreement final.

PR #73 merged as commit `257257b` on `setup/initial-project-structure`. Vercel reports the production deployment for that commit as **READY**. This verifies deployment status only; it does not verify invitation or password-reset email flows.

## Impediment log

| ID | Impediment / evidence | Impact | Owner | Next action | State |
|---|---|---|---|---|---|
| I-01 | Supabase Auth Site URL and allowed redirect URLs for the Vercel host are not verified. Vercel Production has `HOPE_APP_URL=https://hope-erp-phi.vercel.app`; first-password setup remains disabled. | Setup and reset email redirects cannot yet be accepted as working on Vercel. | Supabase project administrator (confirm assigned member); Scrum Master coordinates. | Set the Vercel Site URL, allow `https://hope-erp-phi.vercel.app/set-password` and `https://hope-erp-phi.vercel.app/reset-password`, preserve local development URLs, then verify SMTP/template delivery with an authorized test account. | Open |
| I-02 | S1-TST-04, S1-TST-05, and S1-TST-06 remain open as issues #52-#54. | The role/right matrix, login/main-page smoke path, and bug-fix retests are not recorded as complete. | Tester, @laurencechua | Run the cases against a named deployment and test accounts; record expected and observed outcomes and link defects. | Open |
| I-03 | SM-03 issue #18 is closed, but the working agreement still says “Proposed - Pending Team Review.” | The repository does not show that the team adopted the agreement. | Scrum Master, @zurielzantua | Confirm the team reviewed it and update the document status only after that review. | Needs confirmation |

## Check outcome

The remaining Sprint 1 verification and email-configuration work stays visible as open. Do not mark the email flows or permission matrix as accepted based only on merged implementation PRs.
