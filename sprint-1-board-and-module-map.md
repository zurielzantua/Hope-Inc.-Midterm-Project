# HOPE Inc. ERP - Sprint 1 Board and Module-to-Sprint Map

**Task:** S1-SM-02

## 1. Sprint 1 Board: Stories with Acceptance Criteria

| Task ID | Story | Acceptance criteria |
|---|---|---|
| S1-DEV-01 | Project scaffold: app skeleton, env config, DB connection | Project scaffold: app skeleton, env config, DB connection; PR merged |
| S1-DEV-02 | Register user form and API (new users start as pending) | Register user form and API (new users start as pending); PR merged |
| S1-DEV-03 | Login and logout with session handling, set-password | Login and logout with session handling; password hashing and set-password on first login; blocked users cannot sign in; PR merged |
| S1-DEV-04 | Reset password: request, emailed token, reset form | Reset password: request, emailed token, reset form; PR merged |
| S1-DEV-05 | User Management screen | User Management screen: user list, Add User, Edit User, Block/Unblock; Admin manages Users only and Superadmin accounts are hidden; PR merged |
| S1-DEV-06 | Superadmin: approve pending users, designate admins | Superadmin: approve pending users and designate admins; block removing or disabling the last remaining superadmin; PR merged |
| S1-DEV-07 | Rights dialog: per-action rights by module | Rights dialog: admin/superadmin assign per-action rights by module (Customer, Product, Human Resources, Sales, Reports) with module checkbox and All/None; log every rights change in audit_log; PR merged |
| S1-DEV-08 | Main page: sidebar, module tiles, permission check | Main page: sidebar and module tiles by role and rights; Server-side permission check; PR merged |
| S1-DBA-01 | Team database setup, migration runner script, setup README | Shared Supabase project set up and linked; Migration runner script (scripts/db-push.sh); Setup README (supabase/README.md); Teammates invited to the Supabase project; PR merged |
| S1-DBA-02 | Migration: HOPE base tables and sample data | Migration: HOPE base tables and sample data from HopeDB_audit.sql; PR merged |
| S1-DBA-03 | Migration: app_user, role, module, rights catalogue, user_permission | Migration: app_user (role, blocked flag), role, module, rights catalogue; user_permission (with soft delete); PR merged |
| S1-DBA-04 | Migration: password reset token table | Migration: password reset token table (hashed, expiry, used flag); PR merged |
| S1-DBA-05 | Seed data: superadmins, modules, rights catalogue, default roles | One superadmin account per team member; Modules (Customer, Product, Human Resources, Sales, Reports); Per-action rights catalogue (36 rights, guide 3.8) and default roles; No passwords in the repo; first password set via one-time set-password link; PR merged |
| S1-DBA-06 | Make audit_user() record the logged-in user in audit_log | Make audit_user() record the logged-in user in audit_log; test it; PR merged |
| S1-TST-01 | Sprint 1 test plan and acceptance criteria | Sprint 1 test plan and acceptance criteria; PR merged |
| S1-TST-02 | Test cases: register, login/logout, set and reset password | Test cases: register, login and logout; Test cases: set and reset password (expired and reused token); PR merged |
| S1-TST-03 | Test cases: User Management | Test cases: User Management (add, edit, block/unblock, approve, designate admin); Admin cannot see or edit Superadmin; Last-superadmin guard; PR merged |
| S1-TST-04 | Permission matrix tests, using registered and approved test accounts | Permission matrix tests (superadmin/admin/user x each right), using registered and approved test accounts; Menu, buttons and server all follow the rights; PR merged |
| S1-TST-05 | Automated smoke test: login and main page | Automated smoke test: login and main page; PR merged |
| S1-TST-06 | Bug reports and fix verification | Bug reports and fix verification; PR merged |
| S1-UIX-01 | Design system: colors, typography, core components | Design system: colors, typography, core components; PR merged |
| S1-UIX-02 | Wireframes: login, register, set/reset password | Wireframes: login, register, set/reset password; PR merged |
| S1-UIX-03 | Wireframes: main page, User Management list, Rights dialog | Wireframes: main page, User Management list and Rights dialog; PR merged |
| S1-UIX-04 | Hi-fi mockups and developer handoff notes | Hi-fi mockups (login, register, main page, User Management, Rights dialog); Developer handoff notes; PR merged |
| S1-UIX-05 | Usability review of built screens and fix list | Usability review of built screens and fix list; PR merged |
| S1-SM-01 | Repo setup: branch protection, PR and issue templates | Repo setup: branch protection, PR and issue templates; PR merged |
| S1-SM-02 | Sprint 1 board: stories and module-to-sprint map | Sprint 1 board: stories with acceptance criteria; map all six guide modules to sprints within the 8-week limit; PR merged |
| S1-SM-03 | Team working agreement, Definition of Done, role guide | Team working agreement, Definition of Done, role guide; PR merged |
| S1-SM-04 | Mid-sprint check notes and impediment log | Mid-sprint check notes and impediment log; PR merged |
| S1-SM-05 | Sprint 1 review and retrospective report | Sprint 1 review and retrospective report; PR merged |

## 2. Six-Module Map Across Four Sprints

| ERP module | Sprint |
|---|---|
| User Management | Sprint 1 |
| Customers | Sprint 2 |
| Products | Sprint 2 |
| Human Resources | Sprint 3 |
| Sales | Sprint 4 |
| Reports | Sprint 4 |
