# HOPE Inc. ERP – Role-and-Rights Permission Matrix Test Cases (Sprint 1)

**Role:** Tester
**Scope:** Superadmin, Admin, and User roles tested against each applicable permission; menus and buttons reflect assigned rights; server-side access follows the same rights
**Related issue:** #52 – Test the HOPE ERP role-and-rights permission matrix using registered and approved test accounts
**Environment:** Deployed website (https://hope-erp-phi.vercel.app) and local server-handler tests
**Execution date:** 2026-11-22; server-handler checks added 2026-11-25
**Execution status:** Role and UI cases: 10 of 15 run (9 Pass, 1 Partial). Live server-side cases are Not Run; their authorization rules are covered by 8 automated server-handler tests that pass 8/8.

> **Status legend:** Not Run / Pass / Fail / Blocked / Partial (not every role or step was run)
> Expected results marked "(confirm)" are assumptions. Check them against the official permission matrix, and change any row where the matrix says otherwise.

---

## 1. Test Environment and Test Accounts

| Item | Value |
|---|---|
| App URL | https://hope-erp-phi.vercel.app |
| Browsers | Chrome (primary), Edge or Firefox (secondary) |
| Tools for server-side checks | Browser DevTools (Network tab) or Postman |

### Test accounts needed (registered and approved)

| Account | Role / State | Used for |
|---|---|---|
| SA-1 | Superadmin | Full-rights baseline |
| ADM-1 | Admin | Admin rights and restrictions |
| USR-1 | User (approved, regular) | Lowest-rights checks |
| USR-P | Pending (registered, not approved) | Access before approval |
| USR-B | Blocked | Access after blocking |

### Rules for testing on the deployed site
- Use only the test accounts above and test records you created. Do not edit, block, or delete real users' data.
- Do not run the last-Superadmin or bulk checks on live Superadmin accounts that real people depend on.
- Tell the team before running the server-side cases, since they send direct requests to the live API.

---

## 2. Role Coverage per Permission

> Each case is run once per role (Superadmin, Admin, User). "Denied" means the action is not possible, no data is shown or changed, and the user sees an appropriate response.

| ID | Permission | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| PRM-01 | View user directory | Sign in as SA-1, ADM-1, and USR-1 in turn, then open User Management | **Superadmin:** allowed, all accounts listed. **Admin:** allowed, Superadmin accounts not listed. **User:** denied, page blocked or redirected with no user data shown | **SA-1:** all accounts are listed. <br> **ADM-1:** accounts are listed, but no Superadmin account appears. <br> **USR-1:** cannot view the accounts and only sees the dashboard. | Pass |
| PRM-02 | Add or edit user | As each role, add a user with valid data, then edit a regular user and save | **Superadmin:** allowed, changes saved. **Admin:** allowed for non-Superadmin accounts (confirm), changes saved. **User:** denied, no option available and nothing saved | **SA-1:** can Edit, manage Rights, Block, and Send Setup Invitation. <br> **ADM-1:** can do the same actions as the Superadmin. <br> **USR-1:** has no access to the Superadmin or Admin functions and cannot view or edit the accounts. <br> An Add User option was not noted. | Pass |
| PRM-03 | Block and unblock user | As each role, block then unblock a regular test user | **Superadmin:** allowed, status changes to Blocked then Active. **Admin:** allowed for non-Superadmin accounts (confirm). **User:** denied, no status change | **SA-1:** can block accounts listed in User Management. <br> **ADM-1:** can also block accounts in User Management. <br> **USR-1:** cannot block accounts. | Pass |
| PRM-04 | Approve pending users and designate Admin | As each role, approve a pending test account and try to promote a user to Admin | **Superadmin:** allowed for both. **Admin:** approve allowed and designating other users as Admin allowed (confirm). **User:** denied for both, no change | **SA-1:** can make an account Admin if it does not have Admin access yet, and cannot make an existing Admin an Admin again. <br> **ADM-1:** cannot make themselves Admin because the account is already an Admin, but can make other users Admin. <br> **USR-1:** cannot make anyone Admin because the User has no User Management; only Superadmin and Admin have it. <br> Pending account: the login screen tells the user to contact the administrator, and the administrator allows the account in the website itself. Which roles approved a pending account was not recorded. | Partial |
| PRM-05 | View and edit Superadmin accounts | As each role, search for a Superadmin and try to open and edit it | **Superadmin:** allowed, account visible and editable. **Admin:** denied, account hidden or request declined. **User:** denied, no account data shown | **SA-1:** can view the Admin and User accounts. <br> **ADM-1:** cannot view Superadmin accounts, which do not appear in User Management. <br> **USR-1:** User Management is not available in the sidebar. | Pass |

---

## 3. Menus and Buttons Reflect Assigned Rights

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| UI-01 | Menus match each role | Sign in as SA-1, ADM-1, and USR-1 in turn and review the navigation | Each role sees only the modules the matrix allows; Superadmin-only and admin-only items are absent for lower roles | The menus differ by role, and the difference is User Management. Superadmin and Admin have Dashboard, User Management, and System Settings. User has only Dashboard and System Settings, with no User Management. | Pass |
| UI-02 | Action buttons match each role | In User Management, compare Add, Edit, Block, and Approve buttons for each role | Buttons appear or are disabled exactly as the matrix allows | **SA-1:** four action buttons: Edit, Rights, Block, and Send Setup Invitation. <br> **ADM-1:** three action buttons: Edit, Rights, and Block. | Pass |
| UI-03 | Role change updates the UI | As SA-1, change ADM-1's role to User, then refresh or sign in again as that account | Menus and buttons match the new role | Opened Manage Access Rights on the selected account (Five modules · 36 action rights total) and changed its access to User only. The account no longer has User Management. | Pass |
| UI-04 | Restricted page opened by direct URL | As USR-1, paste the URL of an admin-only page | Access is blocked or redirected, and no data is shown | As a User, copied the Superadmin URL and opened it. The Superadmin pages and privileges did not load, and the app stayed on the pages the User can access. | Pass |
| UI-05 | Pending, blocked, and signed-out access | Try to sign in as USR-P and USR-B, and open a protected URL in a fresh session | Pending and blocked accounts cannot sign in, and signed-out visits are redirected to login with no data shown | Blocked another email as Superadmin and saw "User blocked". Signing in with the blocked account did not load and stayed on the login page. The Pending account also did not load the dashboard because it is still pending. Opening a protected link in another tab while signed out signed the site out and returned to the login page. | Pass |

### 36-right catalogue coverage

The rights dialog must expose 5 modules and 36 action rights. This table is the coverage reference for the catalogue; UI-03 confirms the total, and UI-01/UI-03 confirm module visibility. Per-action customer and product CRUD screens are Sprint 2 scope, so Sprint 1 checks module visibility and the server-side role boundary rather than each CRUD screen.

| Module | Rights | Right names | Sprint 1 check |
|---|---|---|---|
| Customer | 3 | Add Customer, Edit Customer, Delete Customer | Customer tile appears only when at least one Customer right is assigned (UI-01, UI-03) |
| Product | 6 | Add Product, Edit Product, Delete Product, Add Price, Edit Price, Delete Price | Product tile appears only when at least one Product right is assigned (UI-01, UI-03) |
| Human Resources | 13 | Add Job, Edit Job, Delete Job, Add Department, Edit Department, Delete Department, Add Employee, Edit Employee, Delete Employee, View Job History, Add Job History, Edit Job History, Delete Job History | Human Resources tile appears only when at least one HR right is assigned (UI-01, UI-03) |
| Sales | 7 | Add Sale, Edit Sale, Delete Sale, View Sale Detail, Add Sale Detail, Edit Sale Detail, Delete Sale Detail | Sales tile appears only when at least one Sales right is assigned (UI-01, UI-03) |
| Reports | 7 | Top Customers, Product Master List, Top Products, Active Employees, All Employees, Employee Job History, Top Sales | Reports tile appears only when at least one Reports right is assigned (UI-01, UI-03) |
| **Total** | **36** | | UI-03 showed "Five modules · 36 action rights total"; `lib/auth/user-rights.ts` rejects any catalogue that is not exactly 36 distinct rights |

---

## 4. Server-Side Access Follows the Same Rights

> Use DevTools (Network tab) or Postman to send requests directly, so the check does not depend on what the UI hides.

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| SRV-01 | User calls admin APIs | As USR-1, send requests to read the user list and to add or edit a user | The requests are declined (403) or return no data, and nothing is saved | Automated handler test: User list, create, and update return 403; rights read and save return 403; no dependency is called. Live deployed request not run. | Partial |
| SRV-02 | Admin targets a Superadmin via the API | As ADM-1, send requests to update or block a Superadmin and to set a role to Superadmin | The requests are declined and the Superadmin record and roles are unchanged | Automated handler test: Admin approve and Admin designation return 403; `visibleRoleCodes('admin')` returns only `user`; `canManageUserRole` refuses Admin and Superadmin targets. Superadmin approve/promote succeeds. Live deployed request not run. | Partial |
| SRV-03 | Hidden button re-enabled | In DevTools, re-enable a hidden or disabled button as USR-1 and click it | The server declines the action, so the UI is not the only guard | Automated handler test: User block and User rights-save requests return 403 even when the request is sent directly. Live DevTools click not run. | Partial |
| SRV-04 | Invalid, expired, or blocked token | Send a request with an invalid or expired token, and with the token of a user who was just blocked | The requests are declined with 401 or 403 and no data is returned | Automated handler test: a missing session returns 401 for user listing and rights read. Invalid, expired, and newly blocked live tokens not run. | Partial |
| SRV-05 | Direct database query under RLS | Query the Supabase tables using a User's token | Only the rows permitted for that role are returned | | Not Run |

### 4.1 Automated server-handler evidence

Command:

```bash
node --test tests/s1-tst-04-permission-matrix.test.mjs
```

Result on 2026-11-25: 8 tests, 8 pass, 0 fail. The tests assert the role boundary in `lib/auth/user-management.ts` and `lib/auth/user-rights.ts`: User requests return 403, missing sessions return 401, Admin approve/promote requests return 403, the Admin role never includes Superadmin accounts, and Superadmin approve/promote succeeds. These are source-level handler checks, not live deployed API calls; SRV-01 to SRV-04 stay Partial until the live token checks are run.

---

## 5. Test Summary

| Module | Total | Pass | Fail | Blocked | Partial | Not Run |
|---|---|---|---|---|---|---|
| Role coverage per permission | 5 | 4 | 0 | 0 | 1 | 0 |
| Menus and buttons | 5 | 5 | 0 | 0 | 0 | 0 |
| Server-side access | 5 | 0 | 0 | 0 | 4 | 1 |
| **Total** | **15** | **9** | **0** | **0** | **5** | **1** |

## 6. Defects Found

| Defect ID / Issue # | Related test case | Summary | Severity | Status |
|---|---|---|---|---|
| | | | | |

Log failures using `ISSUE_TEMPLATE.md`: steps to reproduce, expected result, actual result.

## 7. Notes

- System Settings is visible to all three roles. Confirm against the permission matrix that this is intended.
- Admins have a Rights button that opens Manage Access Rights. SRV-02 should confirm that an Admin cannot use it, in the UI or by calling the API, to grant Admin or Superadmin access or to change a Superadmin's rights.
- PRM-04 is Partial: which roles can approve a pending account still needs to be recorded. Admins can make other users Admin, so confirm against the permission matrix that this is intended.
- Expected results marked "(confirm)" should be checked against the official permission matrix.
- The server-side cases need each account's session token, taken from DevTools while signed in. SRV-01 to SRV-04 have source-level automated evidence but still need the live request for a full Pass.
- `tests/s1-tst-04-permission-matrix.test.mjs` is the regression check for the role boundary. Run it with `node --test tests/s1-tst-04-permission-matrix.test.mjs` after changing User Management or Rights Management authorization.