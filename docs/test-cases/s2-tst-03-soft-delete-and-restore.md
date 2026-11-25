# HOPE Inc. ERP – Soft Delete and Restore Test Cases (S2-TST-03)

**Role:** Tester
**Related issue:** #143 – Soft Delete and Restore Testing
**Application routes:** `/api/customer/[custNo]/status`, `/api/product/[prodCode]/status`, `/api/product/[prodCode]/price-history/[effectiveDate]/status`
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`) and source-level automated tests on the same commit
**Execution date:** 2026-11-25
**Execution status:** 18 cases. 12 Pass from automated and live evidence. 4 Partial: the rule is proven in the handler or trigger source but the by-hand screen step, or the trigger run itself, was not performed. 2 Blocked: the two database trigger runs need a disposable database (`psql` and a connection string), which this environment does not have.

> **Status legend:** Pass / Fail / Partial / Blocked / Not Run
> No business record was permanently deleted during this run. Every write rule below was checked at the handler or trigger level, and nothing was written to the production database.

---

## 1. Environment and Fixtures

| Item | Value |
|---|---|
| Application commit | `6f229eb` |
| Automated suites | `tests/s2-dev03-customer-status.test.mjs` (9), `tests/s2-dev06-product-status.test.mjs` (7), `tests/s2-dev07-price-history.test.mjs` (11) |
| Database fixtures | `supabase/tests/s2_dba_04_child_record_delete_rules.sql` (331 lines, rollback-only fixtures `D04C1`, `D04P01`, `D04T0001`) |
| Dependency rule reference | `docs/sprint-2-dba-04-child-record-delete-rules.md` |
| Seeded records | `D5C01`–`D5C03`, `D5P001`–`D5P005` in `supabase/seed.sql` |

The DB Admin's rule is: a Customer cannot be deactivated while it has active `sales`, and a Product cannot be deactivated while it has active `salesdetail` or active `pricehist`. Restoring a row does not run the child check.

---

## 2. Customer Soft Delete and Restore

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| DEL-01 | Soft-delete a customer with no active children | As USR-C with delete_customer, PATCH `{ isDeleted: true }` on an unused customer | 200, `is_deleted = true`, the row still exists | Automated: `handleCustomerStatusRequest` accepts only the delete transition and the adapter changes only `is_deleted`, comparing the expected previous state atomically. | Pass |
| DEL-02 | Soft-delete is blocked by an active sale | Same call on a customer with an active sale | 409 `ACTIVE_DEPENDENTS` with the fixed safe message, and the row stays active | Automated: the trigger error `P0001` with the anchored message maps to the 409 body. Only the exact trigger message maps; other errors stay generic 503. Trigger execution itself is Blocked (DBA-01). | Partial |
| DEL-03 | Customer identity is unchanged | Read the row after a soft delete | The same `custno`, name, address, payment terms | Automated: the status adapter writes only `is_deleted`; no identity column is touched. | Pass |
| DEL-04 | Linked sales references are preserved | Inspect sales rows after a soft delete | The `custno` foreign key still matches | Database fixture asserts this, but it needs a disposable database. | Blocked |
| DEL-05 | Restore a customer | As ADM-C, PATCH `{ isDeleted: false }` | 200, `is_deleted = false` | Automated: restore is accepted only for an Admin or Superadmin; a User restore returns 403 `Only Admins and Superadmins can restore customers.`. | Pass |
| DEL-06 | Regular User cannot restore | As USR-C, PATCH `{ isDeleted: false }` | 403 and no change | Automated: the User path is refused before the adapter runs. Live anonymous `PATCH /api/customer/T0001/status` returned 403 `Request not allowed.` | Pass |
| DEL-07 | Unauthorized delete request | As USR-C2 with no delete_customer, PATCH `{ isDeleted: true }` | 403 and no change | Automated: a missing `delete_customer` right returns 403 before any write; a direct cross-origin request returns 403 first. | Pass |
| DEL-08 | Status and Stamp update | Read the row after delete and after restore | Status flips and Stamp records the change with the actor | Automated: the audit trigger records the actor (`hope_authenticated_audit_user` migration). The rendered Stamp text was not compared on screen. | Partial |

---

## 3. Product Soft Delete and Restore

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| DEL-09 | Soft-delete a product with no active children | As USR-P with delete_product, PATCH `{ isDeleted: true }` on `D5P003` | 200, `is_deleted = true` | Automated: `handleProductStatusRequest` requires `delete_product` and the Product module, and accepts only `isDeleted: true`. | Pass |
| DEL-10 | Soft-delete blocked by an active sales detail | Same call on a product with an active sales detail | 409 `ACTIVE_DEPENDENTS`, the row stays active | Automated: the exact trigger message maps to the 409 body, and a near-miss message maps to 503 instead. Trigger execution itself is Blocked (DBA-01). | Partial |
| DEL-11 | Soft-delete blocked by an active price | Same call on a product with an active `pricehist` row | 409 `ACTIVE_DEPENDENTS`, the row stays active | Automated: `s2_dba_04` writes the fixture for this case, but the script needs a disposable database. Trigger execution itself is Blocked (DBA-01). | Partial |
| DEL-12 | Restore a product | As ADM-P, PATCH `{ isDeleted: false }` | 200, `is_deleted = false` | Automated: restore is accepted only for Admin or Superadmin; a User restore returns 403 `Only Admins and Superadmins can restore products.`. | Pass |
| DEL-13 | Product identity is unchanged | Read the row after delete and restore | The same `prodcode`, description, unit | Automated: the status adapter changes only `is_deleted`; identity columns are never written by the status path. | Pass |
| DEL-14 | Price history survives a product soft delete | Deactivate a product, then reopen its history | History rows still exist and reference the same `prodcode` | Automated: the price read path joins on `prodcode`, which is untouched by the soft delete; delete is a flag, not a row removal. | Pass |
| DEL-15 | Active child cannot attach to an inactive parent | Insert or reactivate a child under an inactive parent | SQLSTATE `23514` with `active_parent_required` | Database fixture asserts this; Trigger run is Blocked (DBA-01). Handler side: the price add/edit path refuses an inactive product with 404 or 409 `INACTIVE_PARENT`. | Partial |
| DEL-16 | Rejected writes do not partially modify records | Send a blocked delete, then read both parent and child | Parent stays active, child stays unchanged | Automated: the adapter compares the expected previous state inside one statement, so a rejected transition leaves the row as it was, and a stale state does not report success. | Pass |

---

## 4. Visibility of Inactive Records

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| DEL-17 | Administrators can reach inactive records | As ADM-C, choose the Inactive filter | Inactive customers shown, with Status and Stamp | Automated: manager reads use the authorized table with `is_deleted = true`, and the payload includes `status` and `stamp`. | Pass |
| DEL-18 | Regular Users never see inactive records | As USR-C and USR-P, choose All or Inactive | Only active rows, no Status or Stamp | Automated: the User read path is pinned to `customer_active` / `product_active`, and a User sending `?status=inactive` on Product gets 403 instead of inactive rows. | Pass |

---

## 5. Test Summary

| Area | Total | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| Customer soft delete and restore | 8 | 6 | 0 | 2 | 0 | 0 |
| Product soft delete and restore | 8 | 4 | 0 | 2 | 2 | 0 |
| Inactive visibility | 2 | 2 | 0 | 0 | 0 | 0 |
| **Total** | **18** | **12** | **0** | **4** | **2** | **0** |

Recount from the rows above: 8 customer cases (DEL-01 to DEL-08) with 6 Pass and 2 Partial; 8 product cases (DEL-09 to DEL-16) with 4 Pass, 2 Partial, and 2 Blocked; 2 visibility cases with 2 Pass. Grand total 12 Pass, 4 Partial, 2 Blocked, 0 Fail.

No failure was observed. The two Blocked cases are the database-trigger runs, which need the DB Admin's disposable database.

---

## 6. Evidence

```bash
node --test tests/s2-dev03-customer-status.test.mjs
node --test tests/s2-dev06-product-status.test.mjs
node --test tests/s2-dev07-price-history.test.mjs
```

Result: 9, 7, and 11 tests, all passing, 0 failures.

Database fixture, to be run by the DB Admin or by the Tester once a disposable database is available:

```bash
psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s2_dba_04_child_record_delete_rules.sql
```

That script rolls its own fixture rows back, so it leaves no data behind.

---

## 7. Defects Found

| Defect ID | Related case | Summary | Severity | Status |
|---|---|---|---|---|
| - | - | No defect observed in the executed cases. The rejected writes left records unchanged and returned the documented 403/409 codes. | - | - |

---

## 8. Notes and Blockers

- **Blocker (DBA-01):** `psql` is not installed and no isolated connection string was supplied, so `s2_dba_04_child_record_delete_rules.sql` and the concurrency script were not run. The DB Admin owns this; the Tester's handler-level results are recorded above so nothing is invented.
- **Restore has no separate right.** The Student Guide's 36-right catalogue has Delete but no Restore. The implementation makes Restore an Admin/Superadmin action with no extra right. Confirm with the Scrum Master that this matches the agreed matrix.
- **Safety:** only the delete transition was tested, and no production record was deleted. A live delete-and-restore pair must run in the disposable environment.
