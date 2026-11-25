# HOPE Inc. ERP – Per-Right Authorization Test Cases (S2-TST-04)

**Role:** Tester
**Related issue:** #140 – Per-Right Authorization Testing
**Scope:** the nine Customer, Product, and Price action rights, tested on both the interface rule and the server rule
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`) and source-level automated tests on the same commit
**Execution date:** 2026-11-25
**Execution status:** 31 cases. 29 Pass from automated and live evidence. 1 Partial: the rule runs in shared code but no live account attempt was made. 1 Not Run: a Superadmin whose assigned rights deliberately do not match its role. 0 Fail. Every case names the exact right it checks, and the result is the enforcement that actually ran, not the role name.

> **Status legend:** Pass / Fail / Partial / Blocked / Not Run
> No account has full permissions by assumption. Every case below names the exact right it checks, and the result is the enforcement that actually ran, not the role name.

---

## 1. The Nine Rights Under Test

| Module | Right code | Action |
|---|---|---|
| Customer | `add_customer` | Add Customer |
| Customer | `edit_customer` | Edit Customer |
| Customer | `delete_customer` | Delete Customer |
| Product | `add_product` | Add Product |
| Product | `edit_product` | Edit Product |
| Product | `delete_product` | Delete Product |
| Product | `add_price` | Add Price |
| Product | `edit_price` | Edit Price |
| Product | `delete_price` | Delete Price |

Restore is not in the catalogue. The implementation makes it an Admin/Superadmin action with no extra right; that is recorded here as an agreed deviation, not an assumption.

---

## 2. Account Matrix

| Account | Role | Assigned rights | Purpose |
|---|---|---|---|
| SA-T | Superadmin | all nine | Baseline |
| ADM-T | Admin | all nine | Admin boundary |
| USR-NONE | User | none | Modules hidden, all actions denied |
| USR-C1 | User | add_customer + edit_customer | Partial per-module rights |
| USR-C2 | User | delete_customer only | Delete without add or edit |
| USR-P1 | User | add_product + edit_product | Product without price rights |
| USR-P2 | User | add_price + edit_price + delete_price | Price without product write rights |

None of these accounts was supplied to the Tester. The rows below record what the code and the live anonymous requests prove, and what stays blocked.

---

## 3. Navigation and Modules

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-01 | Assigned modules appear | Sign in as USR-C1 | Customer appears; Product does not | Automated: `getVisibleErpModules` maps only assigned module codes to links, and the tile list is built from assigned rights only. | Pass |
| RTS-02 | Unassigned modules stay hidden | Sign in as USR-NONE | No module link at all; an honest empty state | Automated: a user with zero assigned rights gets an empty module list, not an error and not every tile. | Pass |
| RTS-03 | Module list cannot be widened by URL | Request an unassigned module route directly | 404 or redirect | Automated: unknown or unassigned modules are rejected; an unauthorized request never reads permissions. The anonymous live probe on `/erp/modules/customer` returned a redirect payload with no content. | Pass |
| RTS-04 | Rights change takes effect on the next request | Change a user's rights, then reload | New rights apply without a redeploy | Automated: module assignments are re-read per request rather than cached per session. | Pass |

---

## 4. Action Rights: Customer

| ID | Right | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-05 | add_customer | As USR-C1, click Add Customer | The button appears and the page opens | Automated: the page derives `canAdd` from the assigned right; the server create handler requires `add_customer`. | Pass |
| RTS-06 | add_customer denied | As USR-C2 (no add_customer), send the create body | 403, no write | Automated: a missing `add_customer` returns 403 before the write function runs. Live anonymous `POST /api/customer` returned 403. | Pass |
| RTS-07 | edit_customer | As USR-C1, click Edit on a row | The button appears and the form opens with the current values | Automated: `canEdit` is derived from `edit_customer` and the edit handler requires the same right. | Pass |
| RTS-08 | edit_customer denied | As USR-C2, PATCH a customer | 403, no change | Automated: a missing `edit_customer` returns 403 before the adapter runs. | Pass |
| RTS-09 | delete_customer | As USR-C2, PATCH `{ isDeleted: true }` | 200 and the row becomes inactive | Automated: `delete_customer` is required for the delete transition only, and the adapter runs after that check. | Pass |
| RTS-10 | delete_customer denied | As USR-C1 (no delete_customer), PATCH the same body | 403, the row stays active | Automated: the delete branch explicitly checks `delete_customer` and returns 403. | Pass |
| RTS-11 | Restore is not a right | As USR-C2, PATCH `{ isDeleted: false }` | 403 because only a manager restores | Automated: restore is refused for the User role regardless of the rights held. | Pass |

---

## 5. Action Rights: Product

| ID | Right | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-12 | add_product | As USR-P1, click Add Product | Button appears, create succeeds | Automated: create requires the Product module and `add_product` before the write. | Pass |
| RTS-13 | add_product denied | As USR-P2, send the create body | 403, no write | Automated: a missing `add_product` returns 403 before the write. Live anonymous `POST /api/product` returned 403. | Pass |
| RTS-14 | edit_product | As USR-P1, edit a product | 200 and only description and unit change | Automated: edit requires `edit_product` and rejects identity, status, and stamp fields. | Pass |
| RTS-15 | edit_product denied | As USR-P2, PATCH a product | 403, no change | Automated: a missing `edit_product` returns 403 before the adapter runs. | Pass |
| RTS-16 | delete_product | As ADM-T, PATCH `{ isDeleted: true }` | 200, the product becomes inactive | Automated: `delete_product` is required for the deactivate transition and the exact trigger error maps to 409. | Pass |
| RTS-17 | delete_product denied | As USR-P1 (no delete_product), PATCH the same body | 403, the product stays active | Automated: the delete branch checks `delete_product` and refuses the User without it. | Pass |

---

## 6. Action Rights: Price

| ID | Right | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-18 | add_price | As USR-P2, add a price | 201 and the price is listed | Automated: add requires Product access plus `add_price`, and validates the exact field set. | Pass |
| RTS-19 | add_price denied | As USR-P1, add a price | 403, no write | Automated: a missing `add_price` returns 403 `You do not have permission to perform this Price History action.` | Pass |
| RTS-20 | edit_price | As USR-P2, edit a price amount | 200 and the identity is kept | Automated: edit requires `edit_price` and preserves the product and effective date. | Pass |
| RTS-21 | edit_price denied | As USR-P1, edit the same price | 403, no change | Automated: a missing `edit_price` returns 403 before the adapter runs. | Pass |
| RTS-22 | delete_price | As USR-P2, PATCH `{ isDeleted: true }` | 200 and the price leaves the active list | Automated: soft delete requires `delete_price` and accepts only the delete transition. | Pass |
| RTS-23 | delete_price denied | As USR-P1, PATCH the same body | 403, no change | Automated: a missing `delete_price` returns 403 before the adapter runs. | Pass |
| RTS-24 | Rights are checked one by one, not by role | Give USR-P1 only `add_price` | Add works; edit and delete are refused | Automated: the three price handlers each read their own right from `actor.rights`, so holding one does not grant the others. | Pass |

---

## 7. Direct URL and Direct Request Bypass

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-25 | Direct URL cannot bypass a missing module | As USR-NONE, open `/erp/modules/customer` and `/erp/modules/product` | 404, no data | Automated: the page calls `notFound()` when the module is not assigned; the live anonymous probe returned no page content. | Pass |
| RTS-26 | Direct URL cannot bypass a missing action right | As USR-C2, open `/erp/modules/customer/new` | The create form is not offered; a direct submit is refused | Automated: the create page reads the same access record and the handler refuses the POST. Live anonymous probe on `/erp/modules/customer/new` returned a redirect payload. | Pass |
| RTS-27 | Direct HTTP request cannot bypass rights | Send each of the nine actions with no session, and again with a foreign `Origin` | 401 for reads, 403 for writes, nothing written | Live probe 2026-11-25: every write route (`POST /api/customer`, `POST /api/product`, `POST /api/product/[code]/price-history`, `PATCH /api/customer/[no]/status`, `PATCH /api/product/[code]/status`) returned 403 `Request not allowed.`; the customer and product reads returned 401. The same `POST` from `Origin: https://attacker.example` also returned 403. | Pass |
| RTS-28 | Inactive records and administrative fields stay protected | As a User, request Status and Stamp | Absent from the payload | Automated: the User paths select only the business columns; `status` and `stamp` appear only for manager reads. | Pass |
| RTS-29 | Unauthorized writes leave the database unchanged | After a refused call, read the record | Unchanged | Automated: every refusal path returns before the adapter function is reached, and the tests assert the adapter was never called. | Pass |

