-- S2-DBA-06 regression test for the set-based price lookup and measured index.
-- Run on an isolated disposable database after all migrations:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s2_dba_06_product_prices_as_of.sql
-- Connect as a database owner able to SET ROLE service_role. All fixtures roll back.

\set ON_ERROR_STOP on
SELECT 'D' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 4)) AS fixture_prefix \gset

BEGIN;
SELECT pg_catalog.set_config('hope.s2_dba_06.fixture_prefix', :'fixture_prefix', true);

INSERT INTO public.product (prodcode, description, unit)
VALUES
    ((:'fixture_prefix'::text || '1')::varchar(6), 'DBA-06 batch 1', 'ea'),
    ((:'fixture_prefix'::text || '2')::varchar(6), 'DBA-06 batch 2', 'ea'),
    ((:'fixture_prefix'::text || '3')::varchar(6), 'DBA-06 batch 3', 'ea'),
    ((:'fixture_prefix'::text || '4')::varchar(6), 'DBA-06 batch 4', 'ea'),
    ((:'fixture_prefix'::text || '5')::varchar(6), 'DBA-06 batch 5', 'ea'),
    ((:'fixture_prefix'::text || '6')::varchar(6), 'DBA-06 batch 6', 'ea');

INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
VALUES
    (current_date - 30, (:'fixture_prefix'::text || '1')::varchar(6), 10.00, false),
    (current_date - 5,  (:'fixture_prefix'::text || '1')::varchar(6), 20.00, false),
    (current_date - 3,  (:'fixture_prefix'::text || '1')::varchar(6), 25.00, true),
    (current_date + 10, (:'fixture_prefix'::text || '1')::varchar(6), 30.00, false),
    (current_date + 10, (:'fixture_prefix'::text || '2')::varchar(6), 40.00, false),
    (current_date - 10, (:'fixture_prefix'::text || '3')::varchar(6), 50.00, true),
    (current_date - 2,  (:'fixture_prefix'::text || '5')::varchar(6), 15.00, false),
    (current_date - 2,  (:'fixture_prefix'::text || '6')::varchar(6), NULL, false);

DO $test$
DECLARE
    v_function regprocedure := 'public.product_prices_as_of(character varying[],date)'::regprocedure;
    v_index oid := 'public.pricehist_active_prod_effdate_unitprice_idx'::regclass;
    v_index_def text;
BEGIN
    IF NOT (SELECT proretset AND proisstrict AND provolatile = 's' AND NOT prosecdef
              FROM pg_catalog.pg_proc WHERE oid = v_function) THEN
        RAISE EXCEPTION 'batch function must be a strict, stable set-returning SECURITY INVOKER function';
    END IF;

    IF NOT (SELECT proconfig @> ARRAY['search_path=""']
              FROM pg_catalog.pg_proc WHERE oid = v_function)
       OR NOT (SELECT prosrc ILIKE '%public.pricehist_active%'
                 FROM pg_catalog.pg_proc WHERE oid = v_function) THEN
        RAISE EXCEPTION 'batch function must pin an empty search_path and read pricehist_active';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class
         WHERE oid = 'public.pricehist_active'::regclass
           AND reloptions @> ARRAY['security_invoker=true']
    ) OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
               WHERE oid = 'public.pricehist'::regclass) THEN
        RAISE EXCEPTION 'price-history invoker view or base-table RLS is missing';
    END IF;

    IF NOT pg_catalog.has_table_privilege('service_role', 'public.pricehist_active', 'SELECT')
       OR NOT pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR EXISTS (
            SELECT 1
              FROM pg_catalog.pg_proc AS p
              CROSS JOIN LATERAL pg_catalog.aclexplode(
                  COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
              ) AS acl
             WHERE p.oid = v_function
               AND acl.grantee = 0
               AND acl.privilege_type = 'EXECUTE'
       ) THEN
        RAISE EXCEPTION 'batch function must be executable only by service_role';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_index
         WHERE indexrelid = v_index
           AND indrelid = 'public.pricehist'::regclass
           AND indisvalid AND indisready
           AND indnkeyatts = 2 AND indnatts = 3
           AND indpred IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'measured partial covering index is missing or invalid';
    END IF;

    v_index_def := pg_catalog.pg_get_indexdef(v_index);
    IF v_index_def NOT ILIKE '%(prodcode, effdate DESC) INCLUDE (unitprice) WHERE (NOT is_deleted)%' THEN
        RAISE EXCEPTION 'unexpected price-history index definition: %', v_index_def;
    END IF;
END;
$test$;

SET LOCAL ROLE service_role;

DO $test$
DECLARE
    v_prefix text := pg_catalog.current_setting('hope.s2_dba_06.fixture_prefix');
    v_codes varchar(6)[];
    v_product varchar(6);
    v_expected numeric;
    v_actual numeric;
    v_count bigint;
    v_has_eligible_history boolean;
