# HOPE Inc. ERP – Product Management and Price History Test Cases (S2-TST-02)

**Role:** Tester
**Related issue:** #149 – Product and Price History Testing
**Application routes:** `/erp/modules/product` and `/erp/modules/product/[prodCode]/price-history`
**Environment:** Deployed site https://hope-erp-phi.vercel.app (integration commit `6f229eb`) and source-level automated tests on the same commit
**Execution date:** 2026-11-25
**Execution status:** 28 cases. 22 Pass from automated and live evidence. 5 Partial: the rule is proven in the handler but the by-hand screen step was not performed. 1 Blocked: the Product list could not be opened without an approved test account.

> **Status legend:** Pass / Fail / Partial / Blocked / Not Run
> Nothing here is marked Pass because a deployment check was green. A Pass means the behavior ran: an automated test asserted it, or a live request returned the recorded response.

---

## 1. Environment and Test Data

| Item | Value |
|---|---|
| Application commit | `6f229eb` |
| Automated suites | `tests/s2-dev04-product-list.test.mjs` (14), `tests/s2-dev05-product-mutations.test.mjs` (10), `tests/s2-dev06-product-status.test.mjs` (7), `tests/s2-dev07-price-history.test.mjs` (11) – 42 tests, 0 failures |
| Price fixtures | Seeded records `D5P001` (historical + current), `D5P002` (future-dated only), `D5P003` (no price), `D5P004` (inactive), all defined in `supabase/seed.sql` with fixed dates |
| Live probes | Anonymous requests to the deployed site, response codes recorded |

The seed file gives controlled historical, current, future, and missing-price records without depending on the run date, which is exactly what S2-TST-02 asks for. Those records live in the disposable local database described in `supabase/README.md`.

---

## 2. Product Management

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| PRD-01 | Product list loads | Open `/erp/modules/product` as ADM-P | Rows show code, description, unit, current price, and Status and Stamp for managers | Anonymous probe: the page returns a redirect payload and renders no Product content. Live list not exercised. | Blocked |
| PRD-02 | Search by code, description, and unit | Search `D5P001`, `Widget`, `mtr` | The matching products are returned | Automated: the search filter targets `prodcode`, `description`, and `unit` as quoted `ilike` literals. | Pass |
| PRD-03 | Search is safely quoted | Search `x),status.eq.false` and `100%_` | The value cannot add its own filter terms | Automated: the generator escapes `%`, `_`, quotes, and backslashes; a hostile string stays inside one quoted literal. | Pass |
| PRD-04 | Active / Inactive / All filters | As ADM-P, choose each | Correct rows for each filter; default is `all` for managers | Automated: manager reads use `product_active` for Active and the authorized `product` table for Inactive and All. | Pass |
| PRD-05 | User cannot see inactive products | As USR-P, request `?status=all` and `?status=inactive` | 403 or active-only results; never an inactive product | Automated: a User sending any non-active status is refused with 403, and the User read path is pinned to `product_active`. | Pass |
| PRD-06 | Invalid search input is rejected | `?q=` with 101 characters, repeated `q`, a control character | 400, no-store, no query | Automated: all rejected with 400 and `Cache-Control: private, no-store`, and no data query runs. | Pass |
| PRD-07 | Create a product | As USR-P with add_product, POST a valid 6-character code, description, and unit | 201 and the product is stored | Automated: the handler requires the Product module and `add_product` before any write, normalizes the code, and returns 201. A live write was deliberately not sent to production. | Partial |
| PRD-08 | Create is denied without the right | As USR-P2 with no right, POST the same body | 403 and no write | Automated: a missing module, a missing `add_product`, or no session returns 401/403 before the write function runs. Live anonymous probe returned 403 `Request not allowed.` | Pass |
| PRD-09 | Duplicate product code | Create an existing code | 409 "That product code is already in use." | Automated: the unique violation `23505` maps to the 409 message. | Pass |
| PRD-10 | Missing and invalid fields | Omit a field; send a 5-character code; send `unit: 'box'`; send an extra field; send a 31-character description | 400, no write | Automated: every variant is rejected with 400 before the write function runs. | Pass |
| PRD-11 | Edit preserves identity | As USR-P, edit `D5P001` and try to send `productCode`, `status`, `stamp`, or `is_deleted` | 200 for the allowed fields; identity, Status, and Stamp rejected | Automated: Edit accepts exactly `description` and `unit`, and rejects client-supplied generated fields. | Pass |
| PRD-12 | Edit an inactive product as a User | As USR-P, edit an inactive product | Not found | Automated: the User edit path reads the active view, so inactive rows are not found. | Pass |
| PRD-13 | Data persists across a reload | Create, then reload the list | The new row appears | Automated: the service writes only the product fields, and the list read path sees the row afterwards. Live reload not exercised. | Partial |
| PRD-14 | Status and Stamp visibility | Compare the manager and User list responses | Status and Stamp for managers only | Automated: `is_deleted` and `stamp` are selected only for manager reads; the User payload contains neither. | Pass |

---

## 3. Price History