---

## 8. Role Name Is Not Permission

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| RTS-30 | A Superadmin without an assigned right | Create a Superadmin account with no Customer rights, then attempt an add | The action is refused: a role does not imply a right | Not Run: this needs an account whose assigned rights deliberately differ from its role. The code does read `actor.rights` for every action, so the rule exists, but the behavior has not been observed with a real account. | Not Run |
| RTS-31 | An Admin checks only its own rights | Sign in as an Admin with no `delete_product` and attempt a product delete | 403 | Partial: the shared `authorizedActor` reads the right from `actor.rights` rather than from the role, so the Admin path is the same code as the Superadmin path. No live Admin attempt was made. | Partial |

---

## 9. Test Summary

| Area | Total | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| Navigation and modules | 4 | 4 | 0 | 0 | 0 | 0 |
| Customer rights (3) | 7 | 7 | 0 | 0 | 0 | 0 |
| Product rights (3) | 6 | 6 | 0 | 0 | 0 | 0 |
| Price rights (3) | 7 | 7 | 0 | 0 | 0 | 0 |
| Direct URL and HTTP bypass | 5 | 5 | 0 | 0 | 0 | 0 |
| Role is not permission | 2 | 0 | 0 | 1 | 0 | 1 |
| **Total** | **31** | **29** | **0** | **1** | **0** | **1** |

