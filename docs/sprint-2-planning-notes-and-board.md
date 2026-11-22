# HOPE Inc. ERP — Sprint 2 Planning Notes and Board

**Scrum Master task:** S2-SM-01
**GitHub issue:** [#163 — Sprint 2 planning notes and board](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/163)
**Prepared:** 2026-11-21
**Planning basis:** Sprint 2 issue descriptions and the revised task plan, checked against GitHub on the preparation date. Days are sprint-relative; calendar dates were not supplied.

This is an asynchronous evidence-based planning record, not minutes of a meeting. No live review attendance or individual feedback was provided.

## Sprint objective and scope

Deliver the Sprint 2 Customer and Product workflows: permission-checked lists and forms, soft delete and restore, effective-dated price history and current-price display, required database support and demo data, UI handoffs, and role/right verification. Track Sprint 1 authentication, invitation/reset email, permissions, and hosted-verification gaps separately until the required checks pass.

Sprint 2 covers Customers and Products only. Do not count Human Resources, Sales, Reports, Sprint 3, or Sprint 4 work as Sprint 2 delivery.

## Team and PR operating rules

- Scrum Master: @zurielzantua
- Developer: @gabrielzantua
- DB Admin: @marcoasegurado
- UI/UX Designer: @ElishLim
- Tester: @laurencechua

For Sprint 2 execution, use one existing issue-specific `s2/<role>-<nn>` branch and isolated worktree per task. Keep one issue per branch and PR; a dependent branch may be stacked on its required predecessor so its PR diff stays task-specific. The assigned issue owner opens the PR, a different teammate reviews it, and the Scrum Master merges it to `setup/initial-project-structure` after required checks. Never push the local `test/sprint2-integration` branch or push directly to the integration branch.

The repository’s working agreement still says “Proposed - Pending Team Review,” so the workflow above is recorded as the current operating direction. Do not describe it as formally adopted until the team confirms it. The currently enforced approval count and required status checks have not been independently confirmed.

### Issue-to-PR tracking

Keep one row per task below. Fill in PR URL, review status, merge commit, and acceptance evidence only when each event is observed. At this planning snapshot, all 30 Sprint 2 issues are open and no Sprint 2 PR is open or identified. A merged implementation PR alone is not hosted acceptance evidence.

## Sprint 2 task board

Dependency labels:

- **HARD:** the listed output must exist before dependent implementation begins.
- **COORDINATION:** owners agree on a shared contract or handoff; this alone does not mean all work must wait.
- **VERIFICATION:** preparation may start early, but final execution needs the referenced feature/fix.
- If issue wording combines prerequisites and coordination without separating them, the distinction is marked for owner confirmation.

| Day | Issue and task | Role / owner | Prerequisites and coordination | PR tracking |
|---:|---|---|---|---|
| 1 | [#163 S2-SM-01 — Sprint 2 planning notes and board](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/163) | Scrum Master / @zurielzantua | S1-SM-05 (#57, closed); Sprint 1 carryover register. **HARD** | Not opened |
| 2 | [#161 S2-UIX-01 — Wireframes: customer screens](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/161) | UI/UX / @ElishLim | S1-UIX-04 (#55, closed); Student Guide §3.3. **HARD** | Not opened |
| 2 | [#162 S2-DBA-01 — Customer and product active views, indexes](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/162) | DB Admin / @marcoasegurado | Sprint 1 database schema; S2-SM-01. **HARD** | Not opened |
| 2 | [#160 S2-DEV-01 — Customer list with search and filter (permission-checked)](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/160) | Developer / @gabrielzantua | S1-DEV-07; S1-DEV-08; S2-UIX-01; S2-DBA-01. **HARD** | Not opened |
| 3 | [#158 S2-UIX-02 — Wireframes: product and price history screens](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/158) | UI/UX / @ElishLim | S1-UIX-04 (#55, closed); Student Guide §3.4. **HARD** | Not opened |
| 3 | [#157 S2-DEV-02 — Customer create and edit form](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/157) | Developer / @gabrielzantua | S2-DEV-01; S2-UIX-01. **HARD** | Not opened |
| 3 | [#156 S2-TST-01 — Test cases: customer module](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/156) | Tester / @laurencechua | Prepare cases after S2-UIX-01; S2-DEV-01; execute CRUD scenarios after S2-DEV-02; S2-DEV-03. **HARD for case design; VERIFICATION for execution** | Not opened |
| 3 | [#159 S2-SM-02 — Follow up Sprint 1 retro actions](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/159) | Scrum Master / @zurielzantua | S2-SM-01; S1-SM-05 (#57, closed). **HARD** | Local commits are on `s2/sm-02`; unpushed pending final validation and owner review; no PR |
| 4 | [#155 S2-DBA-02 — Query: current price as of a given date](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/155) | DB Admin / @marcoasegurado | Sprint 1 PRICEHIST schema; S2-DBA-01. **HARD** | Not opened |
| 4 | [#154 S2-DEV-03 — Customer soft delete and restore](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/154) | Developer / @gabrielzantua | S2-DEV-02. Coordinate the child-record rule/error contract with S2-DBA-04 before final integration. **HARD + COORDINATION** | Not opened |
| 5 | [#153 S2-SM-03 — Mid-sprint check and impediment log](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/153) | Scrum Master / @zurielzantua | S2-SM-01; current Sprint 2 task/PR status. **HARD** | Not opened |
| 5 | [#152 S2-DBA-03 — Validation constraints (payTerms, unit)](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/152) | DB Admin / @marcoasegurado | Sprint 1 Customer/Product schema. Coordinate field names/constraints with S2-DEV-02 and S2-DEV-05; do not turn this integration note into a circular hard dependency. **HARD schema; COORDINATION with Developer** | Not opened |
| 5 | [#151 S2-UIX-03 — Hi-fi mockups and handoff notes](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/151) | UI/UX / @ElishLim | S2-UIX-01; S2-UIX-02. **HARD** | Not opened |
| 5 | [#150 S2-DEV-04 — Product list with search and filter](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/150) | Developer / @gabrielzantua | S2-UIX-02; S2-DBA-01; S1-DEV-07. **HARD** | Not opened |
| 5 | [#149 S2-TST-02 — Test cases: product and price history](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/149) | Tester / @laurencechua | Prepare cases after S2-UIX-02; S2-DBA-02; execute CRUD after S2-DEV-05; S2-DEV-07; S2-DEV-08. **HARD for preparation; VERIFICATION for execution** | Not opened |
| 6 | [#148 S2-DBA-04 — Verify child-record delete checks for customer and product](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/148) | DB Admin / @marcoasegurado | Customer/Product schema and S2-DEV-03; integrate with S2-DEV-06. Confirm the DEV-03/DBA-04 sequence and agree on the contract early. **HARD/COORDINATION requires owner confirmation** | Not opened |
| 6 | [#147 S2-DEV-05 — Product create and edit form](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/147) | Developer / @gabrielzantua | S2-DEV-04; S2-UIX-02; S2-DBA-03. **HARD** | Not opened |
| 7 | [#146 S2-DBA-05 — Demo data for customer, product, price history](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/146) | DB Admin / @marcoasegurado | S2-DBA-01; S2-DBA-02; S2-DBA-03. **HARD** | Not opened |
| 7 | [#145 S2-UIX-04 — Empty, error and confirm-delete states](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/145) | UI/UX / @ElishLim | S2-UIX-03; S2-DEV-02; S2-DEV-03; S2-DEV-05; S2-DEV-06. **HARD handoff** | Not opened |
| 7 | [#144 S2-DEV-06 — Product soft delete and restore](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/144) | Developer / @gabrielzantua | S2-DEV-05; S2-DBA-04 child-record rules. **HARD** | Not opened |
| 7 | [#143 S2-TST-03 — Soft delete/restore tests, incl. delete blocked by active children](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/143) | Tester / @laurencechua | S2-DEV-03; S2-DEV-06; S2-DBA-04. **VERIFICATION** | Not opened |
| 8 | [#142 S2-SM-04 — Update velocity and burndown](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/142) | Scrum Master / @zurielzantua | S2-SM-03; dated task/PR completion evidence. **HARD** | Not opened |
| 8 | [#141 S2-DEV-07 — Price history](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/141) | Developer / @gabrielzantua | S2-DEV-05; S2-DBA-02; S2-UIX-02. **HARD** | Not opened |
| 8 | [#140 S2-TST-04 — Per-right permission tests for customer and product](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/140) | Tester / @laurencechua | S1-DEV-07; S2-DEV-02; S2-DEV-03; S2-DEV-05; S2-DEV-06; S2-DEV-07. Prepare matrix by day 8, final execution after S2-DEV-08 (day 9). **VERIFICATION; schedule mismatch to track** | Not opened |
| 9 | [#139 S2-DBA-06 — Search performance check and index tuning](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/139) | DB Admin / @marcoasegurado | S2-DBA-01; S2-DBA-02; S2-DBA-05; S2-DEV-01; S2-DEV-04. **HARD inputs; performance verification** | Not opened |
| 9 | [#138 S2-UIX-05 — Usability review of built screens](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/138) | UI/UX / @ElishLim | S2-DEV-01; S2-DEV-02; S2-DEV-03; S2-DEV-04; S2-DEV-05; S2-DEV-06; S2-DEV-07; S2-DEV-08; S2-UIX-03; S2-UIX-04. **VERIFICATION** | Not opened |
| 9 | [#137 S2-DEV-08 — Current-price display and per-action rights checks](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/137) | Developer / @gabrielzantua | S2-DEV-02; S2-DEV-03; S2-DEV-04; S2-DEV-05; S2-DEV-06; S2-DEV-07; S2-DBA-02; S1-DEV-07. **HARD** | Not opened |
| 9 | [#136 S2-TST-05 — Regression test of Sprint 1](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/136) | Tester / @laurencechua | Sprint 1 merged implementation and carryover fixes; hosted email/setup/reset checks where permitted. **VERIFICATION** | Not opened |
| 9 | [#135 S2-TST-06 — Bug reports and fix verification](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/135) | Tester / @laurencechua | S2-TST-01; S2-TST-02; S2-TST-03; S2-TST-04; S2-TST-05 and available fixes. **VERIFICATION** | Not opened |
| 10 | [#134 S2-SM-05 — Sprint 2 review and retrospective report](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/134) | Scrum Master / @zurielzantua | S2-SM-04; S2-TST-05; S2-TST-06; S2-UIX-05; completed Sprint 2 PRs. **HARD** | Not opened |

## Dependency decisions and sequencing

- First candidate wave after role-branch readiness: S2-SM-01 #163 and S2-UIX-01 #161 can proceed on separate role branches; S2-DBA-01 #162 follows S2-SM-01; S2-DEV-01 #160 follows UIX-01 and DBA-01.
- Keep DBA-03/DEV-05 and DEV-03/DBA-04 as coordination contracts where the issue wording says integration/coordination. DB Admin and Developer should agree on field names, constraints, child-record rules, and error behavior early.
- DBA-04 lists DEV-03 as a prerequisite while DEV-03 calls DBA-04 a coordination dependency. Confirm the exact sequence with both owners before that work begins.
- TST-01/02 may prepare test cases before CRUD exists; CRUD execution waits for the listed implementation.
- TST-04 preparation is day 8, but its issue requires final execution after DEV-08 on day 9. Do not mark final permission verification complete on day 8.
- Same-role tasks are serial on each permanent branch. Do not dispatch another issue to a role while prior work is uncommitted, awaiting authorized push/PR, under review, changes requested, or awaiting verification.

## Sprint 1 carryover and operational impediments

### Tester carryover

Live GitHub issue status checked while preparing this board:

| Issue | Task | Current state | Owner |
|---|---|---|---|
| [#52](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/52) | S1-TST-04 permission matrix tests | Open | @laurencechua |
| [#53](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/53) | S1-TST-05 login/main-page smoke test | Open | @laurencechua |
| [#54](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/54) | S1-TST-06 bug reports and fix verification | Open | @laurencechua |
| [#57](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/57) | S1-SM-05 review/retrospective | Closed | @zurielzantua |

The Sprint 1 retrospective file has a stale table that still lists #57 as open. GitHub is current for issue status; this board records the live state without editing the Sprint 1 report.

### Authentication, email, and database carryover

The latest verified hosted snapshot available for this planning pass (2026-11-21) reported:

- First-password setup remained disabled in production.
- Custom SMTP fields were populated, but email delivery, invitation redemption, password reset, and external email-domain behavior were not end-to-end verified.
- Three migrations present in integration were not shown as applied to hosted Supabase: 20261105033601_dev06_require_completed_superadmin_actor.sql, 20261105040425_dev07_user_permission_management.sql, and 20261113000001_hope_first_password_onboarding_fix.sql.
- Vercel reported a ready deployment; that is not proof of Supabase/RLS or email acceptance.

Tester @laurencechua records actual email and permission test results. Scrum Master coordinates carryover through S2-SM-02 #159. The authorized Supabase project administrator must verify/deploy required migrations and email configuration; the individual administrator was not confirmed in available records. DB Admin @marcoasegurado coordinates database work. Do not mark flows passed based on merged PRs or an API 202 response.

### S2-SM-02 carryover status (checked 2026-11-22)

This status update records merged implementation separately from hosted acceptance. No hosted Supabase changes or live email tests were performed for this update.

| Carryover | Owner and references | Verified outcome | Open blocker |
|---|---|---|---|
| First-password setup and invitation links | Developer @gabrielzantua; [S1-DEV-03 #42](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/42), [PR #43](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/43), [PR #68](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/68), [PR #72](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/72). Hosted verification: authorized Supabase administrator and Tester @laurencechua. | Callback handling and atomic password completion fixes are merged. PR #72 reports 165 tests and a production build passing. | PR #72 explicitly reports no live Supabase setup or invitation-email test. The last hosted snapshot above (2026-11-21) recorded first-password setup disabled. Keep setup acceptance pending authorized hosted verification. |
| Password reset | Developer @gabrielzantua; [S1-DEV-04 #44](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/44), [PR #46](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/46), [PR #66](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/66), [PR #68](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/68). Hosted verification: authorized Supabase administrator and Tester @laurencechua. | Reset flow, external-recipient handling, and hosted callback support are merged. | Hosted reset-email delivery and link redemption remain unverified in the recorded evidence. Confirm SMTP/template and redirect settings, then record Tester results. |
| External email domains and delivery | Developer @gabrielzantua; [PR #66](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/66). SMTP configuration owner: authorized Supabase project administrator (identity unconfirmed). Verification: Tester @laurencechua. | PR #66 adds handling for Yahoo and institutional addresses and documents Supabase's external-recipient SMTP restriction. | Custom SMTP delivery to external domains has not been verified. The administrator must confirm provider, template, and allowed callbacks; the Tester records results for authorized test addresses. |
| Login, roles, and per-action permissions | Developer @gabrielzantua; [S1-DEV-06 #47 / PR #58](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/58), [S1-DEV-07 #48 / PR #60](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/60), [S1-DEV-08 #49 / PR #61](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/61). Tester @laurencechua: [S1-TST-04 #52](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/52), [S1-TST-05 #53](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/53), [S1-TST-06 #54](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/54). | Role approval, Rights Management, and permission-based navigation code are merged. | The three Tester issues remain open. The last hosted snapshot above did not confirm the related RLS migrations as applied. Record role/right and direct-request results only after authorized hosted verification. |

**Sprint 2 dependency decision:** the merged Sprint 1 auth and permission code remains available for local implementation; available evidence does not establish a new hard coding prerequisite. Hosted email, RLS, and role/right checks remain verification gates. Do not mark them passed from merged PRs or local tests alone. The six S2-TST issues remain exclusively Tester-owned.

### Current execution gates

At the last verified checkout, the Scrum Master local branch was fast-forwarded to integration commit 4e7c6cdd; the remote scrum-master branch remained at ff72e7f. UI/UX was also fast-forwarded locally; its remote role branch remains behind. No synchronization push was made.

GitHub identity remains inconsistent: gh auth status reports pinggu0x, while the authenticated GitHub API user endpoint returned gabrielzantua. Do not commit or push until the effective Git push identity and permission are confirmed.

The supervised Codex launch failed before the agent session started: the first attempt produced a shell parse error, and a second supported Orca launch reported that the dangerous approvals/sandbox bypass flag was passed more than once. The failed dispatch was stopped and released. No project files were changed by that worker. Do not alter Orca permission settings or switch to another provider/auth path to evade this launch failure.
