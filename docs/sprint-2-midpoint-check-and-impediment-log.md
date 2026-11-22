# HOPE Inc. ERP — Sprint 2 Midpoint Check and Impediment Log

**Snapshot date:** 2026-11-22

**Record type:** Asynchronous evidence snapshot prepared for Scrum Master review; this is not meeting minutes.

No meeting, attendance, team feedback, test execution, or retrospective event is claimed here. Sprint-day targets in the planning board are relative; an authoritative sprint start date was not available, so calendar schedule slippage cannot be calculated.

## Status summary

- Live GitHub shows **30 Sprint 2 issues: 3 closed and 27 open**.
- Three task issues have merged implementation PRs. A fourth merged PR is a UIX-01 asset correction. The merged code is not evidence of hosted Supabase, RLS, or email verification.
- Latest tracker snapshot: 3 DONE, 7 PUSHED, 5 LOCAL_COMMITTED, 5 INTEGRATION_VALIDATED, 1 AWAITING_OWNER_PR, and 9 NOT_STARTED across all 30 tasks. The three not-started agent-managed tasks are blocked by the Figma Starter limit (#145), missing interactive usability evidence (#138), and pending merged PR/Tester results (#134). The six Tester issues are publicly open; Tester progress is unknown and is not inferred from issue state.
- No Sprint 2 task PR is currently open in the live PR listing.
- Application code in the local integration preview at `3d795680` passed 236 Node tests, the production build, and `git diff --check`; the later preview changes are this report-only status update. PostgreSQL query-plan, current-price RPC, and child-delete concurrency runtime checks remain pending.
- The current `s2/sm-03` worktree started clean at integration base `4cf794516df7a59178ff75fc6cffb3972f77862c`. This report is its sole task-specific file change; its owner PR is not yet open.

## Issue and PR register

Issue states and PR states below were queried read-only from GitHub on the snapshot date. “No task PR observed” means no matching task-delivery PR appeared in the live pull-request list. Tracker progress is shown separately from the public issue state.

| Issue | Task | Owner | GitHub state | Work / PR evidence and next action |
|---|---|---|---|---|
| [#134](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/134) | S2-SM-05 | `zurielzantua` | Open | Not started; awaits merged task PRs, Tester #136/#135 results, and UIX-05 findings. |
| [#135](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/135) | S2-TST-06 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Tester owns bug reports and fix verification. |
| [#136](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/136) | S2-TST-05 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Tester owns Sprint 1 regression evidence. |
| [#137](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/137) | S2-DEV-08 | `gabrielzantua` | Open | Locally committed `99f67b2` and integration-validated; current-price RPC runtime, N-per-product RPC performance, and isolated PR base remain pending. |
| [#138](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/138) | S2-UIX-05 | `ElishLim` | Open | Not started; awaits UIX-04 states and interactive screen screenshots. Do not report mockup review as implementation review. |
| [#139](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/139) | S2-DBA-06 | `marcoasegurado` | Open | Local commit `c8b5083` adds read-only EXPLAIN queries; representative PostgreSQL plans and index/no-change finding are pending. |
| [#140](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/140) | S2-TST-04 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Final permission checks depend on the completed per-action implementation. |
| [#141](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/141) | S2-DEV-07 | `gabrielzantua` | Open | Locally committed `57c84eb` and integration-validated; PostgreSQL current-price runtime and isolated PR base remain pending. |
| [#142](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/142) | S2-SM-04 | `zurielzantua` | Open | Pushed on `s2/sm-04` at `db97a70`; owner PR should target `s2/sm-03` for an isolated diff. |
| [#143](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/143) | S2-TST-03 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Tester owns delete/restore test evidence. |
| [#144](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/144) | S2-DEV-06 | `gabrielzantua` | Open | Locally committed `093c963` and integration-validated; DB trigger runtime and task-only PR reconstruction remain pending. |
| [#145](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/145) | S2-UIX-04 | `ElishLim` | Open | Not started; Figma Starter tool-call limit prevented required empty/error/delete-confirmation states. |
| [#146](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/146) | S2-DBA-05 | `marcoasegurado` | Open | Local commit `32b12c4`; static fixture checks passed; SQL runtime and task-only PR reconstruction remain pending. |
| [#147](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/147) | S2-DEV-05 | `gabrielzantua` | Open | Locally committed `56b5c48` and integration-validated; composite base requires task-only PR reconstruction after prerequisites integrate. |
| [#148](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/148) | S2-DBA-04 | `marcoasegurado` | Open | Local commit `193d4fb`; static checks passed; PostgreSQL/concurrency runtime and task-only PR base remain pending. |
| [#149](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/149) | S2-TST-02 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Tester owns product and price-history cases and execution evidence. |
| [#150](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/150) | S2-DEV-04 | `gabrielzantua` | Open | Pushed on `s2/dev-04` at `c1f431b`; owner PR is not yet open. Its task diff is isolated against integration. |
| [#151](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/151) | S2-UIX-03 | `ElishLim` | Open | Canonical 12-PNG mockup/handoff set is pushed on `s2/uix-03`; UIX owner approval and PR remain pending. |
| [#152](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/152) | S2-DBA-03 | `marcoasegurado` | Open | Local commit `2f198be`; static preflight checks passed; SQL runtime and hosted legacy-data compatibility remain pending. |
| [#153](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/153) | S2-SM-03 | `zurielzantua` | Open | Pushed on `s2/sm-03`; owner PR is not yet open. |
| [#154](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/154) | S2-DEV-03 | `gabrielzantua` | Open | Locally committed `e1003dc` and integration-validated; Customer restore-right contract remains an owner decision. |
| [#155](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/155) | S2-DBA-02 | `marcoasegurado` | Open | Local commit `0f09f88`; static review passed; SQL RPC runtime remains pending. |
| [#156](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/156) | S2-TST-01 | `laurencechua` | Open | Human Tester issue; no task PR observed; progress unknown. Tester owns Customer cases and execution evidence. |
| [#157](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/157) | S2-DEV-02 | `gabrielzantua` | Open | Pushed on `s2/dev-02` at `30ebc4e`; owner PR should target `s2/dev-01`; hosted write persistence remains unverified. |
| [#158](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/158) | S2-UIX-02 | `ElishLim` | Closed | Delivered by [PR #169](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/169), merged. Product and Price History wireframes are integrated. |
| [#159](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/159) | S2-SM-02 | `zurielzantua` | Open | Pushed on `s2/sm-02`; owner PR is not yet open. |
| [#160](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/160) | S2-DEV-01 | `gabrielzantua` | Open | Pushed on `s2/dev-01` at `479a3b3`; task tests and current 236-test integration suite/build pass; diff is isolated against integration. |
| [#161](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/161) | S2-UIX-01 | `ElishLim` | Closed | Delivered by [PR #168](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/168), then PNG preview correction [PR #170](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/170); both merged. |
| [#162](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/162) | S2-DBA-01 | `marcoasegurado` | Open | Existing work is on `db-admin`, commit `3aeb9db`, also present on `origin/db-admin`; task PR is still pending. [PR #167](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/167) merged integration into `db-admin` and does not deliver this task. Owner next action: review and submit the existing task diff without duplicating it. |
| [#163](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/163) | S2-SM-01 | `zurielzantua` | Closed | Delivered by [PR #166](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/166), merged. |

## Impediments, decisions, and handoffs

### Database work and constraints

- **Active views and indexes:** DB Admin `marcoasegurado` owns commit `3aeb9db` on `db-admin`; it adds two partial indexes, a regression test, and README guidance. Customer/Product active views and invoker RLS already exist in the Sprint 1 integration base. The separate merged branch-synchronization PR is not the DBA-01 task PR. Owner review and submission of the existing task diff remain pending; the indexes are a final combined performance-verification dependency, not a coding blocker for DEV-01/04.
- **Field constraints:** DB Admin `marcoasegurado` and Developer `gabrielzantua` need to confirm the payment-term and unit literals used by both database constraints and forms. Do not resolve this by guessing values in either layer.
- **Child-record deletion:** DB Admin `marcoasegurado` and Developer `gabrielzantua` need to agree on when customer/product deletion is rejected and what error the UI receives. The board records an unresolved sequence; settle the contract before dependent delete work is finalized.
- **Hosted database:** Migration deployment and hosted verification remain **pending/unverified**. The latest recorded environment check in the implementation map could not verify hosted migration history or run local Supabase/PostgreSQL tests. The map identifies `20261105033601_dev06_require_completed_superadmin_actor.sql`, `20261105040425_dev07_user_permission_management.sql`, and `20261113000001_hope_first_password_onboarding_fix.sql` as not confirmed deployed; the current Sprint 2 migration has likewise not been verified against hosted Supabase. DB Admin coordinates the migration handoff; an authorized Supabase project administrator must confirm deployment. No migration was applied for this report.

### UI/UX handoffs

- The Customer and Product/Price History wireframe tasks are merged, but the high-fidelity mockup/handoff task remains open. UI/UX owner `ElishLim` should publish the handoff before dependent screen implementation is treated as design-verified.
- Empty, error, and delete-confirmation states require coordination with the eventual Developer screens. UIX-05 is a review of built screens, not evidence that planned screens already passed usability review.
- The board uses sprint-relative day targets and no verified start date. The outstanding handoff is observable; whether it is late on the calendar is unknown.

### Tester follow-up

All six Tester-owned issues are publicly open and assigned to `laurencechua`; public issue state does not reveal whether private testing has started. The Tester remains responsible for their cases, reports, and results. Coordinate when the corresponding screens and isolated test environment are available; no Tester deliverable or test result is created or claimed in this report. Final per-right verification depends on the completed application permissions flow.

### Sprint 1 hosted-auth carryover

Invitation, first-password, password-reset email delivery, and external-email behavior remain pending hosted verification in the latest recorded implementation map. The presence of merged code, configured-looking SMTP fields, or a successful deployment is not proof of delivered email or successful hosted redemption. The authorized Supabase administrator must confirm migrations, SMTP/template/redirect configuration, and an isolated end-to-end test; the responsible administrator identity was not established by the cited project records.

## Decisions recorded

1. GitHub issue state is reported from the live issue API; local commits and branch work are reported separately.
2. A merged PR counts as task delivery only when its actual change is linked to that task. The branch-sync PR is explicitly not counted as delivery of the existing DB Admin task.
3. Merged integration work is not labeled hosted-verified. Database, RLS, and email acceptance remain pending until exercised against an authorized hosted or isolated environment.
4. The six Tester issues remain human-owned. Their open state is not treated as proof that work has not started, and missing results are not treated as passes.
5. This is an asynchronous status snapshot; no unrecorded midpoint meeting, decisions, feedback, velocity, or burndown values are asserted.

## Evidence and limits

- GitHub issues and pull requests queried read-only on 2026-11-22; issue assignees/states and merged PRs above reflect those responses.
- Tracker inspected read-only at `/home/pinggu0x/Desktop/Orca/orchestration/state.sqlite3`; it preserves task state and branch/PR observations. SM-02, SM-03, and UIX-03 commits remain on their local task branches and do not appear on remote task branches.
- Planning/dependency context comes from `docs/sprint-2-planning-notes-and-board.md` and `/home/pinggu0x/Desktop/Orca/orchestration/sprint2-implementation-map.md`.
- No hosted Supabase query, email send, SQL runtime test, or Tester test was performed for this update. DEV-01's Node suite/build results are recorded in its issue row and remain internal engineering validation, not Tester acceptance.
