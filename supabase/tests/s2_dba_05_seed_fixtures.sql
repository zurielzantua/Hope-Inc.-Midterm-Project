-- Run after migrations and supabase/seed.sql in a disposable local database:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s2_dba_05_seed_fixtures.sql
-- Uses fixed dates and seeded codes; this script makes no data changes.

\set ON_ERROR_STOP on
SET ROLE service_role;

DO $test$
DECLARE
    v_price numeric;
BEGIN
    IF (SELECT count(*) FROM public.customer WHERE custno IN ('D5C01', 'D5C02', 'D5C03')) <> 3
       OR (SELECT count(DISTINCT payterm) FROM public.customer WHERE custno IN ('D5C01', 'D5C02', 'D5C03')) <> 3
       OR EXISTS (
            SELECT 1 FROM public.customer
             WHERE custno IN ('D5C01', 'D5C02', 'D5C03')
               AND (payterm IS NULL OR payterm NOT IN ('COD', '30D', '45D'))
       ) THEN
        RAISE EXCEPTION 'customer fixture count or payment terms are incorrect';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.customer_active WHERE custno = 'D5C01' AND payterm = 'COD'
    ) OR EXISTS (
        SELECT 1 FROM public.customer_active WHERE custno = 'D5C03'
    ) THEN
        RAISE EXCEPTION 'customer active/inactive seed fixtures are incorrect';
    END IF;

    IF (SELECT count(*) FROM public.product WHERE prodcode LIKE 'D5P%') <> 5
       OR (SELECT count(DISTINCT unit) FROM public.product WHERE prodcode LIKE 'D5P%') <> 5
       OR EXISTS (
            SELECT 1 FROM public.product
             WHERE prodcode LIKE 'D5P%'
               AND (unit IS NULL OR unit NOT IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'))
       )
       OR (SELECT count(*) FROM public.pricehist WHERE prodcode LIKE 'D5P%') <> 7
       OR EXISTS (
            SELECT 1 FROM public.pricehist
             WHERE prodcode LIKE 'D5P%' AND unitprice <= 0
       ) THEN
        RAISE EXCEPTION 'product or price-history fixture values are incorrect';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.product_active WHERE prodcode = 'D5P001'
    ) OR EXISTS (
        SELECT 1 FROM public.product_active WHERE prodcode = 'D5P004'
    ) OR NOT EXISTS (
        SELECT 1 FROM public.pricehist WHERE prodcode = 'D5P004' AND is_deleted
    ) OR EXISTS (
        SELECT 1 FROM public.pricehist WHERE prodcode = 'D5P004' AND NOT is_deleted
    ) THEN
        RAISE EXCEPTION 'product or inactive-child seed fixtures are incorrect';
    END IF;

    SELECT public.product_price_as_of('D5P001', DATE '2024-06-30') INTO v_price;
    IF v_price IS DISTINCT FROM 10.00::numeric THEN
        RAISE EXCEPTION 'expected the initial price before the dated change, got %', v_price;
    END IF;

    SELECT public.product_price_as_of('D5P001', DATE '2024-12-01') INTO v_price;
    IF v_price IS DISTINCT FROM 12.50::numeric THEN
        RAISE EXCEPTION 'expected the latest active price, ignoring the inactive change, got %', v_price;
    END IF;

    SELECT public.product_price_as_of('D5P001', DATE '2035-01-01') INTO v_price;
    IF v_price IS DISTINCT FROM 15.00::numeric THEN
        RAISE EXCEPTION 'expected the future price on its effective date, got %', v_price;
    END IF;

    SELECT public.product_price_as_of('D5P002', DATE '2025-01-01') INTO v_price;
    IF v_price IS NOT NULL THEN
        RAISE EXCEPTION 'future-only product unexpectedly has an eligible price';
    END IF;

    SELECT public.product_price_as_of('D5P003', DATE '2025-01-01') INTO v_price;
    IF v_price IS NOT NULL THEN
        RAISE EXCEPTION 'product without price history unexpectedly has a price';
    END IF;

    SELECT public.product_price_as_of('D5P004', DATE '2025-01-01') INTO v_price;
    IF v_price IS NOT NULL THEN
        RAISE EXCEPTION 'inactive product history unexpectedly has an eligible price';
    END IF;
END;
$test$;

RESET ROLE;
