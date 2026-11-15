-- S1-DEV-07: expose per-user rights only through authenticated, role-checked
-- RPCs. Writes use the caller JWT so user_permission audit triggers record
-- auth.uid() rather than system:service_role.

-- The rights RPCs use an empty search_path. Keep the existing shared triggers
-- working safely when invoked inside those functions by qualifying helpers.
CREATE OR REPLACE FUNCTION public.trg_set_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.stamp := public.audit_stamp('ADD');
    ELSIF (pg_catalog.to_jsonb(OLD) - 'stamp') = (pg_catalog.to_jsonb(NEW) - 'stamp') THEN
        NEW.stamp := OLD.stamp;
    ELSIF NOT OLD.is_deleted AND NEW.is_deleted THEN
        NEW.stamp := public.audit_stamp('DELETE');
    ELSIF OLD.is_deleted AND NOT NEW.is_deleted THEN
        NEW.stamp := public.audit_stamp('RESTORE');
    ELSE
        NEW.stamp := public.audit_stamp('EDIT');
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_action TEXT;
    v_key TEXT;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.to_jsonb(NEW) ->> k, '|' ORDER BY ord)
      INTO v_key
      FROM pg_catalog.unnest(TG_ARGV) WITH ORDINALITY AS t(k, ord);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, 'ADD', v_key, NULL, pg_catalog.to_jsonb(NEW), public.audit_user());
    ELSE
        IF (pg_catalog.to_jsonb(OLD) - 'stamp') = (pg_catalog.to_jsonb(NEW) - 'stamp') THEN
            RETURN NULL;
        END IF;
        v_action := CASE
            WHEN NOT OLD.is_deleted AND NEW.is_deleted THEN 'DELETE'
            WHEN OLD.is_deleted AND NOT NEW.is_deleted THEN 'RESTORE'
            ELSE 'EDIT'
        END;
        INSERT INTO public.audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, v_action, v_key, pg_catalog.to_jsonb(OLD), pg_catalog.to_jsonb(NEW), public.audit_user());
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_user_permissions(p_target_user_id UUID)
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
          JOIN public.app_user AS target ON target.auth_user_id = p_target_user_id
          JOIN public.role AS target_role ON target_role.role_id = target.role_id
         WHERE actor.auth_user_id = auth.uid()
           AND actor_role.role_code IN ('admin', 'superadmin')
           AND NOT actor_role.is_deleted
           AND actor.account_state = 'approved'
           AND NOT actor.is_blocked
           AND NOT actor.is_deleted
           AND (auth_actor.raw_app_meta_data -> 'hope_first_password_complete') = 'true'::jsonb
           AND (auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
           AND NOT target.is_deleted
           AND NOT target_role.is_deleted
           AND target_role.role_code IN ('user', 'admin', 'superadmin')
           AND (
               actor_role.role_code = 'superadmin'
               OR target_role.role_code = 'user'
           )
    );
$$;

ALTER FUNCTION public.can_manage_user_permissions(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_user_permissions(UUID) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_permissions(p_target_user_id UUID)
RETURNS TABLE (
    module_id BIGINT,
    module_code TEXT,
    module_name TEXT,
    right_id BIGINT,
    right_code TEXT,
    right_name TEXT,
    is_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.can_manage_user_permissions(p_target_user_id) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'rights_access_denied';
    END IF;

    RETURN QUERY
    SELECT m.module_id,
           m.module_code::TEXT,
           m.module_name::TEXT,
           r.right_id,
           r.right_code::TEXT,
           r.right_name::TEXT,
           up.auth_user_id IS NOT NULL
      FROM public.module AS m
      JOIN public.right_catalog AS r ON r.module_id = m.module_id
      LEFT JOIN public.user_permission AS up
        ON up.auth_user_id = p_target_user_id
       AND up.right_id = r.right_id
       AND NOT up.is_deleted
     WHERE NOT m.is_deleted
       AND NOT r.is_deleted
       AND m.module_code IN ('customer', 'product', 'human_resources', 'sales', 'reports')
     ORDER BY m.module_id, r.right_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_permissions(
    p_target_user_id UUID,
    p_right_ids BIGINT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
    v_distinct_count INTEGER;
BEGIN
    IF p_right_ids IS NULL OR COALESCE(pg_catalog.array_ndims(p_right_ids), 1) > 1
       OR pg_catalog.cardinality(p_right_ids) > 36
       OR pg_catalog.array_position(p_right_ids, NULL::BIGINT) IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_right_ids';
    END IF;

    SELECT pg_catalog.count(*)::INTEGER,
           pg_catalog.count(DISTINCT requested.right_id)::INTEGER
      INTO v_count, v_distinct_count
      FROM pg_catalog.unnest(p_right_ids) AS requested(right_id);

    IF v_count <> v_distinct_count THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_right_ids';
    END IF;

    PERFORM target.auth_user_id
      FROM public.app_user AS target
     WHERE target.auth_user_id = p_target_user_id
       AND NOT target.is_deleted
     FOR UPDATE;

    IF NOT public.can_manage_user_permissions(p_target_user_id) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'rights_access_denied';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM pg_catalog.unnest(p_right_ids) AS requested(right_id)
          LEFT JOIN public.right_catalog AS r ON r.right_id = requested.right_id
          LEFT JOIN public.module AS m ON m.module_id = r.module_id
         WHERE r.right_id IS NULL OR r.is_deleted OR m.is_deleted
            OR m.module_code NOT IN ('customer', 'product', 'human_resources', 'sales', 'reports')
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_right_ids';
    END IF;

    UPDATE public.user_permission AS existing
       SET is_deleted = TRUE
     WHERE existing.auth_user_id = p_target_user_id
       AND NOT existing.is_deleted
       AND NOT (existing.right_id = ANY (p_right_ids));

    INSERT INTO public.user_permission AS existing (auth_user_id, right_id)
    SELECT p_target_user_id, requested.right_id
      FROM pg_catalog.unnest(p_right_ids) AS requested(right_id)
    ON CONFLICT (auth_user_id, right_id)
    DO UPDATE SET is_deleted = FALSE
     WHERE existing.is_deleted;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.get_user_permissions(UUID) OWNER TO postgres;
ALTER FUNCTION public.set_user_permissions(UUID, BIGINT[]) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_user_permissions(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_user_permissions(UUID, BIGINT[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_permissions(UUID, BIGINT[]) TO authenticated;

COMMENT ON FUNCTION public.can_manage_user_permissions(UUID) IS
    'Internal role and account-state check for rights management; executable only by the function owner.';
COMMENT ON FUNCTION public.get_user_permissions(UUID) IS
    'Returns the active rights catalogue and assignment state for a target the verified Admin or Superadmin may manage.';
COMMENT ON FUNCTION public.set_user_permissions(UUID, BIGINT[]) IS
    'Atomically synchronizes a target user’s permissions; existing user_permission triggers audit each actual insert, revoke, or restore using auth.uid().';

-- Rollback: DROP FUNCTION public.set_user_permissions(UUID, BIGINT[]);
--           DROP FUNCTION public.get_user_permissions(UUID);
--           DROP FUNCTION public.can_manage_user_permissions(UUID);
