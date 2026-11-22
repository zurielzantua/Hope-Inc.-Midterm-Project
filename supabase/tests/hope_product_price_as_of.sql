-- S2-DBA-02 current-price query regression test.
-- Run against a disposable database after all migrations:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hope_product_price_as_of.sql
-- Connect as a database owner able to SET ROLE service_role.
-- All fixture rows and their audit entries are rolled back.

\set ON_ERROR_STOP on
SELECT 'Z' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 5)) AS fixture_prod_code \gset

BEGIN;

SELECT pg_catalog.set_config('hope.s2_dba_02.fixture_prod_code', :'fixture_prod_code', true);

INSERT INTO public.product (prodcode, description, unit)
VALUES (:'fixture_prod_code', 'DBA-02 regression fixture', 'ea');

INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
VALUES
    (DATE '2024-01-01', :'fixture_prod_code', 10.00, false),
    (DATE '2025-01-01', :'fixture_prod_code', 12.50, false),
    (DATE '2025-06-01', :'fixture_prod_code', 15.00, true),
    (DATE '2026-01-01', :'fixture_prod_code', 19.99, false);

DO $test$
DECLARE
    v_function regprocedure := 'public.product_price_as_of(character varying,date)'::regprocedure;
BEGIN
    IF pg_catalog.pg_get_function_result(v_function) <> 'numeric'
       OR (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid = v_function)
       OR NOT (SELECT proisstrict AND provolatile = 's' FROM pg_catalog.pg_proc WHERE oid = v_function) THEN
        RAISE EXCEPTION 'price-as-of function must be strict, stable, return numeric, and run as invoker';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_catalog.pg_class
         WHERE oid = 'public.pricehist_active'::regclass
           AND reloptions @> ARRAY['security_invoker=true']
    ) THEN
        RAISE EXCEPTION 'pricehist_active must remain a security-invoker view';
    END IF;

    IF NOT pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE') THEN
        RAISE EXCEPTION 'price-as-of execute must be granted only to service_role';
    END IF;
END;
$test$;

SET LOCAL ROLE service_role;

DO $test$
DECLARE
    v_prod_code varchar(6) := pg_catalog.current_setting('hope.s2_dba_02.fixture_prod_code');
    v_price numeric;
BEGIN
    SELECT public.product_price_as_of(v_prod_code, DATE '2023-12-31') INTO v_price;
    IF v_price IS NOT NULL THEN
        RAISE EXCEPTION 'expected NULL when no price is effective by the requested date';
    END IF;

    SELECT public.product_price_as_of(v_prod_code, DATE '2024-06-01') INTO v_price;
    IF v_price IS DISTINCT FROM 10.00::numeric THEN
        RAISE EXCEPTION 'expected older price 10.00, got %', v_price;
    END IF;

    SELECT public.product_price_as_of(v_prod_code, DATE '2025-01-01') INTO v_price;
    IF v_price IS DISTINCT FROM 12.50::numeric THEN
        RAISE EXCEPTION 'expected current price 12.50, got %', v_price;
    END IF;

    SELECT public.product_price_as_of(v_prod_code, DATE '2025-12-31') INTO v_price;
    IF v_price IS DISTINCT FROM 12.50::numeric THEN
        RAISE EXCEPTION 'inactive and future rows changed the as-of result: %', v_price;
    END IF;

    SELECT public.product_price_as_of(v_prod_code, DATE '2026-02-01') INTO v_price;
    IF v_price IS DISTINCT FROM 19.99::numeric THEN
        RAISE EXCEPTION 'expected future row after its effective date, got %', v_price;
    END IF;

    IF public.product_price_as_of(v_prod_code, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'NULL requested date must return NULL';
    END IF;
    IF public.product_price_as_of(NULL, DATE '2025-01-01') IS NOT NULL THEN
        RAISE EXCEPTION 'NULL product code must return NULL';
    END IF;
END;
$test$;

ROLLBACK;
