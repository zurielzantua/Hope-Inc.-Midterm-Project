# HOPE Inc. ERP – Customer Management Test Cases (S2-TST-01)

**Role:** Tester
**Related issue:** #156 – Customer Management Testing
**Application route:** `/erp/modules/customer`
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`) and source-level automated tests on the same commit
**Execution date:** 2026-11-25
**Execution status:** 22 cases. 16 Pass from automated and live evidence. 5 Partial: the handler behavior is proven but the by-hand on-screen step was not performed. 1 Blocked: the Customer list could not be opened without an approved test account. No case is reported as passing on the strength of a deployment check alone.

> **Status legend:** Pass / Fail / Partial / Blocked / Not Run
> "Pass" here means the behavior was actually exercised and observed: either by an automated test that ran green, or by a live request whose response was recorded. Cases that need an account are Blocked, not Pass.

---

## 1. Test Environment and Test Data

| Item | Value |
|---|---|
| Application commit | `6f229eb` (integration `setup/initial-project-structure`, 2026-11-24) |
| Automated suite | `tests/s2-dev01-customer-list.test.mjs` (9), `tests/s2-dev02-customer-mutations.test.mjs` (12), `tests/s2-dev03-customer-status.test.mjs` (9) – 30 tests, 0 failures |
| Live probes | Anonymous `GET` / `POST` / `PATCH` requests to the deployed site, response codes recorded |
| Test records | Synthetic values only: customer numbers `T0001`–`T0009` proposals, never written to the live database |

### Accounts needed (none supplied to the Tester yet)

| Account | Role / assigned rights | Used for |
|---|---|---|
| SA-C | Superadmin | Administrative Status and Stamp visibility, Inactive rows, restore |
| ADM-C | Admin | Same as above, plus the Admin boundary |
| USR-C1 | User with add_customer + edit_customer | Add and Edit allowed |
| USR-C2 | User with no Customer right | Navigation and direct-URL denial |
| UNAUTH | No session | Unauthenticated API and page checks |

---

## 2. Customer List, Search, and Filters

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| CUS-01 | Customer list loads | Open `/erp/modules/customer` as ADM-C | Rows render with number, name, address, payment terms, and the selected filter | Anonymous probe: the page returns a redirect payload and renders no Customer content. Live list not exercised. | Blocked |
| CUS-02 | Search by customer number | Search `D5C01` | Only that customer is returned | Automated: the search expression quotes `custno`, `custname`, `address`, and `payterm` as `ilike` literals, so a number search targets `custno`. Live search not exercised. | Partial |
| CUS-03 | Search by name | Search `Acme` | The matching customer is returned | Automated: name search is part of the generated filter set. Live search not exercised. | Partial |
| CUS-04 | Search by address | Search `42, Main` | The matching customer is returned, and the comma does not break the query | Automated: the generated filter is `address.ilike."%42, Main%"`, so the comma is treated as text and the filter chain stays intact. | Pass |
| CUS-05 | Search by payment terms | Search `30D` | Customers with 30D terms are returned | Automated: `payterm` is one of the four searched columns. Live search not exercised. | Partial |
| CUS-06 | Search input is safely quoted | Search `x),status.eq.false`, `100%_`, `a"b`, `a\b` | The value is escaped and cannot add its own filter terms | Automated: hostile input is escaped to `"%x),status.eq.false%"`; `%` and `_` get backslash escapes; quotes and backslashes are doubled. | Pass |
| CUS-07 | Active / Inactive / All filters | As ADM-C, choose each filter | Active shows `is_deleted = false`, Inactive shows `is_deleted = true`, All shows both | Automated: Admin and Superadmin requests carry the exact `is_deleted` filter for each choice, and the default view is `all`. | Pass |
| CUS-08 | User cannot widen the filter | As USR-C1, open `?status=all` and `?status=inactive` | The response stays on active rows and never returns inactive ones | Automated: a User request is forced to `status: active`, reads `customer_active`, and the response contains no inactive or restricted fields. | Pass |
| CUS-09 | Invalid filter values are rejected | Request `?status=deleted`, `?q=one&q=two`, `?q=<101 chars>` | 400 with a private no-store response, and no database query is made | Automated: all three are rejected with 400, `Cache-Control: private, no-store`, and no query runs. | Pass |
| CUS-10 | List response is not cacheable | Read the response headers | `Cache-Control: private, no-store` | Automated: present on the 200, 400, 401, 403, and 503 responses. | Pass |

---

