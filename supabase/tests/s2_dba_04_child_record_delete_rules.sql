-- S2-DBA-04 regression test. Run only against a disposable database after all
-- project migrations are applied; the fixture and audit rows roll back.
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/s2_dba_04_child_record_delete_rules.sql

\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
    v_state   text;
    v_message text;
    v_blocked boolean;
BEGIN
    INSERT INTO public.customer (custno, custname, address, payterm)
    VALUES ('D04C1', 'DBA04 customer', 'Rollback-only fixture', 'COD');
    INSERT INTO public.product (prodcode, description, unit)
    VALUES ('D04P01', 'DBA04 product', 'pc');
    INSERT INTO public.sales (transno, salesdate, custno, empno)
    VALUES ('D04T0001', DATE '2026-11-22', 'D04C1', '00001');

    -- One active sale blocks the customer transition and reports the current
    -- trigger error shape for the server-side 409 mapping.
    BEGIN
        UPDATE public.customer SET is_deleted = TRUE WHERE custno = 'D04C1';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'Cannot delete customer row: 1 active related record(s) still exist.' THEN
            RAISE EXCEPTION 'unexpected customer soft-delete error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR (SELECT is_deleted FROM public.customer WHERE custno = 'D04C1') THEN
        RAISE EXCEPTION 'active sales did not block customer soft deletion';
    END IF;

    -- Once its sale is inactive, the customer can be soft-deleted. Both rows
    -- and their key relationship must remain available for restore/history.
    UPDATE public.sales SET is_deleted = TRUE WHERE transno = 'D04T0001';
    UPDATE public.customer SET is_deleted = TRUE WHERE custno = 'D04C1';
    IF NOT EXISTS (
        SELECT 1
        FROM public.customer c
        JOIN public.sales s ON s.custno = c.custno
        WHERE c.custno = 'D04C1' AND c.is_deleted AND s.is_deleted
    ) OR NOT EXISTS (
        SELECT 1 FROM public.audit_log
        WHERE table_name = 'customer' AND record_key = 'D04C1' AND action = 'DELETE'
    ) THEN
        RAISE EXCEPTION 'customer soft deletion did not preserve references and audit history';
    END IF;

    -- Active sales cannot be inserted or reassigned to an inactive customer.
    v_blocked := FALSE;
    BEGIN
        INSERT INTO public.sales (transno, salesdate, custno, empno)
        VALUES ('D04T0002', DATE '2026-11-22', 'D04C1', '00001');
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-customer insert error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR EXISTS (SELECT 1 FROM public.sales WHERE transno = 'D04T0002') THEN
        RAISE EXCEPTION 'active sale insert under an inactive customer was not rejected';
    END IF;

    INSERT INTO public.sales (transno, salesdate, custno, empno)
    VALUES ('D04T0002', DATE '2026-11-22', NULL, '00001');
    v_blocked := FALSE;
    BEGIN
        UPDATE public.sales SET custno = 'D04C1' WHERE transno = 'D04T0002';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-customer reassignment error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR (SELECT custno FROM public.sales WHERE transno = 'D04T0002') IS NOT NULL THEN
        RAISE EXCEPTION 'active sale reassignment to an inactive customer was not rejected';
    END IF;

    UPDATE public.customer SET is_deleted = FALSE WHERE custno = 'D04C1';
    IF NOT EXISTS (
        SELECT 1 FROM public.customer c
        JOIN public.sales s ON s.custno = c.custno
        WHERE c.custno = 'D04C1' AND NOT c.is_deleted AND s.is_deleted
    ) OR NOT EXISTS (
        SELECT 1 FROM public.audit_log
        WHERE table_name = 'customer' AND record_key = 'D04C1' AND action = 'RESTORE'
    ) THEN
        RAISE EXCEPTION 'customer restore changed its identity or historical reference';
    END IF;

    INSERT INTO public.pricehist (effdate, prodcode, unitprice)
    VALUES (DATE '2026-01-01', 'D04P01', 1.00);

    -- An active price-history row independently blocks product soft deletion.
    v_blocked := FALSE;
    BEGIN
        UPDATE public.product SET is_deleted = TRUE WHERE prodcode = 'D04P01';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'Cannot delete product row: 1 active related record(s) still exist.' THEN
            RAISE EXCEPTION 'unexpected product price-history error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR (SELECT is_deleted FROM public.product WHERE prodcode = 'D04P01') THEN
        RAISE EXCEPTION 'active price history did not block product soft deletion';
    END IF;

    UPDATE public.pricehist
       SET is_deleted = TRUE
     WHERE prodcode = 'D04P01' AND effdate = DATE '2026-01-01';
    INSERT INTO public.sales (transno, salesdate, custno, empno)
    VALUES ('D04T0003', DATE '2026-11-22', 'D04C1', '00001');
    INSERT INTO public.salesdetail (transno, prodcode, quantity)
    VALUES ('D04T0003', 'D04P01', 1.00);

    -- An active sales detail independently blocks product soft deletion.
    v_blocked := FALSE;
    BEGIN
        UPDATE public.product SET is_deleted = TRUE WHERE prodcode = 'D04P01';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'Cannot delete product row: 1 active related record(s) still exist.' THEN
            RAISE EXCEPTION 'unexpected product sales-detail error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR (SELECT is_deleted FROM public.product WHERE prodcode = 'D04P01') THEN
        RAISE EXCEPTION 'active sales detail did not block product soft deletion';
    END IF;

    UPDATE public.salesdetail
       SET is_deleted = TRUE
     WHERE transno = 'D04T0003' AND prodcode = 'D04P01';
    UPDATE public.product SET is_deleted = TRUE WHERE prodcode = 'D04P01';
    IF NOT EXISTS (
        SELECT 1
        FROM public.product p
        JOIN public.pricehist h ON h.prodcode = p.prodcode
        JOIN public.salesdetail d ON d.prodcode = p.prodcode
        WHERE p.prodcode = 'D04P01' AND p.is_deleted
          AND h.is_deleted AND d.is_deleted
    ) OR NOT EXISTS (
        SELECT 1 FROM public.audit_log
        WHERE table_name = 'product' AND record_key = 'D04P01' AND action = 'DELETE'
    ) THEN
        RAISE EXCEPTION 'product soft deletion did not preserve history, references, and audit';
    END IF;

    INSERT INTO public.product (prodcode, description, unit)
    VALUES ('D04P02', 'DBA04 active product', 'pc');
    INSERT INTO public.pricehist (effdate, prodcode, unitprice)
    VALUES (DATE '2026-02-01', 'D04P02', 2.00);

    -- Changing an active child's parent key to an inactive parent is rejected.
    v_blocked := FALSE;
    BEGIN
        UPDATE public.pricehist
           SET prodcode = 'D04P01'
         WHERE effdate = DATE '2026-02-01' AND prodcode = 'D04P02';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product price reassignment error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR NOT EXISTS (
           SELECT 1 FROM public.pricehist
           WHERE effdate = DATE '2026-02-01' AND prodcode = 'D04P02' AND NOT is_deleted
       ) THEN
        RAISE EXCEPTION 'price-history reassignment to an inactive product was not rejected';
    END IF;

    INSERT INTO public.salesdetail (transno, prodcode, quantity)
    VALUES ('D04T0003', 'D04P02', 1.00);
    v_blocked := FALSE;
    BEGIN
        UPDATE public.salesdetail
           SET prodcode = 'D04P01'
         WHERE transno = 'D04T0003' AND prodcode = 'D04P02';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product detail reassignment error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR NOT EXISTS (
           SELECT 1 FROM public.salesdetail
           WHERE transno = 'D04T0003' AND prodcode = 'D04P02' AND NOT is_deleted
       ) THEN
        RAISE EXCEPTION 'sales-detail reassignment to an inactive product was not rejected';
    END IF;

    -- Active inserts and restores are rejected; inactive history can remain linked.
    v_blocked := FALSE;
    BEGIN
        INSERT INTO public.pricehist (effdate, prodcode, unitprice)
        VALUES (DATE '2027-01-01', 'D04P01', 3.00);
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product price insert error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR EXISTS (
           SELECT 1 FROM public.pricehist
           WHERE prodcode = 'D04P01' AND effdate = DATE '2027-01-01'
       ) THEN
        RAISE EXCEPTION 'active price-history insert under an inactive product was not rejected';
    END IF;
    INSERT INTO public.pricehist (effdate, prodcode, unitprice, is_deleted)
    VALUES (DATE '2027-01-01', 'D04P01', 3.00, TRUE);
    v_blocked := FALSE;
    BEGIN
        UPDATE public.pricehist
           SET is_deleted = FALSE
         WHERE prodcode = 'D04P01' AND effdate = DATE '2027-01-01';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product price restore error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR NOT (
           SELECT is_deleted FROM public.pricehist
           WHERE prodcode = 'D04P01' AND effdate = DATE '2027-01-01'
       ) THEN
        RAISE EXCEPTION 'price-history restore under an inactive product was not rejected';
    END IF;

    INSERT INTO public.sales (transno, salesdate, custno, empno)
    VALUES ('D04T0004', DATE '2026-11-22', 'D04C1', '00001');
    v_blocked := FALSE;
    BEGIN
        INSERT INTO public.salesdetail (transno, prodcode, quantity)
        VALUES ('D04T0004', 'D04P01', 1.00);
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product detail insert error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR EXISTS (
           SELECT 1 FROM public.salesdetail
           WHERE transno = 'D04T0004' AND prodcode = 'D04P01'
       ) THEN
        RAISE EXCEPTION 'active sales-detail insert under an inactive product was not rejected';
    END IF;
    INSERT INTO public.salesdetail (transno, prodcode, quantity, is_deleted)
    VALUES ('D04T0004', 'D04P01', 1.00, TRUE);
    v_blocked := FALSE;
    BEGIN
        UPDATE public.salesdetail
           SET is_deleted = FALSE
         WHERE transno = 'D04T0004' AND prodcode = 'D04P01';
    EXCEPTION WHEN SQLSTATE '23514' THEN
        GET STACKED DIAGNOSTICS
            v_state = RETURNED_SQLSTATE,
            v_message = MESSAGE_TEXT;
        IF v_message <> 'active_parent_required' THEN
            RAISE EXCEPTION 'unexpected inactive-product detail restore error: [%] %', v_state, v_message;
        END IF;
        v_blocked := TRUE;
    END;
    IF NOT COALESCE(v_blocked, FALSE)
       OR NOT (
           SELECT is_deleted FROM public.salesdetail
           WHERE transno = 'D04T0004' AND prodcode = 'D04P01'
       ) THEN
        RAISE EXCEPTION 'sales-detail restore under an inactive product was not rejected';
    END IF;

    UPDATE public.product SET is_deleted = FALSE WHERE prodcode = 'D04P01';
    IF NOT EXISTS (
        SELECT 1
        FROM public.product p
        JOIN public.pricehist h ON h.prodcode = p.prodcode
        JOIN public.salesdetail d ON d.prodcode = p.prodcode
        WHERE p.prodcode = 'D04P01' AND NOT p.is_deleted
          AND h.is_deleted AND d.is_deleted
    ) OR NOT EXISTS (
        SELECT 1 FROM public.audit_log
        WHERE table_name = 'product' AND record_key = 'D04P01' AND action = 'RESTORE'
    ) THEN
        RAISE EXCEPTION 'product restore changed its identity or historical references';
    END IF;
END;
$$;

ROLLBACK;
