# S2-UIX-04 — Empty, Error and Confirm-Delete States

**Issue:** [#145](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/145)

**Figma file:** [HOPE ERP — S2-UIX-04 States](https://www.figma.com/design/bPy58K38J2a2SS33RpSpa9/HOPE-ERP-%E2%80%94-S2-UIX-04-States)

**Local source:** `docs/ui-ux/s2-uix-04-state-board.html`

**PNG preview:** `docs/ui-ux/s2-uix-04-state-board.png` (1440 × 1300)

## States covered

- Customer Admin list with no records and an Add Customer action.
- Product User search with no matching results and a Clear Search action.
- Product Price History with no records and an Admin Add Price action.
- Customer validation for a duplicate customer number and a missing name.
- Product save failure with safe, actionable retry text and preserved form values.
- Permission denial with a return path and no internal database details.
- Soft-delete confirmation variants for Customer, Product and Price History; Cancel leaves the row unchanged, and confirmation moves it to Inactive rather than permanently deleting it.
- Product and Customer error states use the implementation’s safe response wording.

The board follows the shipped HOPE palette and Aptos-first typography. The HTML source also includes working confirmation choices, cancel/confirm feedback and a retry message. It uses synthetic records only and performs no network or database writes.

## Figma and access note

The state board is placed as a PNG image inside a Figma frame in the existing Figma file. The connected Figma account had reached its Starter integration limit, so the frame is rasterized; the HTML source remains editable. No SVG files were created.

The file was moved from Gabriel’s Drafts into Gabriel A. Zantua’s **Team project** on 2026-11-23, with the operator’s approval. Figma showed one current team member, so the operator authorized a separate editor invitation for Elish. The Share panel now shows **Invite sent** with **can edit** permission. Elish must accept the invitation before edit access is active. The state-board link is available at the Figma URL above.
