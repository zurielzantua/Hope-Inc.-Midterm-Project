# S2-DBA-02 — Product price as of a date

## SQL contract

`public.product_price_as_of(p_prod_code varchar(6), p_as_of date) RETURNS numeric`

The function returns the `unitPrice` (`numeric(10,2)`) from the latest row in `public.pricehist_active` for the supplied product where `effDate <= p_as_of`. It returns SQL `NULL` when no active row qualifies or either argument is `NULL`. Future-dated rows are excluded until their effective date; soft-deleted rows are excluded by the active view.

Example:

```sql
SELECT public.product_price_as_of('PC0001', DATE '2010-06-01');
```

This is a server-only Supabase RPC using the same named arguments:

```ts
serverSupabase.rpc('product_price_as_of', {
  p_prod_code: 'PC0001',
  p_as_of: '2010-06-01',
})
```

`serverSupabase` must be created server-side with `createSupabaseAdminClient` and `SUPABASE_SECRET_KEY`.

The function is `STABLE` and `SECURITY INVOKER`, reads through the existing `security_invoker` view, and grants execution only to `service_role`; `PUBLIC`, `anon`, and `authenticated` cannot call it. No table grants or RLS policies are added.

`service_role` bypasses RLS. For every request, the server caller must freshly verify the signed-in identity and current account state, then authorize that actor for the target module and price-read action from trusted server-side data. `authorizeRequest()` is the existing account gate; it does not replace the module/right check. Do not reuse cached authorization or trust client-supplied roles, account states, or permissions. Never expose this RPC through a browser client. No application caller currently invokes this function.

## Validation

`supabase/tests/hope_product_price_as_of.sql` creates a unique product fixture with older, current, soft-deleted, and future price rows, verifies the as-of results while executing as `service_role`, checks the function/view security and execute grants, then rolls back the fixture and audit entries. Run it as an isolated database owner that can `SET ROLE service_role`.

The tracked migrations enable RLS on `pricehist` but define no `pricehist` read policy. The application’s existing server-side data path uses a secret-key Supabase client after server authorization; this function follows that server-only pattern and does not add a broad read policy.
