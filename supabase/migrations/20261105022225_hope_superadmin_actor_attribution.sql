-- S1-DEV-06 follow-up: attribute privileged account changes to the verified
-- authenticated Superadmin. The actor is read from auth.uid(), which is
-- derived from the request JWT. No actor identifier is accepted from the
-- client, and the functions are callable only by authenticated sessions.
--
-- The last-active-Superadmin trigger from 20261105013946 remains the
-- concurrency guard for every deactivating write.

CREATE OR REPLACE FUNCTION public.set_superadmin_blocked(
    p_auth_user_id UUID,
    p_is_blocked BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_is_blocked BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL OR p_is_blocked IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1
          FROM public.app_user AS actor
          JOIN public.role AS actor_role ON actor_role.role_id = actor.role_id
         WHERE actor.auth_user_id = v_actor
           AND actor_role.role_code = 'superadmin'
           AND NOT actor_role.is_deleted
           AND actor.account_state = 'approved'
           AND NOT actor.is_blocked
           AND NOT actor.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'superadmin_actor_required';
    END IF;

    IF p_auth_user_id = v_actor AND p_is_blocked THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'self_block_forbidden';
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

CREATE OR REPLACE FUNCTION public.approve_pending_user(
    p_auth_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_approved BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1
          FROM public.app_user AS actor
          JOIN public.role AS actor_role ON actor_role.role_id = actor.role_id
         WHERE actor.auth_user_id = v_actor
           AND actor_role.role_code = 'superadmin'
           AND NOT actor_role.is_deleted
           AND actor.account_state = 'approved'
           AND NOT actor.is_blocked
           AND NOT actor.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'superadmin_actor_required';
    END IF;

    UPDATE public.app_user AS u
       SET account_state = 'approved'
      FROM public.role AS r
     WHERE u.auth_user_id = p_auth_user_id
       AND u.role_id = r.role_id
       AND r.role_code = 'user'
       AND NOT r.is_deleted
       AND u.account_state = 'pending'
       AND NOT u.is_blocked
       AND NOT u.is_deleted
    RETURNING TRUE INTO v_approved;

    RETURN COALESCE(v_approved, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_user_to_admin(
    p_auth_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_admin_role BIGINT;
    v_promoted BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1
          FROM public.app_user AS actor
          JOIN public.role AS actor_role ON actor_role.role_id = actor.role_id
         WHERE actor.auth_user_id = v_actor
           AND actor_role.role_code = 'superadmin'
           AND NOT actor_role.is_deleted
           AND actor.account_state = 'approved'
           AND NOT actor.is_blocked
           AND NOT actor.is_deleted
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'superadmin_actor_required';
    END IF;

    SELECT role_id
      INTO v_admin_role
      FROM public.role
     WHERE role_code = 'admin'
       AND NOT is_deleted;

    IF v_admin_role IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'admin_role_unavailable';
    END IF;

    UPDATE public.app_user AS u
       SET role_id = v_admin_role
      FROM public.role AS r
     WHERE u.auth_user_id = p_auth_user_id
       AND u.role_id = r.role_id
       AND r.role_code = 'user'
       AND NOT r.is_deleted
       AND u.account_state = 'approved'
       AND NOT u.is_blocked
       AND NOT u.is_deleted
    RETURNING TRUE INTO v_promoted;

    RETURN COALESCE(v_promoted, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.approve_pending_user(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.promote_user_to_admin(UUID) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_pending_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin(UUID) TO authenticated;

COMMENT ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) IS
    'Blocks or unblocks a Superadmin for the verified auth.uid() Superadmin; the app_user trigger serializes and rejects disabling the last active Superadmin.';
COMMENT ON FUNCTION public.approve_pending_user(UUID) IS
    'Approves one Pending User for the verified auth.uid() Superadmin.';
COMMENT ON FUNCTION public.promote_user_to_admin(UUID) IS
    'Designates one approved User as Admin for the verified auth.uid() Superadmin.';

-- Rollback: DROP FUNCTION public.promote_user_to_admin(UUID);
--           DROP FUNCTION public.approve_pending_user(UUID);
--           Re-apply 20261105013946_hope_last_superadmin_guard.sql to restore
--           the previous set_superadmin_blocked definition (service_role only).