| ID | Test case | Steps | Expected result | Actual result | Status |
|---|---|---|---|---|---|
| PHS-01 | Open Price History from a product row | Click Prices on a row | The history page opens with the product header and the current price | Live anonymous probe: `/erp/modules/product/D5P001/price-history` redirects and renders no page content. Automated: the page gates on the Product module before reading anything. | Blocked |
| PHS-02 | Add a price | As USR-P with add_price, POST a future-dated price with a positive amount | 201, and the record is listed | Automated: add requires Product access and `add_price`, validates the exact field set, and returns 201. Live write not sent to production. | Partial |
| PHS-03 | Edit a price | As USR-P with edit_price, PATCH the amount on a date | 200, and the effective date and product stay the same | Automated: Edit preserves the Product and Effective Date identity and rejects identity fields supplied by the client. | Pass |
| PHS-04 | Soft-delete a price | As USR-P with delete_price, PATCH it inactive | 200, and the record leaves the active list | Automated: soft delete requires `delete_price` and accepts only the delete transition (`isDeleted: true`). | Pass |
| PHS-05 | Effective-date validation | Send `2026-02-30`, `2026-13-01`, `26-1-1`, an empty date | 400 for each, no write | Automated: the date validator rejects impossible dates, wrong shapes, and month/day overflow, including the leap-year rule. | Pass |
| PHS-06 | Duplicate product and effective date | Add a second price on the same product and date | 409 "A price record already exists for that Product and Effective Date." | Automated: the composite unique violation maps to that 409 message. | Pass |
| PHS-07 | Invalid price values | Send `0`, `-1`, `12.345`, `123456789`, an empty value, a numeric type | 400 for each | Automated: the amount validator rejects nonpositive, oversized, excessive-precision, and non-string values; a valid amount is normalized to two decimals. | Pass |
| PHS-08 | Historical prices are preserved | Edit a current price, then reopen the history | Older rows are unchanged and still shown | Automated: Edit writes only the requested row's amount; no historical row is rewritten by that call. Live screen comparison not performed. | Partial |
| PHS-09 | Future prices are excluded from the current price | Product `D5P002` has only a future price | The current price is empty and the future row is still listed | Automated: the as-of RPC receives today's Manila date, and the page keeps "no eligible price" distinct from a data failure. | Pass |
| PHS-10 | Inactive prices are excluded | Deactivate the newest price | The current price falls back to the newest active row on or before today | Automated: `priceDateFromRecords` filters out inactive rows and picks the latest remaining row at or before the as-of date. | Pass |
| PHS-11 | Price as of a chosen date | Ask for the price as of an earlier date | The newest active price on or before that date is returned | Automated: the as-of filter is `effectiveDate <= asOfDate`, so an earlier date returns the earlier row. | Pass |
| PHS-12 | Product with no eligible price shows a dash | Product `D5P003`, which has no price | The list shows a dash, not an error and not `0` | Automated: a null current price renders the dash and stays distinct from a batch RPC failure. | Pass |
| PHS-13 | Adding to an inactive product is refused | As USR-P, add a price to an inactive product | 404 or 409, no write | Automated: add and edit both refuse an inactive parent, and the database trigger error `active_parent_required` maps to a 409 `INACTIVE_PARENT`. | Pass |
| PHS-14 | Independent price rights | As USR-P with add_price but no edit_price, try both | Add works, Edit returns 403 | Automated: each of `add_price`, `edit_price`, and `delete_price` is checked separately, and the missing right returns 403. | Pass |

---

## 4. Test Summary

| Area | Total | Pass | Fail | Partial | Blocked | Not Run |
|---|---|---|---|---|---|---|
| Product Management | 14 | 11 | 0 | 2 | 1 | 0 |
| Price History | 14 | 11 | 0 | 2 | 1 | 0 |
| **Total** | **28** | **22** | **0** | **4** | **2** | **0** |

Counted 2026-11-25. No failure was observed. Both Blocked cases are the two page loads; every Partial case is a handler rule proven by an automated test whose on-screen step needs a signed-in account.

---

## 5. Evidence

```bash
node --test tests/s2-dev04-product-list.test.mjs
node --test tests/s2-dev05-product-mutations.test.mjs
node --test tests/s2-dev06-product-status.test.mjs
node --test tests/s2-dev07-price-history.test.mjs
```

Result: 14, 10, 7, and 11 tests, all passing, 0 failures. The price-as-of behavior is also covered by `supabase/tests/hope_product_price_as_of.sql` and `supabase/tests/s2_dba_06_product_prices_as_of.sql`, which run in the disposable database rather than against the deployment.

Live probes 2026-11-25: `GET /api/product?status=all` returned 401; `POST /api/product` returned 403, and the same `POST` from `Origin: https://attacker.example` returned 403; `GET /api/product/TP999/price-history` returned 405 because that route only exports a POST.

---

## 6. Defects Found

| Defect ID | Related case | Summary | Severity | Status |
|---|---|---|---|---|
| OBS-03 (observation) | PHS-01 | `GET` on the price-history route returns 405 rather than a page redirect, because the route is write-only. This is correct for the API and not a defect; it is recorded so a future reader does not mistake the 405 for a broken page. | Informational | Closed – by design |

No product or price-history defect was observed in the executed cases.

---

## 7. Notes and Blockers

- **Blocker:** no approved test account, so PRD-01 and PHS-01 (the two screen loads) could not be performed. One Admin account with the Product module makes both available in a single session.
- **Safety:** no create or edit was sent to the production database. Those cases were proven at the handler level; a live create needs the disposable records the DB Admin prepares.
- The list search covers `prodcode`, `description`, and `unit` only. The Student Guide's list specification should be checked if it expects the current price to be searchable too.
