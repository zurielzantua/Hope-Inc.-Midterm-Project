-- S1-DEV-06: management RPCs are callable outside the app route by
-- authenticated sessions, so they must also reject first-password setup
-- sessions. Check both the current trusted Auth metadata and the verified JWT
-- claim; the latter prevents a temporary invite token from gaining access
-- after its metadata changes but before the user signs in again.

CREATE OR REPLACE FUNCTION public.is_completed_superadmin_actor()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.app_user AS actor
          JOIN public.role AS actor_role ON actor_role.role_id = actor.role_id
          JOIN auth.users AS auth_actor ON auth_actor.id = actor.auth_user_id
         WHERE actor.auth_user_id = auth.uid()
           AND actor_role.role_code = 'superadmin'
           AND NOT actor_role.is_deleted
           AND actor.account_state = 'approved'
           AND NOT actor.is_blocked
           AND NOT actor.is_deleted
           AND (auth_actor.raw_app_meta_data -> 'hope_first_password_complete') = 'true'::jsonb
           AND (auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
    );
$$;

REVOKE ALL ON FUNCTION public.is_completed_superadmin_actor() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_superadmin_blocked(
    p_auth_user_id UUID,
    p_is_blocked BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_is_blocked BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL OR p_is_blocked IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT public.is_completed_superadmin_actor() THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'superadmin_actor_required';
    END IF;

    IF p_auth_user_id = v_actor AND p_is_blocked THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'self_block_forbidden';
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
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_approved BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT public.is_completed_superadmin_actor() THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'superadmin_actor_required';
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
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_admin_role BIGINT;
    v_promoted BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF v_actor IS NULL OR NOT public.is_completed_superadmin_actor() THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'superadmin_actor_required';
    END IF;

    SELECT role_id
      INTO v_admin_role
      FROM public.role
     WHERE role_code = 'admin'
       AND NOT is_deleted;

    IF v_admin_role IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'admin_role_unavailable';
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

COMMENT ON FUNCTION public.is_completed_superadmin_actor() IS
    'True only for the verified JWT identity whose live Auth metadata and JWT app_metadata both confirm first-password setup is complete and whose app_user profile is an active Superadmin.';
COMMENT ON FUNCTION public.set_superadmin_blocked(UUID, BOOLEAN) IS
    'Changes a Superadmin block state only for a fully authenticated active Superadmin; the account trigger guards the last active Superadmin.';
COMMENT ON FUNCTION public.approve_pending_user(UUID) IS
    'Approves one Pending User only for a fully authenticated active Superadmin.';
COMMENT ON FUNCTION public.promote_user_to_admin(UUID) IS
    'Designates one approved User as Admin only for a fully authenticated active Superadmin.';

-- Rollback: re-apply 20261105022225_hope_superadmin_actor_attribution.sql.
--           This removes the setup-completion checks and should only be done
--           while DEV-06 privileged actions are disabled.
