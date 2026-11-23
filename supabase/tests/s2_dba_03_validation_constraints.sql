-- S2-DBA-03 validation contract test.
-- Run against an empty disposable PostgreSQL database only:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/s2_dba_03_validation_constraints.sql
-- The fixture, migration, and mutations are rolled back.

\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE public.customer (
    custno varchar(5) PRIMARY KEY,
    custname varchar(20),
    address varchar(50),
    payterm varchar(3) CONSTRAINT pay_ck CHECK (payterm IN ('COD', '30D', '45D'))
);
CREATE TABLE public.product (
    prodcode varchar(6) PRIMARY KEY,
    description varchar(30),
    unit varchar(3) CONSTRAINT unit_ck CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'))
);

-- Representative rows copied from the existing base migration.
INSERT INTO public.customer (custno, custname, address, payterm) VALUES
    ('C0001', 'Globus Medical, Inc', '2560 Gen Armistead Ave Audubon CA 94031', '30D'),
    ('C0002', 'RF Industries, Inc', '7610 Miramar Rd San Diego, CA 92602', '45D'),
    ('C0003', 'Trisha Macdowell', '7642 Clairemont Mesa Blvd San Diego CA 90321', 'COD');
INSERT INTO public.product (prodcode, description, unit) VALUES
    ('AD0001', 'Toshiba Canvio 1 TB', 'ea'),
    ('AK0001', 'HP Pavilion DV6000', 'pc');

\ir ../migrations/20261122074126_s2_dba_03_required_payterm_unit.sql

DO $$
BEGIN
    IF (SELECT count(*) FROM public.customer) <> 3
       OR NOT EXISTS (SELECT 1 FROM public.customer WHERE custno = 'C0001' AND payterm = '30D')
       OR NOT EXISTS (SELECT 1 FROM public.customer WHERE custno = 'C0002' AND payterm = '45D')
       OR NOT EXISTS (SELECT 1 FROM public.customer WHERE custno = 'C0003' AND payterm = 'COD') THEN
        RAISE EXCEPTION 'existing valid customer rows were changed or lost';
    END IF;
    IF (SELECT count(*) FROM public.product) <> 2
       OR NOT EXISTS (SELECT 1 FROM public.product WHERE prodcode = 'AD0001' AND unit = 'ea')
       OR NOT EXISTS (SELECT 1 FROM public.product WHERE prodcode = 'AK0001' AND unit = 'pc') THEN
        RAISE EXCEPTION 'existing valid product rows were changed or lost';
    END IF;
    IF (SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'customer' AND column_name = 'payterm') <> 'NO'
       OR (SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'product' AND column_name = 'unit') <> 'NO' THEN
        RAISE EXCEPTION 'Customer Pay Terms and Product Unit must be required';
    END IF;
END;
$$;

INSERT INTO public.customer (custno, payterm) VALUES
    ('T0001', 'COD'), ('T0002', '30D'), ('T0003', '45D');
INSERT INTO public.product (prodcode, unit) VALUES
    ('TST001', 'pc'), ('TST002', 'ea'), ('TST003', 'mtr'), ('TST004', 'pkg'), ('TST005', 'ltr');

DO $$
DECLARE
    v_constraint text;
    v_column text;
BEGIN
    BEGIN
        INSERT INTO public.customer (custno, payterm) VALUES ('T9991', 'BAD');
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    END;
    IF v_constraint IS DISTINCT FROM 'customer_payterm_valid_ck' THEN
        RAISE EXCEPTION 'unsupported Customer Pay Terms did not fail through the named validation constraint';
    END IF;

    BEGIN
        INSERT INTO public.product (prodcode, unit) VALUES ('TST999', 'box');
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    END;
    IF v_constraint IS DISTINCT FROM 'product_unit_valid_ck' THEN
        RAISE EXCEPTION 'unsupported Product Unit did not fail through the named validation constraint';
    END IF;

    BEGIN
        INSERT INTO public.customer (custno, payterm) VALUES ('T9992', NULL);
    EXCEPTION WHEN not_null_violation THEN
        GET STACKED DIAGNOSTICS v_column = COLUMN_NAME;
    END;
    IF v_column IS DISTINCT FROM 'payterm' THEN
        RAISE EXCEPTION 'NULL Customer Pay Terms were not rejected';
    END IF;

    BEGIN
        INSERT INTO public.product (prodcode, unit) VALUES ('TST998', NULL);
    EXCEPTION WHEN not_null_violation THEN
        GET STACKED DIAGNOSTICS v_column = COLUMN_NAME;
    END;
    IF v_column IS DISTINCT FROM 'unit' THEN
        RAISE EXCEPTION 'NULL Product Unit values were not rejected';
    END IF;
END;
$$;

ROLLBACK;