## 3. Create and Edit

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| CUS-11 | Create a customer | As USR-C1 with add_customer, POST a valid 5-character number, name, address, and COD | 201 and the record is stored | Automated: the handler requires the Customer module and `add_customer` before any write, normalizes the number, and returns 201 with `saved: true`. Live write deliberately not sent to production. | Partial |
| CUS-12 | Create is denied without the right | As USR-C2, POST the same body | 403 and nothing is written | Automated: missing module, missing `add_customer`, or no session each return 401/403 before the write function is called. Live anonymous probe returned 403 `Request not allowed.` | Pass |
| CUS-13 | Duplicate customer number | Create a number that already exists | 409 "That customer number is already in use." and no second row | Automated: the unique-violation code `23505` maps to the 409 message; other database errors map to a generic 503. | Pass |
| CUS-14 | Missing and invalid fields | Omit a field; send a 4-character or lowercase-only-invalid number; send `paymentTerms: 'NET'`; send an extra field | 400 describing the expected input, and no write | Automated: every listed variant is rejected with 400 before the write function is called. | Pass |
| CUS-15 | Edit preserves the identity | As USR-C1, edit `T0001` and try to send a different `customerNo`, `stamp`, or `status` in the body | 200 for the allowed fields; identity, Status, and Stamp are ignored or rejected | Automated: Edit accepts exactly `name`, `address`, and `paymentTerms`; identity, status, stamp, and soft-delete fields are rejected. | Pass |
| CUS-16 | Edit a missing or malformed key | PATCH `/api/customer/T1/status` and `/api/customer/t0001` | 404 with no database query | Automated: a malformed path key returns 404 before any query, and an absent update returns not found. | Pass |
| CUS-17 | Edit is denied for a User on an inactive row | As USR-C1, edit a soft-deleted customer | Not found, and nothing changes | Automated: the User edit path reads `customer_active`, so an inactive row is not found. | Pass |

---

## 4. Visibility, Restriction, and Authorization

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| CUS-18 | Status and Stamp show for managers only | Open the list as SA-C and ADM-C, then as USR-C1 | Status and Stamp columns for managers; absent for a User | Automated: manager reads include `is_deleted, stamp` and return `status` and `stamp`; the User path selects only `custno, custname, address, payterm` and the API never emits `status` or `stamp`. | Pass |
| CUS-19 | Inactive-row restriction | As USR-C1, search for and open an inactive customer | No row, no edit form, no detail | Automated: the User data path uses `customer_active` only; an inactive record does not appear in any User result. | Pass |
| CUS-20 | Add and Edit buttons follow individual rights | As USR-C1 with only edit_customer, then with only add_customer | Only the matching control appears | Automated: the page derives `canAdd` from `add_customer` and `canEdit` from `edit_customer` and exposes them to the server page; `s2-dev01` asserts `currentPath` and the rights hand-off. | Partial |
| CUS-21 | Direct URL without the module | As USR-C2, open `/erp/modules/customer` | Redirect or not-found, with no Customer data | Automated: the page redirects when unauthenticated and calls `notFound()` when the module is not assigned. Anonymous live probe: the page returned a redirect payload with no Customer content. | Pass |
| CUS-22 | Direct API without a session | `GET /api/customer?status=all`, `POST /api/customer`, `PATCH /api/customer/T0001/status` with no cookie | 401 for the read, 403 for the writes, nothing returned or changed | Live probe 2026-11-25: `GET` returned 401 `Sign in to continue.`; `POST` and `PATCH` returned 403 `Request not allowed.`; the same `POST` from `Origin: https://attacker.example` also returned 403. Automated: a cross-origin write is refused before authorization. | Pass |

---

## 5. Test Summary

| Area | Total | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| List, search, filters | 10 | 6 | 0 | 3 | 1 | 0 |
| Create and edit | 7 | 6 | 0 | 1 | 0 | 0 |
| Visibility and authorization | 5 | 4 | 0 | 1 | 0 | 0 |
| **Total** | **22** | **16** | **0** | **5** | **1** | **0** |

Counted 2026-11-25. No failure was observed. The Partial and Blocked cases share one cause: no approved test account was supplied, so the by-hand on-screen steps could not be performed on the deployed site.

---

## 6. Evidence

```bash
node --test tests/s2-dev01-customer-list.test.mjs
node --test tests/s2-dev02-customer-mutations.test.mjs
node --test tests/s2-dev03-customer-status.test.mjs
```

Result: 9, 12, and 9 tests, all passing, 0 failures.

Live probe commands and responses are recorded in `docs/test-cases/permission-matrix-test-cases.md` §4.2; the same anonymous probes cover `/api/customer`.

---

## 7. Defects Found

| Defect ID | Related case | Summary | Severity | Status |
|---|---|---|---|---|
| - | - | No defect observed in the executed cases. | - | - |

Rejected and blocked requests returned the documented codes and wrote nothing, so the tested boundary behaves as the Student Guide describes.

---

## 8. Notes and Blockers

- **Blocker:** no approved Superadmin, Admin, or User test account, so the list could not be opened and the on-screen search, filter, create, and edit steps were not performed. Supply one account per role with the matching rights and the five Partial cases plus CUS-01 can be finished in one session.
- **Safety:** no write request was sent to the production database. Create, edit, and status changes were verified at the handler and service level only; a live create must run in an isolated environment with disposable records.
- The Customer list defaults to `all` for managers and to `active` for Users. That matches the Student Guide but should be confirmed against the official screen specification.
