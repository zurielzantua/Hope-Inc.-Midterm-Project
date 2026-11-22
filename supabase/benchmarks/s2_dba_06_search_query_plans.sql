-- S2-DBA-06 read-only plan capture for the implemented Customer/Product list paths.
-- Run only in an isolated database with representative synthetic data and all
-- prerequisite migrations applied. The small seed alone is too small to support
-- a performance conclusion. Connect as an owner able to SET ROLE.
-- The measured PostgreSQL 17.11 fixture had 9,089 customers, 12,066 products,
-- and 132,093 price rows. Leading-wildcard ILIKE scans took 5.3-8.2 ms, so no
-- substring-search index was justified. The product/date covering index and
-- batch RPC findings are recorded in docs/s2-dba-06-query-performance.md.
--
-- Example:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/benchmarks/s2_dba_06_search_query_plans.sql
--
-- These statements mirror the server adapters' active/inactive filters,
-- substring searches and ordering. They execute as service_role, like the
-- server's service-key queries. No rows, indexes, or schema are changed.

\set ON_ERROR_STOP on

BEGIN;
SET LOCAL ROLE service_role;

\echo 'Customer User: active-view substring search and customer-number ordering'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT custno, custname, address, payterm
  FROM public.customer_active
 WHERE custno ILIKE '%D5C01%'
    OR custname ILIKE '%D5C01%'
    OR address ILIKE '%D5C01%'
    OR payterm ILIKE '%D5C01%'
 ORDER BY custno ASC;

\echo 'Customer Admin: active search on the base table'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT custno, custname, address, payterm, is_deleted, stamp
  FROM public.customer
 WHERE is_deleted = false
   AND (custno ILIKE '%D5C01%'
     OR custname ILIKE '%D5C01%'
     OR address ILIKE '%D5C01%'
     OR payterm ILIKE '%D5C01%')
 ORDER BY custno ASC;

\echo 'Customer Admin: inactive search on the base table'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT custno, custname, address, payterm, is_deleted, stamp
  FROM public.customer
 WHERE is_deleted = true
   AND (custno ILIKE '%D5C01%'
     OR custname ILIKE '%D5C01%'
     OR address ILIKE '%D5C01%'
     OR payterm ILIKE '%D5C01%')
 ORDER BY custno ASC;

\echo 'Customer Admin: all-status search on the base table'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT custno, custname, address, payterm, is_deleted, stamp
  FROM public.customer
 WHERE custno ILIKE '%D5C01%'
    OR custname ILIKE '%D5C01%'
    OR address ILIKE '%D5C01%'
    OR payterm ILIKE '%D5C01%'
 ORDER BY custno ASC;

\echo 'Product User: active-view substring search and product-code ordering'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT prodcode, description, unit
  FROM public.product_active
 WHERE prodcode ILIKE '%D5P001%'
    OR description ILIKE '%D5P001%'
    OR unit ILIKE '%D5P001%'
 ORDER BY prodcode ASC;

\echo 'Product Admin: active-view substring search'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT prodcode, description, unit, is_deleted, stamp
  FROM public.product_active
 WHERE prodcode ILIKE '%D5P001%'
    OR description ILIKE '%D5P001%'
    OR unit ILIKE '%D5P001%'
 ORDER BY prodcode ASC;

\echo 'Product Admin: inactive base-table search'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT prodcode, description, unit, is_deleted, stamp
  FROM public.product
 WHERE is_deleted = true
   AND (prodcode ILIKE '%D5P004%'
     OR description ILIKE '%D5P004%'
     OR unit ILIKE '%D5P004%')
 ORDER BY prodcode ASC;

\echo 'Product Admin: all-status base-table search'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT prodcode, description, unit, is_deleted, stamp
  FROM public.product
 WHERE prodcode ILIKE '%D5P001%'
    OR description ILIKE '%D5P001%'
    OR unit ILIKE '%D5P001%'
 ORDER BY prodcode ASC;

\echo 'Current-price query used by product_price_as_of'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT unitprice
  FROM public.pricehist_active
 WHERE prodcode = 'D5P001'
   AND effdate <= DATE '2026-11-22'
 ORDER BY effdate DESC
 LIMIT 1;

\echo 'Current-price RPC invoked by the Product list once per returned Product'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT public.product_price_as_of('D5P001', DATE '2026-11-22');

\echo 'Set-based current-price RPC for all active products'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT count(*) AS products_with_an_effective_price,
       count(unitprice) AS returned_prices
  FROM public.product_prices_as_of(
      ARRAY(
          SELECT p.prodcode::varchar(6)
            FROM public.product_active AS p
           ORDER BY p.prodcode
      ),
      DATE '2026-11-22'
  );

\echo 'Index plan used by the set-based current-price lookup'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH requested AS (
    SELECT DISTINCT input.prodcode
      FROM pg_catalog.unnest(
          ARRAY(
              SELECT p.prodcode::varchar(6)
                FROM public.product_active AS p
          )
      ) AS input(prodcode)
)
SELECT requested.prodcode, latest.unitprice
  FROM requested
 CROSS JOIN LATERAL (
      SELECT ph.unitprice
        FROM public.pricehist_active AS ph
       WHERE ph.prodcode = requested.prodcode
         AND ph.effdate <= DATE '2026-11-22'
       ORDER BY ph.effdate DESC
       LIMIT 1
  ) AS latest;

ROLLBACK;
