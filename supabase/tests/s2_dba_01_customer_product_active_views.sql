-- S2-DBA-01 active-row views, partial indexes, and RLS regression test.
-- Run only in a disposable Supabase/PostgreSQL test database; all fixtures and
-- temporary grants are rolled back.
-- `service_role` models a trusted backend query; application code must first
-- authorize any administrator before using that role for inactive rows.

\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE
    v_customer_view text;
    v_product_view text;
    v_customer_index text;
    v_product_index text;
BEGIN
    SELECT reloptions::text INTO v_customer_view
      FROM pg_class WHERE oid = 'public.customer_active'::regclass;
    SELECT reloptions::text INTO v_product_view
      FROM pg_class WHERE oid = 'public.product_active'::regclass;

    IF v_customer_view NOT LIKE '%security_invoker=true%'
       OR v_product_view NOT LIKE '%security_invoker=true%' THEN
        RAISE EXCEPTION 'Customer/Product active views must preserve invoker RLS';
    END IF;

    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.customer'::regclass)
       OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.product'::regclass) THEN
        RAISE EXCEPTION 'Customer and Product RLS must remain enabled';
    END IF;

    SELECT indexdef INTO v_customer_index FROM pg_indexes
     WHERE schemaname='public' AND indexname='customer_active_name_idx';
    SELECT indexdef INTO v_product_index FROM pg_indexes
     WHERE schemaname='public' AND indexname='product_active_description_idx';

    IF v_customer_index IS NULL OR v_customer_index NOT ILIKE '%(custname, custno)%'
       OR v_customer_index NOT ILIKE '%WHERE (NOT is_deleted)%' THEN
        RAISE EXCEPTION 'Customer active-list index is missing or has the wrong key/predicate';
    END IF;
    IF v_product_index IS NULL OR v_product_index NOT ILIKE '%(description, prodcode)%'
       OR v_product_index NOT ILIKE '%WHERE (NOT is_deleted)%' THEN
        RAISE EXCEPTION 'Product active-list index is missing or has the wrong key/predicate';
    END IF;

    IF EXISTS (SELECT 1 FROM public.customer WHERE custno IN ('Z9901','Z9902'))
       OR EXISTS (SELECT 1 FROM public.product WHERE prodcode IN ('Z99001','Z99002')) THEN
        RAISE EXCEPTION 'S2-DBA-01 fixture keys are already in use';
    END IF;
END;
$$;

INSERT INTO public.customer (custno,custname,address,payterm,is_deleted) VALUES
    ('Z9901','S2 Active Customer','Test address','COD',false),
    ('Z9902','S2 Deleted Customer','Test address','COD',true);
INSERT INTO public.product (prodcode,description,unit,is_deleted) VALUES
    ('Z99001','S2 Active Product','ea',false),
    ('Z99002','S2 Deleted Product','ea',true);

GRANT SELECT ON public.customer, public.customer_active,
    public.product, public.product_active TO anon, authenticated, service_role;

SET LOCAL ROLE service_role;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.customer_active WHERE custno='Z9901')
       OR EXISTS (SELECT 1 FROM public.customer_active WHERE custno='Z9902')
       OR NOT EXISTS (SELECT 1 FROM public.customer WHERE custno='Z9902') THEN
        RAISE EXCEPTION 'Customer active view or privileged inactive-row path is incorrect';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.product_active WHERE prodcode='Z99001')
       OR EXISTS (SELECT 1 FROM public.product_active WHERE prodcode='Z99002')
       OR NOT EXISTS (SELECT 1 FROM public.product WHERE prodcode='Z99002') THEN
        RAISE EXCEPTION 'Product active view or privileged inactive-row path is incorrect';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.customer WHERE custno IN ('Z9901','Z9902'))
       OR EXISTS (SELECT 1 FROM public.customer_active WHERE custno IN ('Z9901','Z9902'))
       OR EXISTS (SELECT 1 FROM public.product WHERE prodcode IN ('Z99001','Z99002'))
       OR EXISTS (SELECT 1 FROM public.product_active WHERE prodcode IN ('Z99001','Z99002')) THEN
        RAISE EXCEPTION 'Anonymous access bypassed Customer/Product RLS';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.customer WHERE custno IN ('Z9901','Z9902'))
       OR EXISTS (SELECT 1 FROM public.customer_active WHERE custno IN ('Z9901','Z9902'))
       OR EXISTS (SELECT 1 FROM public.product WHERE prodcode IN ('Z99001','Z99002'))
       OR EXISTS (SELECT 1 FROM public.product_active WHERE prodcode IN ('Z99001','Z99002')) THEN
        RAISE EXCEPTION 'Unauthorised authenticated access bypassed Customer/Product RLS';
    END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
