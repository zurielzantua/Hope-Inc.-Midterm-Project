# S2-SM-04 — Sprint 2 Velocity and Burndown

**Issue:** [#142 — Update velocity and burndown](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/142)

**Snapshot:** 2026-11-23 (Asia/Manila); GitHub event times below are UTC.

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
| 2026-11-22 18:02:11 | No additional task PR merged; 20 agent-managed branches are published | 3 | 27 |

Observed count-based throughput is three task PRs merged on 2026-11-21. This is too little history for a reliable completion-rate projection.

## Current task status

GitHub shows 3 of 30 issues closed and 27 open. Twenty agent-managed task branches are published, but no Sprint 2 task PR is open. Branch publication does not count as issue completion. The local tracker separates the 24 agent-managed tasks by state:

| State | Tasks |
|---|---|
| Merged / Done | #163, #161, #158 |
| Published; awaiting owner PR | #162, #160, #159, #157, #155, #154, #153, #152, #151, #150, #148, #147, #146, #145, #144, #142, #141, #139, #138, #137 |
| Not started / blocked on human evidence | #134 |

The six Tester-owned issues—#156, #149, #143, #140, #136, and #135—remain exclusively human-owned; their progress is unknown. No Tester tests or reports are claimed as completed. S2-SM-05 #134 remains blocked on merged task PRs, UIX-05 evidence, and Tester results.

At this snapshot, agent-managed progress is 3 merged, 20 published and awaiting owner PR, and 1 not started. The local-only `test/sprint2-integration` branch is not published. DEV-07 #141 and DEV-08 #137 use clean, task-only remote publication commits; their original composite local commits remain preserved.

For S2-SM-04, the older published `s2/sm-04` reference is preserved because its commit history includes SM-03 updates. The clean issue-only PR branch is `s2/sm-04-pr`, based on `s2/sm-03`.

## Risks to the day-10 review and Sprint 3 entry

- Twenty-seven issues remain open; only three have task-linked, reviewed, merged PRs.
- Twenty issue branches have been published for owner PR creation; they still need owner PRs, teammate reviews, and dependency-ordered Scrum Master merges.
- The current local integration preview `0cff7a82` passed 237/237 Node tests, the production build, and `git diff --check`. A disposable PostgreSQL 17.11 environment passed the recorded DBA-02 through DBA-06 runtime checks. Hosted Supabase Auth/JWT/RLS, hosted migration state, and email delivery remain unverified.
- DEV-07 #141 is stacked on DEV-06 #144 and must not merge until DEV-05 #147 and DBA-02 #155 are integrated. DEV-08 #137 is stacked on DEV-07 and also awaits its listed Developer predecessors and DBA-06 #139.
- Elish’s UIX-04 editor invitation is sent and awaits acceptance. UIX-05 is a synthetic prototype/source review; authenticated production screens were not exercised.
- Tester-owned execution and regression results are outstanding or unknown. Do not count these as passed.
- The sprint calendar start date and story-point estimates are unavailable, so a sprint-day burndown or point-based velocity cannot be calculated from the evidence in hand.

The Sprint 2 review is at risk until remaining task PRs are reviewed and merged, required database and hosted checks are completed by authorized owners, and the Tester’s results are recorded. The available evidence does not establish that the Sprint 3 entry gate is satisfied.
