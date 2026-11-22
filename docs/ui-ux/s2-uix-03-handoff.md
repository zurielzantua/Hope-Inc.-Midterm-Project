# S2-UIX-03 — Customer, Product, and Price History high-fidelity handoff

**Issue:** [#151 — Hi-fi mockups and handoff notes](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/151)

**Status:** Prepared for UI/UX owner review; not yet approved.
**Reference requirements:** Student Guide §§3.3–3.4, [Customer wireframes](s2-customer-wireframes.md), and [Product and Price History wireframes](s2-product-price-wireframes.md).

These PNGs refine the merged S2-UIX-01/02 wireframes using HOPE ERP's existing visual tokens. They are design previews only; they do not claim that the screens are implemented or tested. Only Customer, Product, and Price History are shown.

## Mockup previews

| View | High-fidelity PNG |
|---|---|
| Customer list — Admin | [s2-uix-03-customer-admin.png](s2-uix-03-customer-admin.png) |
| Customer list — permitted User | [s2-uix-03-customer-user.png](s2-uix-03-customer-user.png) |
| Add Customer | [s2-uix-03-customer-add.png](s2-uix-03-customer-add.png) |
| Edit Customer — Admin | [s2-uix-03-customer-edit.png](s2-uix-03-customer-edit.png) |
| Product list — Admin | [s2-uix-03-product-admin.png](s2-uix-03-product-admin.png) |
| Product list — permitted User | [s2-uix-03-product-user.png](s2-uix-03-product-user.png) |
| Add Product | [s2-uix-03-product-add.png](s2-uix-03-product-add.png) |
| Edit Product — Admin | [s2-uix-03-product-edit.png](s2-uix-03-product-edit.png) |
| Price History dialog — Admin | [s2-uix-03-price-history-admin.png](s2-uix-03-price-history-admin.png) |
| Price History dialog — permitted User | [s2-uix-03-price-history-user.png](s2-uix-03-price-history-user.png) |
| Add Price dialog | [s2-uix-03-price-add.png](s2-uix-03-price-add.png) |
| Edit Price dialog | [s2-uix-03-price-edit.png](s2-uix-03-price-edit.png) |

## Visual system and layout

The previews use the established light ERP shell and Aptos/Segoe UI interface typography. The Deep Harbor header anchors the screen; Harbor Teal marks the active module and primary actions; Brushed Bronze is a restrained accent. Cloud backgrounds, white work surfaces, and fine gray-green borders preserve contrast and keep data tables readable.

| Token | Value | Use |
|---|---|---|
| Deep Harbor | `#163341` | Application header, primary text emphasis, selected page actions |
| Harbor Teal | `#0B6E75` | Active navigation, primary actions, interactive links |
| Brushed Bronze | `#C28C58` | Header accent, role badge, secondary emphasis |
| Cloud | `#F4F7F8` | Page background |
| White | `#FFFFFF` | Navigation rail, forms, tables, dialogs |
| Ink | `#1A2B35` | Main text |
| Muted | `#60757F` | Supporting text and labels |
| Line | `#DAE4E6` | Input, table, and section borders |
| Success | `#237856` | Active status and Restore action |
| Inactive surface | `#EAF0F1` | Admin-only soft-deleted rows |

Desktop reference frame is 1440 × 960 px. The header is 74 px high, the left navigation rail is 246 px wide, and content begins with 30–38 px page padding. Use an 8 px spacing rhythm (8/16/24/32 px), 6–10 px control/card radii, 44–46 px controls, and left-aligned headings and forms. Tables use a quiet header row, 61–70 px data rows, and compact action links. The 1 px bronze/teal header rule is the primary decorative detail.

### Component variants

- **Application shell:** header, role badge, two-module navigation, breadcrumb, page heading, subtitle. Active navigation uses a pale teal fill and teal edge marker.
- **Admin list:** Active / Inactive / All filters with counts; Status and Stamp columns; inactive rows shaded; Restore replaces Delete for inactive rows.
- **Permitted User list:** active rows only; no status filters, Status column, or Stamp column. The screenshots show an example account granted the visible actions; omit each action when its matching right is absent.
- **Forms:** shared add/edit card with paired fields where space allows, labels above controls, required markers, helper text, and Cancel plus a specific Save action. Edit forms lock the identity field. Admin edit forms may show status/stamp as read-only system metadata; User forms must not expose those fields.
- **Price History:** modal dialog over Product Management. Admin variant includes status filters and Status/Stamp; permitted User variant contains active rows only and omits those fields.
- **Price form:** focused dialog state replacing the history table. Edit locks Effective Date; a new effective date is created through Add Price.
- **Actions:** teal primary, white bordered secondary, restrained red Delete, green Restore. Delete means soft delete and uses the confirmation state specified by the later S2-UIX-04 handoff.

## Navigation and behavior

The sidebar contains only Customer Management and Product Management for this Sprint 2 design. Customer screens select Customer Management. Product and price screens select Product Management; Price History is shown as a contextual child state and its dialog breadcrumb identifies the product. Do not add Human Resources, Sales, Reports, or other later-sprint modules to these screens.

`Prices` opens Price History for the selected product. The history dialog closes through its close control or Close action; backdrop interaction does not dismiss it. Add/Edit Price use the focused form dialog, with Back to history returning to the same product history. Keep focus within an open dialog and restore it to the invoking action when closed. If a form has unsaved changes, do not silently discard them; align its discard prompt with the shared confirmation behavior when that state is designed.

The current price is the latest active history row whose Effective Date is on or before the as-of date. Future-dated entries remain visible in history but do not become current early. Show `—` when no qualifying active row exists. The previews use November 22, 2026 as their sample as-of date.

## Fields and permissions

Field constraints follow the current wireframes and repository schema. The UI must retain server-side validation as authoritative.

| Screen | Field label | Input / rule |
|---|---|---|
| Customer | Customer No. | Required, unique, 5 characters; immutable after create |
| Customer | Customer Name | Required; up to 20 characters in the current base schema |
| Customer | Address | Required in the approved wireframe; up to 50 characters in the current base schema |
| Customer | Pay Terms | Required select: `COD`, `30D`, `45D` |
| Product | Product Code | Required, unique, 6 characters; immutable after create |
| Product | Description | Required in the approved wireframe; up to 30 characters in the current base schema |
| Product | Unit | Required select: `pc`, `ea`, `mtr`, `pkg`, `ltr` |
| Price History | Effective Date | Required date; Product Code + date identify a history row |
| Price History | Unit Price | Required positive amount, shown to two decimal places |

| Action | Required right / visibility |
|---|---|
| Add Customer | `add_customer` |
| Edit Customer | `edit_customer` |
| Delete (soft-delete) Customer | `delete_customer` |
| Restore Customer | Shown in the Admin view per Student Guide §3.3; the existing UIX-01 handoff expects a separate right, but the current catalogue has no restore code |
| Add Product | `add_product` |
| Edit Product | `edit_product` |
| Delete (soft-delete) Product | `delete_product` |
| Restore Product | Shown in the Admin view per Student Guide §3.4; the current catalogue has no restore code |
| Add Price | `add_price` |
| Edit Price | `edit_price` |
| Delete (soft-delete) Price | `delete_price` |
| Open Product / Price History | Product module access; each mutation remains separately right-checked |

Admin visibility is governed by the role. The permitted User previews show an example account with the displayed Customer, Product, and Price actions granted; they do not imply that every User has every right. Authorization must be enforced by the server; hiding a control is only a presentation rule.

**Restore contract to resolve before implementation:** S2-UIX-01 describes Restore as separately permissioned, but the current `right_catalog` defines only the matching `delete_customer` / `delete_product` rights and has no restore-specific codes. The mockups place Restore only in Admin views. The Developer and DB Admin should confirm whether Admin role alone governs Restore or whether a reviewed rights change is required; do not invent a client-side right name.

## Developer handoff boundary

Use the PNGs as screen references and the tables above as the field, layout, and role-visibility contract. Keep current-price calculation derived from Price History rather than storing a duplicate Product field. Preserve soft-deleted rows for Admin review and linked records. Do not expose Admin-only status/stamp metadata in User views.

Loading, empty, error, and delete-confirmation visuals are intentionally not included here; they are assigned to S2-UIX-04. This deliverable contains no SVG files and changes no application behavior, database schema, or Tester-owned artifacts.
