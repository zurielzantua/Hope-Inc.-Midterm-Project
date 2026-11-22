-- S2-DBA-04: serialize active child writes against parent soft deletion.
-- Apply as a normal transactional Supabase migration; do not run statement-by-statement.

-- Hold writes until preflight and guard installation finish, so no child can
-- appear between the consistency check and creation of the child triggers.
LOCK TABLE public.customer, public.sales, public.product,
           public.salesdetail, public.pricehist
    IN SHARE ROW EXCLUSIVE MODE;

-- Existing inconsistent rows must be dispositioned before installing guards.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM public.sales s
          JOIN public.customer c ON c.custno = s.custno
         WHERE NOT s.is_deleted AND c.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 's2_dba_04_preflight_active_sales_for_inactive_customer';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.salesdetail d
          JOIN public.product p ON p.prodcode = d.prodcode
         WHERE NOT d.is_deleted AND p.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 's2_dba_04_preflight_active_salesdetail_for_inactive_product';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.pricehist h
          JOIN public.product p ON p.prodcode = h.prodcode
         WHERE NOT h.is_deleted AND p.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 's2_dba_04_preflight_active_pricehist_for_inactive_product';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_require_active_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_is_deleted boolean;
BEGIN
    IF NEW.is_deleted THEN
        RETURN NEW;
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'sales' THEN
            IF NEW.custno IS NULL THEN
                RETURN NEW;
            END IF;
            SELECT c.is_deleted
              INTO v_parent_is_deleted
              FROM public.customer c
             WHERE c.custno = NEW.custno
             FOR UPDATE;
        WHEN 'salesdetail' THEN
            SELECT p.is_deleted
              INTO v_parent_is_deleted
              FROM public.product p
             WHERE p.prodcode = NEW.prodcode
             FOR UPDATE;
        WHEN 'pricehist' THEN
            SELECT p.is_deleted
              INTO v_parent_is_deleted
              FROM public.product p
             WHERE p.prodcode = NEW.prodcode
             FOR UPDATE;
        ELSE
            RAISE EXCEPTION USING
                ERRCODE = '0A000',
                MESSAGE = 'active_parent_guard_unsupported_table';
    END CASE;

    -- If the parent is absent, let its foreign-key constraint report that error.
    IF FOUND AND v_parent_is_deleted THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'active_parent_required';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_bi_require_active_customer
    BEFORE INSERT OR UPDATE OF custno, is_deleted ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.trg_require_active_parent();

CREATE TRIGGER salesdetail_bi_require_active_product
    BEFORE INSERT OR UPDATE OF prodcode, is_deleted ON public.salesdetail
    FOR EACH ROW EXECUTE FUNCTION public.trg_require_active_parent();

CREATE TRIGGER pricehist_bi_require_active_product
    BEFORE INSERT OR UPDATE OF prodcode, is_deleted ON public.pricehist
    FOR EACH ROW EXECUTE FUNCTION public.trg_require_active_parent();
