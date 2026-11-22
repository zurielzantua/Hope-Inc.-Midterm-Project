# S2-DBA-06 — Search and price-query performance findings

Issue: [#139](https://github.com/zurielzantua/Hope-Inc.-Midterm-Project/issues/139)

## Measurement setup

Plans and timings were collected with PostgreSQL 17.11 against a disposable
synthetic database. The measured dataset contained 9,089 customers, 12,066
products, and 132,093 price-history rows (including existing project fixtures).
The final local confirmation clone contained 24,010 future-effective active
price rows and 604 inactive rows (602 generated rows plus 2 existing fixture
rows). The source database was not used for benchmark writes.

The reproducible query-plan capture is
[`supabase/benchmarks/s2_dba_06_search_query_plans.sql`](../supabase/benchmarks/s2_dba_06_search_query_plans.sql).
It covers active and inactive Customer/Product substring searches, the scalar
as-of query, and the set-based price lookup. Run it only against an isolated
database with the prerequisite migrations and representative synthetic data.

## Findings and changes

| Path | Before | After / decision |
|---|---|---|
| Customer substring search with leading-wildcard `ILIKE` | Sequential scans; 5.3–6.8 ms at the tested size | No trigram or other search index. The measured latency did not justify its write/storage cost. |
| Product substring search with leading-wildcard `ILIKE` | Sequential scans; 5.9–8.2 ms at the tested size | No trigram or other search index. |
| One product's price as of a date | Existing `(effdate, prodcode)` key: 49 buffers / 1.092 ms for a representative lookup; the D5P001 case used 326 buffers / 4.962 ms | Added partial covering index `(prodcode, effdate DESC) INCLUDE (unitprice) WHERE NOT is_deleted`. The corresponding lookup used 4 buffers / 0.102 ms; D5P001 used 5 buffers / 0.027 ms. Measured index size: 5,232 kB. |
| Price for every active product | One scalar RPC per product causes request fan-out. A set-based query matched scalar results for 12,065 products, with 0 mismatches and 7 products without an eligible price. | Added the server-only `product_prices_as_of` set-returning function. In the local query benchmark, the set-based result took 36.3 ms with the index and 110.3 ms without it; invoking the scalar function per row in one SQL statement took 71.5 ms with the index. |

A separate 1,000-call, four-client `pgbench` run against randomized synthetic
products measured the scalar lookup at 1.033 ms average / 3,870 transactions
per second before the candidate index and 0.253 ms / 15,784 transactions per
second with it. These local PostgreSQL measurements support the index and
batching change; they are not Supabase HTTP latency measurements.

The initial set-based SQL query took 36.3 ms with the candidate index and
110.3 ms without it; invoking the scalar function once per product inside one
SQL statement took 71.5 ms with the index. In a later run, the first function
draft sorted the full history set, spilled to a temporary file, and took
105.6 ms. It was changed to deduplicate requested codes and use the covering
index for the latest-row lookup.

The final function was tested against 12,065 active products in a disposable
clone. The scalar-per-product query took 111.1 ms; the batch function took
77.1 ms with per-node timing disabled. Its matching lateral query plan used an
index-only scan and took 66.5 ms. The batch and scalar results had 0 mismatches;
7 products had no eligible price. This local run measures database execution,
not Supabase HTTP latency.

## Function and security contract

`public.product_prices_as_of(varchar(6)[], date)` returns at most one row per
requested product: the latest non-deleted price-history row effective on or
before the requested date. Duplicate codes do not duplicate output; missing,
future-only, and inactive-only histories produce no row. Empty or NULL inputs
produce no rows. If the latest eligible row has a NULL `unitprice`, the batch
returns that row with a NULL value, distinct from missing history. The function
reads `pricehist_active`, runs as the invoker, uses a pinned empty `search_path`,
and is executable only by `service_role`.
The migration does not change table grants or RLS policies.

## Regression checks

Run the focused contract test after migrations on an isolated disposable
database:

```bash
psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/s2_dba_06_product_prices_as_of.sql
```

The test checks scalar/batch equivalence, historical/current/future values,
inactive and missing prices, duplicate/empty/NULL inputs, invoker and view
security, function grants, RLS remaining enabled, and the partial covering
index definition. Test fixtures are rolled back.

## Limits

The workload is synthetic and local to PostgreSQL 17.11. Supabase Auth/JWT,
hosted RLS behavior, PostgREST request latency, production row distribution,
and production query plans were not measured. The new batch RPC is server-only;
application adoption must use a trusted server-side client.