BEGIN
    v_codes := ARRAY[
        (v_prefix || '1')::varchar(6),
        (v_prefix || '2')::varchar(6),
        (v_prefix || '3')::varchar(6),
        (v_prefix || '4')::varchar(6),
        (v_prefix || '5')::varchar(6),
        (v_prefix || '6')::varchar(6)
    ];

    SELECT unitprice INTO v_actual
      FROM public.product_prices_as_of(ARRAY[v_codes[1]], current_date - 15)
     WHERE prodcode = v_codes[1];
    IF v_actual IS DISTINCT FROM 10.00::numeric THEN
        RAISE EXCEPTION 'historical price mismatch: expected 10.00, got %', v_actual;
    END IF;

    SELECT unitprice INTO v_actual
      FROM public.product_prices_as_of(ARRAY[v_codes[1]], current_date)
     WHERE prodcode = v_codes[1];
    IF v_actual IS DISTINCT FROM 20.00::numeric THEN
        RAISE EXCEPTION 'current price must ignore inactive and future rows; got %', v_actual;
    END IF;

    SELECT unitprice INTO v_actual
      FROM public.product_prices_as_of(ARRAY[v_codes[1]], current_date + 20)
     WHERE prodcode = v_codes[1];
    IF v_actual IS DISTINCT FROM 30.00::numeric THEN
        RAISE EXCEPTION 'future price mismatch after its effective date: got %', v_actual;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.product_prices_as_of(ARRAY[v_codes[2]], current_date)
    ) OR EXISTS (
        SELECT 1 FROM public.product_prices_as_of(ARRAY[v_codes[3]], current_date)
    ) OR EXISTS (
        SELECT 1 FROM public.product_prices_as_of(ARRAY[v_codes[4]], current_date)
    ) THEN
        RAISE EXCEPTION 'future-only, inactive-only, or missing history returned a price';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_prices_as_of(ARRAY[v_codes[2]], current_date + 20)
         WHERE prodcode = v_codes[2] AND unitprice = 40.00
    ) THEN
        RAISE EXCEPTION 'future-only price did not become eligible on its effective date';
    END IF;

    FOREACH v_product IN ARRAY v_codes LOOP
        SELECT public.product_price_as_of(v_product, current_date) INTO v_expected;
        SELECT count(*), max(unitprice) INTO v_count, v_actual
          FROM public.product_prices_as_of(v_codes, current_date)
         WHERE prodcode = v_product;
        IF v_expected IS NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.pricehist_active
                 WHERE prodcode = v_product AND effdate <= current_date
            ) INTO v_has_eligible_history;
            IF (v_has_eligible_history AND (v_count <> 1 OR v_actual IS NOT NULL))
               OR (NOT v_has_eligible_history AND v_count <> 0) THEN
                RAISE EXCEPTION 'batch/scalar NULL result mismatch for %: history %, batch rows %, price %',
                    v_product, v_has_eligible_history, v_count, v_actual;
            END IF;
        ELSIF v_count <> 1 OR v_actual IS DISTINCT FROM v_expected THEN
            RAISE EXCEPTION 'batch/scalar mismatch for %: scalar %, batch rows %, price %',
                v_product, v_expected, v_count, v_actual;
        END IF;
    END LOOP;

    IF (SELECT count(*) FROM public.product_prices_as_of(
            ARRAY[v_codes[1], v_codes[1], v_codes[5], v_codes[5]], current_date
        )) <> 2
       OR (SELECT count(*) FROM public.product_prices_as_of(
            ARRAY[v_codes[1], v_codes[1]], current_date
        ) WHERE prodcode = v_codes[1]) <> 1 THEN
        RAISE EXCEPTION 'duplicate product codes must not duplicate result rows';
    END IF;

    IF (SELECT count(*) FROM public.product_prices_as_of(ARRAY[v_codes[6]], current_date)) <> 1
       OR (SELECT unitprice FROM public.product_prices_as_of(ARRAY[v_codes[6]], current_date)) IS NOT NULL THEN
        RAISE EXCEPTION 'a latest active history row with NULL unitprice must remain distinguishable from missing history';
    END IF;

    IF (SELECT count(*) FROM public.product_prices_as_of(ARRAY[]::varchar(6)[], current_date)) <> 0
       OR (SELECT count(*) FROM public.product_prices_as_of(NULL::varchar(6)[], current_date)) <> 0
       OR (SELECT count(*) FROM public.product_prices_as_of(v_codes, NULL::date)) <> 0 THEN
        RAISE EXCEPTION 'empty or NULL input must return no rows';
    END IF;

    IF (SELECT count(*) FROM public.product_prices_as_of(
            ARRAY[v_codes[1], NULL::varchar(6), v_codes[5]], current_date
        )) <> 2 THEN
        RAISE EXCEPTION 'NULL array elements must be ignored';
    END IF;
END;
$test$;

ROLLBACK;
