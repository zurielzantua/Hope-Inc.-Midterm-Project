# S2-UIX-05 — Usability Review

**Reviewed:** 2026-11-23

**Issue:** [#138 — Usability review of built screens](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/138)

**Implementation snapshot reviewed:** `test/sprint2-integration` at `0cff7a82efa0f9171396d40fe47f42341dfa6e32`

## Scope and method

Compared the approved Customer, Product, and Price History PNG mockups under `docs/ui-ux/` with the Sprint 2 module routes and a local interactive review prototype. The prototype uses synthetic in-memory records and does not connect to the ERP or save data. It was exercised in Orca's browser; screenshots were captured at 1440×1000 and 390×844.

The implementation source was inspected in `app/erp/modules/customer/page.tsx`, `app/erp/modules/product/page.tsx`, `app/erp/modules/product/[prodCode]/price-history/page.tsx`, `app/erp/erp-shell.tsx`, and the customer/product status action components.

The actual application was not browser-tested with an authenticated Supabase session. The local PostgreSQL test shim does not provide Supabase Auth. No Tester issue, report, or test result was produced for this review.

## Findings

| Finding | Severity / status | Evidence and related implementation issue |
|---|---|---|
| Product users need an obvious route from a product to its prices. The approved user mockup gives Price History its own column. The review prototype now matches it, and the implementation route already renders a separate Price History column. | Low — addressed in prototype; confirmed in source | [Product user, mobile](s2-uix-05-review/product-user-mobile.png); [S2-DEV-04 #150](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/150), [S2-DEV-08 #137](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/137) |
| Price History should explain which record sets the current price. The prototype now shows the latest active effective date; an added future price remains in history without changing the current price. The implementation page also shows the as-of date and latest effective date. | Low — addressed in prototype; confirmed in source | [Price History, Admin](s2-uix-05-review/price-history-admin.png); [S2-DEV-08 #137](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/137), [S2-DBA-02 #155](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/155) |
| At 390px, the prototype navigation initially clipped the Price History label. It now wraps all three links; the capture shows every label. The actual ERP shell also uses a wrapping navigation layout. | Low — resolved in prototype; implementation layout confirmed in source | [Product user, mobile](s2-uix-05-review/product-user-mobile.png); [S2-UIX-05 #138](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/138) |
| A product with active related records must remain active. The delete confirmation in the prototype displays the block reason; the implementation status action surfaces server errors with `role="alert"`. | No defect found in source review; runtime request not exercised | [Blocked product delete](s2-uix-05-review/product-delete-blocked.png); [S2-DEV-06 #144](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/144), [S2-DBA-04 #148](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/148) |
| Customer search with no matches provides a clear next step. Duplicate customer numbers show a specific error and preserve entered values in the prototype. The actual customer route has a no-results state; its form behavior was source-reviewed only. | Prototype behavior verified; actual form submission unverified | [Customer empty state](s2-uix-05-review/customer-empty-admin.png), [Duplicate validation](s2-uix-05-review/customer-duplicate-validation.png); [S2-DEV-01 #160](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/160), [S2-DEV-02 #157](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/157) |
| Customer, Product, and Price History tables preserve their column layout with horizontal scrolling on narrow screens in the implementation. This remains a small-screen follow-up for human review; no card conversion is proposed without observing the actual app. | Low — follow-up for authenticated mobile review | Source: the customer/product/price-history pages use `overflow-x-auto` with minimum table widths. Recheck against [S2-DEV-01 #160](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/160), [S2-DEV-04 #150](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/150), and [S2-DEV-07 #141](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/141). |

## Prototype interaction checks

- Customer Active, Inactive, and All filters; Admin restore visibility; User mutation controls hidden.
- Product search empty state and role-dependent action visibility.
- Price History current-price calculation, future-dated record behavior, duplicate effective-date validation, edit/cancel navigation, and soft-delete history retention.
- Duplicate customer number validation preserves the form values.
- Product deactivation with active related records remains blocked and explains why.
- Responsive navigation and stacked product rows at 390px.

These checks used synthetic prototype data only. They are not production, database, or Tester acceptance results.

## Follow-up and acceptance limits

The implementation's authenticated browser behavior, Supabase RLS/API requests, and small-screen scrolling with real account permissions remain unverified. The human Tester retains all official Sprint 2 test issues. This review does not claim those checks passed, and issue #138 still requires teammate review and merge before it is Done.
