\## 1. Account Creation \& Validation



| ID | Procedure | Actual Result | Status |

|---|---|---|---|

| USR-01 | Create user with valid unique data | Record persisted, `201`, success toast "Account created", user appears in directory after refresh | \*\*Pass\*\* |

| USR-02 | Submit duplicate email | `409`, inline error "An account with this email already exists", form retained, no second row created | \*\*Pass\*\* |

| USR-03 | Submit empty required fields | Five field-level errors rendered, submit blocked, no `POST` issued | \*\*Pass\*\* |

| USR-04 | Invalid email / short password | Field errors shown, submission blocked. Error copy reads "Invalid format" vs design's "Enter a valid email address" | \*\*Pass (obs.)\*\* — DEV-3112, cosmetic, deferred |

| USR-05 | Complete password setup via invite link | Token consumed, password policy enforced, redirect to dashboard, sign-in succeeds | \*\*Pass\*\* |

| USR-06 | Edit name/department, save | Persisted, list row and detail view both reflect change after refetch | \*\*Pass\*\* |

| USR-07 | Save with invalid department | `422`, validation error, DB row byte-identical to pre-edit snapshot | \*\*Pass\*\* |

| USR-08 | Save with server-side rejection (forced) | Rejected, original record unaltered, dirty-state preserved for retry | \*\*Pass\*\* |

| USR-09 | Edit then cancel / close modal | No `PATCH` sent; reopened record shows original values | \*\*Pass\*\* |

| USR-10 | Block active user | Status → "Blocked", badge visible in list and detail, session invalidated | \*\*Pass\*\* |

| USR-11 | Sign in as blocked user | `403`, "Your account has been blocked" | \*\*Pass\*\* |

| USR-12 | In-flight request from blocked session | Subsequent XHR `401`; session terminated on next navigation | \*\*Pass\*\* |

| USR-13 | Unblock user | Status → "Active", login succeeds immediately | \*\*Pass\*\* |

| USR-14 | Block, then save unrelated edit | First run: status reverted to "Active" after `PATCH` (\*\*DEV-3115\*\*). Fixed in rc3, retest 2026-11-04 14:22 → status retained | \*\*Pass (retest)\*\* |

| USR-15 | Delete user with dependent records | `409`, warning "User has linked records and cannot be deleted", design-compliant modal | \*\*Pass\*\* |



\## 2. Approval \& Admin Designation



| ID | Procedure | Actual Result | Status |

|---|---|---|---|

| APR-01 | Load pending review list | USR-P and all pending fixtures listed with correct metadata | \*\*Pass\*\* |

| APR-02 | Approve USR-P | Status → "Active", invite flow available, login gate released | \*\*Pass\*\* |

| APR-03 | Login before approval completes | Denied, "Account not yet activated" | \*\*Pass\*\* |

| APR-04 | Reject USR-P | Locked out, removed from pending queue, record retained | \*\*Pass\*\* |

| APR-05 | Grant admin role | Admin module appears in nav without re-login | \*\*Pass\*\* |

| APR-06 | Revoke admin role | Admin nav and routes removed, direct URL → 403 | \*\*Pass\*\* |

| APR-07 | Admin assigns role outside matrix | `403` per role matrix, no partial write | \*\*Pass\*\* |

| APR-08 | Role change reflected post re-auth | Permissions recalculated on refresh and on fresh login | \*\*Pass\*\* |

| APR-09 | Double-click approve rapidly | Single state transition; two identical toasts stacked | \*\*Pass (obs.)\*\* — DEV-3118, minor, deferred |



\## 3. Admin Restrictions on Superadmin Accounts



| ID | Procedure | Actual Result | Status |

|---|---|---|---|

| SAD-01 | Superadmin views directory as admin | SA-1/SA-2 absent from list | \*\*Pass\*\* |

| SAD-02 | Admin searches "SA-1" | Zero results | \*\*Pass\*\* |

| SAD-03 | Admin opens SA detail by direct URL | Redirected to not-found, no fields leaked | \*\*Pass\*\* |

| SAD-04 | Direct API `GET /users/{sa-id}` with admin token | `200` + `\[]` rather than `403`. RLS confirmed zero rows at DB layer | \*\*Pass (obs.)\*\* — documented deviation, API contract accepted |

| SAD-05 / SAD-06 / SKU-07 | Admin edits or deactivates Superadmin | `403`, record intact and active throughout | \*\*Pass\*\* |

| SAD-08 | Admin alters Superadmin permissions | Denied, permission set unchanged | \*\*Pass\*\* |

| SAD-09 | Superadmin views directory | All account types visible and editable | \*\*Pass\*\* |

| SAD-10 | Unauthenticated access to Superadmin route | Redirect to login, no data in response body | \*\*Pass\*\* |



\## 4. Last-Superadmin Protection



| ID | Procedure | Actual Result | Status |

|---|---|---|---|

| LST-01 – LST-04 | Deactivate / demote / delete / block sole Superadmin | `409` + "At least one active Superadmin is required", SA-2 unchanged | \*\*Pass\*\* |

| LST-05 | Deactivate SA-2 while SA-1 active | Succeeds, SA-1 preserved | \*\*Pass\*\* |

| LST-06 | Repeat with SA-2 now sole | Blocked with same warning | \*\*Pass\*\* |

| LST-07 | Concurrent deactivation of SA-1 + SA-2 (5 iterations) | rc1/rc2: 2 of 5 runs left zero active Superadmins. rc3 with advisory lock: 5/5 runs retained one | \*\*Pass (obs.)\*\* — DEV-3121 closed |

| LST-08 | Direct `PATCH` bypassing UI | Server-side guard returns `409`, RLS + trigger both enforced | \*\*Pass\*\* |



\## 5. Audit Logging



| ID | Procedure | Actual Result | Status |

|---|---|---|---|

| AUD-01 | Perform create/edit/approve/role change | One row per action: timestamp (UTC), actor ID, target ID, before/after diff | \*\*Pass\*\* |

| AUD-02 | Verify immutable + append-only | No update/delete grants on `audit\_log`; failed actions also logged | \*\*Pass\*\* |



\---



\## Defect Log



| ID | Sev | Summary | Status |

|---|---|---|---|

| DEV-3112 | Minor | Email validation copy deviates from design | Open — deferred |

| DEV-3115 | Major | Status reverted by concurrent profile save | \*\*Closed\*\* — rc3 |

| DEV-3118 | Minor | Duplicate toast on rapid double-click | Open — deferred |

| DEV-3121 | Critical | Race condition could orphan all Superadmins | \*\*Closed\*\* — advisory lock + trigger |



\## Coverage Notes



\- RLS exercised at both API and raw-SQL layer; admin token returned zero Superadmin rows in every attempt.

\- Network captures and DB snapshots retained for USR-07, USR-14, SAD-04, LST-07, LST-08.

\- Safari 18.4 required one retry on USR-05 (invite token expired by clock skew in fixture) — no product defect.

