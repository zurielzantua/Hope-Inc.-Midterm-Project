-- The original value checks already reject unsupported non-NULL values.
-- Keep their error messages descriptive and require both form fields.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.customer
         WHERE payterm IS NULL
            OR payterm NOT IN ('COD', '30D', '45D')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'S2-DBA-03 cannot require customer.payterm: existing rows contain NULL or unsupported values',
            HINT = 'Review the affected customer rows; this migration does not modify their values.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.product
         WHERE unit IS NULL
            OR unit NOT IN ('pc', 'ea', 'mtr', 'pkg', 'ltr')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'S2-DBA-03 cannot require product.unit: existing rows contain NULL or unsupported values',
            HINT = 'Review the affected product rows; this migration does not modify their values.';
    END IF;
END;
$$;

ALTER TABLE public.customer
    RENAME CONSTRAINT pay_ck TO customer_payterm_valid_ck;
ALTER TABLE public.customer
    ALTER COLUMN payterm SET NOT NULL;

ALTER TABLE public.product
    RENAME CONSTRAINT unit_ck TO product_unit_valid_ck;
ALTER TABLE public.product
    ALTER COLUMN unit SET NOT NULL;
