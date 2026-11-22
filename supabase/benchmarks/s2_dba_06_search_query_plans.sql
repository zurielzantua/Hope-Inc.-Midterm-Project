-- S2-DBA-06 read-only plan capture for the implemented Customer/Product list paths.
-- Run only in an isolated database with representative synthetic data and all
-- prerequisite migrations applied. The 3-customer/5-product seed is too small
-- to support a performance conclusion. Connect as an owner able to SET ROLE.
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

ROLLBACK;
