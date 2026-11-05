-- S1-DEV-06: protect the last active Superadmin from concurrent account changes.
-- The transaction-scoped advisory lock serializes any transition that would
-- deactivate an active Superadmin, including soft-delete and role-catalogue
-- disable operations. No data is changed by this migration itself.

CREATE OR REPLACE FUNCTION public.prevent_last_active_superadmin_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_old_active BOOLEAN := FALSE;
    v_new_active BOOLEAN := FALSE;
    v_other_active BIGINT := 0;
BEGIN
    IF TG_TABLE_NAME = 'app_user' THEN
        SELECT role_code = 'superadmin' AND NOT is_deleted
          INTO v_old_active
          FROM public.role
         WHERE role_id = OLD.role_id;

        v_old_active := COALESCE(v_old_active, FALSE)
            AND OLD.account_state = 'approved'
            AND NOT OLD.is_blocked
            AND NOT OLD.is_deleted;

        IF NOT v_old_active THEN
            IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
            RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
            SELECT role_code = 'superadmin' AND NOT is_deleted
              INTO v_new_active
              FROM public.role
             WHERE role_id = NEW.role_id;
            v_new_active := COALESCE(v_new_active, FALSE)
                AND NEW.account_state = 'approved'
                AND NOT NEW.is_blocked
                AND NOT NEW.is_deleted;
        END IF;

        IF NOT v_new_active THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(1213154352, 605);

            SELECT COUNT(*)
              INTO v_other_active
              FROM public.app_user AS u
              JOIN public.role AS r ON r.role_id = u.role_id
             WHERE u.auth_user_id <> OLD.auth_user_id
               AND r.role_code = 'superadmin'
               AND NOT r.is_deleted
               AND u.account_state = 'approved'
               AND NOT u.is_blocked
               AND NOT u.is_deleted;

            IF v_other_active = 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '23514',
                    CONSTRAINT = 'app_user_last_active_superadmin_ck',
                    MESSAGE = 'last_active_superadmin';
            END IF;
        END IF;

        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'role' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.role_code = 'superadmin' AND NOT OLD.is_deleted THEN
                PERFORM pg_catalog.pg_advisory_xact_lock(1213154352, 605);
                SELECT COUNT(*)
                  INTO v_other_active
                  FROM public.app_user AS u
                 WHERE u.role_id = OLD.role_id
                   AND u.account_state = 'approved'
                   AND NOT u.is_blocked
                   AND NOT u.is_deleted;
                IF v_other_active > 0 THEN
                    RAISE EXCEPTION USING
                        ERRCODE = '23514',
                        CONSTRAINT = 'role_last_active_superadmin_ck',
                        MESSAGE = 'last_active_superadmin';
                END IF;
            END IF;
            RETURN OLD;
        END IF;

        IF OLD.role_code = 'superadmin'
           AND NOT OLD.is_deleted
           AND (NEW.role_code <> 'superadmin' OR NEW.is_deleted) THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(1213154352, 605);
            SELECT COUNT(*)
              INTO v_other_active
              FROM public.app_user AS u
             WHERE u.role_id = OLD.role_id
               AND u.account_state = 'approved'
               AND NOT u.is_blocked
               AND NOT u.is_deleted;
            IF v_other_active > 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '23514',
                    CONSTRAINT = 'role_last_active_superadmin_ck',
                    MESSAGE = 'last_active_superadmin';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Unexpected trigger table: %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS app_user_last_active_superadmin_guard ON public.app_user;
CREATE TRIGGER app_user_last_active_superadmin_guard
    BEFORE UPDATE OR DELETE ON public.app_user
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_active_superadmin_change();

DROP TRIGGER IF EXISTS role_last_active_superadmin_guard ON public.role;
CREATE TRIGGER role_last_active_superadmin_guard
    BEFORE UPDATE OR DELETE ON public.role
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_last_active_superadmin_change();

CREATE OR REPLACE FUNCTION public.set_superadmin_blocked(
    p_auth_user_id UUID,
    p_is_blocked BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_is_blocked BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL OR p_is_blocked IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.app_user AS u
       SET is_blocked = p_is_blocked
      FROM public.role AS r
     WHERE u.auth_user_id = p_auth_user_id
       AND u.role_id = r.role_id
       AND r.role_code = 'superadmin'
       AND NOT r.is_deleted
       AND NOT u.is_deleted
    RETURNING u.is_blocked INTO v_is_blocked;

    RETURN COALESCE(v_is_blocked = p_is_blocked, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) TO service_role;
COMMENT ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) IS
    'Changes Superadmin block state; the app_user trigger serializes and rejects disabling the last active Superadmin.';

COMMENT ON FUNCTION public.prevent_last_active_superadmin_change() IS
    'Serializes deactivation of active Superadmins and rejects a change that would leave none active.';

-- Rollback: DROP FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN);
--           DROP TRIGGER role_last_active_superadmin_guard ON public.role;
--           DROP TRIGGER app_user_last_active_superadmin_guard ON public.app_user;
--           DROP FUNCTION public.prevent_last_active_superadmin_change();