Recount from the rows above: the nine rights each have a granted case and a refused case across Customer (7), Product (6), and Price (7) — 20 right-specific cases — plus 4 navigation, 5 bypass, and 2 role-vs-right cases. 29 Pass, 1 Partial, 1 Not Run, 0 Fail.

---

## 10. Evidence

```bash
node --test tests/s2-dev01-customer-list.test.mjs
node --test tests/s2-dev02-customer-mutations.test.mjs
node --test tests/s2-dev03-customer-status.test.mjs
node --test tests/s2-dev04-product-list.test.mjs
node --test tests/s2-dev05-product-mutations.test.mjs
node --test tests/s2-dev06-product-status.test.mjs
node --test tests/s2-dev07-price-history.test.mjs
node --test tests/dev07-user-rights.test.mjs
node --test tests/dev07-user-rights-server.test.mjs
node --test tests/dev08-erp-access.test.mjs
```

All ran green on 2026-11-25: 9, 12, 9, 14, 10, 7, 11, 9, 3, and 9 tests respectively, 0 failures.

The live requests and their codes are listed in `docs/test-cases/permission-matrix-test-cases.md` §4.2.

---

## 11. Outstanding Security Items

| Item | Why it matters | What settles it |
|---|---|---|
| RTS-30 (Not Run) | The brief explicitly says not to assume a Superadmin has every right. Only a real account with an intentionally empty rights set proves the server honors that. | One Superadmin test account whose rights are cleared by the DB Admin, then one add attempt. |
| RTS-31 (Partial) | Same rule for an Admin: the role must not grant a right the account was not given. | One Admin account missing `delete_product`, then one delete attempt. |
| RLS at the database boundary | The server paths use a secret key that bypasses RLS, so handler tests prove the application rule but not the database rule. | The DB Admin's RLS run for `product`, `pricehist`, `salesdetail`, and `app_user`, with a User JWT. |

No security defect was observed. The logs show no case where an unauthorized request returned data or changed a record.

---

## 12. Defects Found

| Defect ID | Related case | Summary | Severity | Status |
|---|---|---|---|---|
| - | - | No defect observed in the executed cases. | - | - |
