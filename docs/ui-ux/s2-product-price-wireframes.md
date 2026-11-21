# S2-UIX-02 — Product and Price History wireframes

**Issue:** [#158 — Wireframes: product and price history screens](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/158)

## Screens

- [Product List — Admin](s2-product-list-admin.svg): Active/Inactive/All, Status, Stamp, Price, and rights-controlled Prices/Edit/Soft delete/Restore actions.
- [Product List — User](s2-product-list-user.svg): active products only, no Status/Stamp, and `—` when no eligible current price exists.
- [Add Product](s2-product-add.svg) and [Edit Product](s2-product-edit.svg): code, description, unit, role metadata, and product rights.
- [Price History — Admin](s2-price-history-admin.svg) and [User](s2-price-history-user.svg): effective-date rows, role-specific metadata, and current-price behavior.
- [Add Price](s2-price-add.svg) and [Edit Price](s2-price-edit.svg): selected product, effective date, unit price, and validation notes.

## Developer handoff

Product fields are Prod Code, Description and Unit; permitted units are `pc`, `ea`, `mtr`, `pkg`, and `ltr`. Current price is the latest active price effective on or before today; future-dated rows do not replace it, and `—` is shown when no eligible row exists. User views omit soft-deleted records and Status/Stamp. Admin inactive rows are shaded.

Price controls map to existing `add_price`, `edit_price`, and `delete_price` rights. Product controls map to `add_product`, `edit_product`, and `delete_product`; soft-delete restore remains an authorized administrative operation. Price edit preserves Product Code and Effective Date as the composite history identity; a new date period uses Add Price.

These SVGs are editable vector wireframes, not proof that the screens or price logic are implemented.
