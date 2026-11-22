# S2-SM-04 — Sprint 2 Velocity and Burndown

**Issue:** [#142 — Update velocity and burndown](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/142)

**Snapshot:** 2026-11-22 (Asia/Manila); GitHub event times below are UTC.

This is an evidence-based, issue-count snapshot. The sprint references do not provide a calendar start date or story-point estimates, so this report does not assign calendar events to sprint days or forecast story-point velocity.

## Completed and reviewed task PRs

| Task | Issue | PR | Approved by | Merged (UTC) | Merge commit |
|---|---:|---:|---|---|---|
| S2-SM-01 | #163 | [#166](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/166) | @gabrielzantua, 2026-11-21 01:47:29 | 2026-11-21 01:48:04 | `48b68df` |
| S2-UIX-01 | #161 | [#168](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/168) | @zurielzantua, 2026-11-21 11:28:04 | 2026-11-21 11:28:12 | `ec31322` |
| S2-UIX-02 | #158 | [#169](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/169) | @zurielzantua, 2026-11-21 14:50:29 | 2026-11-21 14:50:40 | `7bcefc7` |

PR [#170](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/pull/170) merged a PNG wireframe correction for UIX-01. It did not complete another Sprint 2 issue and is not counted as additional velocity.

## Issue-count burndown

The planning board records 30 Sprint 2 issues open at its 2026-11-21 snapshot; its exact capture time is not recorded. Using issue count as the unit:

| Evidence time (UTC) | Merged task | Completed | Remaining of 30 |
|---|---|---:|---:|
| Planning snapshot, 2026-11-21 (time unavailable) | Baseline | 0 | 30 |
| 2026-11-21 01:48:04 | S2-SM-01 #163, PR #166 | 1 | 29 |
| 2026-11-21 11:28:12 | S2-UIX-01 #161, PR #168 | 2 | 28 |
| 2026-11-21 14:50:40 | S2-UIX-02 #158, PR #169 | 3 | 27 |
| 2026-11-21 15:02:38 | UIX-01 image correction, PR #170 | 3 | 27 |

Observed count-based throughput is three task PRs merged on 2026-11-21. This is too little history for a reliable completion-rate projection.

## Current task status

GitHub shows 3 of 30 issues closed and 27 open. Seven task branches are published for owner PR creation; no Sprint 2 task PR is open. The local tracker separates remaining work by state:

| State | Tasks |
|---|---|
| Merged / Done | #163, #161, #158 |
| Awaiting owner PR | #162 |
| Pushed, awaiting owner PR | #142, #150, #151, #153, #157, #159, #160 |
| Integration-validated, local only | #137, #141, #144, #147, #154 |
| Locally committed, PR not merged | #139, #146, #148, #152, #155 |
| Not started by the orchestration tracker | #134, #138, #145, #135, #136, #140, #143, #149, #156 |

The six Tester-owned issues—#156, #149, #143, #140, #136, and #135—remain open. The Tester’s actual progress is unknown; no tests are claimed as passed. Pushed branches and integration-preview results are not counted as completed Sprint 2 issues.

At this snapshot, the tracker has 3 Done, 1 Awaiting Owner PR, 7 Pushed, 5 Local Committed, 5 Integration Validated, and 9 Not Started tasks. Three of the not-started tasks are agent-managed; six belong to the human Tester.

## Risks to the day-10 review and Sprint 3 entry

- Twenty-seven issues remain open; only three have task-linked, reviewed, merged PRs.
- Seven issue branches have been published for owner PR creation; they still need owner PRs, teammate reviews, and Scrum Master merges. Other Developer and DB Admin work remains local pending database or PR-diff gates.
- Customer/Product SQL runtime checks remain unverified because no local PostgreSQL/Supabase runtime is available. Hosted migration and email verification have not been performed.
- Tester-owned execution and regression results are outstanding or unknown. Do not count these as passed.
- The sprint calendar start date and story-point estimates are unavailable, so a sprint-day burndown or point-based velocity cannot be calculated from the evidence in hand.

The Sprint 2 review is at risk until remaining task PRs are reviewed and merged, required database and hosted checks are completed by authorized owners, and the Tester’s results are recorded. The available evidence does not establish that the Sprint 3 entry gate is satisfied.
