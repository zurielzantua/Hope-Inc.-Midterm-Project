-- S1-DEV-03: require the completion claim to be a JSON Boolean true.
-- The prior text extraction also matched the string "true"; Auth app_metadata
-- is trusted, but authorization should still enforce the intended JSON type.

ALTER POLICY role_authenticated_read ON public.role
    USING (
        NOT is_deleted
        AND (SELECT auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
        AND EXISTS (
            SELECT 1
            FROM public.app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY module_authenticated_read ON public.module
    USING (
        NOT is_deleted
        AND (SELECT auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
        AND EXISTS (
            SELECT 1
            FROM public.app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY right_catalog_authenticated_read ON public.right_catalog
    USING (
        NOT is_deleted
        AND (SELECT auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
        AND EXISTS (
            SELECT 1
            FROM public.app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY app_user_self_read ON public.app_user
    USING (
        auth_user_id = auth.uid()
        AND (SELECT auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
        AND account_state = 'approved'
        AND NOT is_blocked
        AND NOT is_deleted
    );

ALTER POLICY user_permission_self_read ON public.user_permission
    USING (
        auth_user_id = auth.uid()
        AND (SELECT auth.jwt() -> 'app_metadata' -> 'hope_first_password_complete') = 'true'::jsonb
        AND NOT is_deleted
        AND EXISTS (
            SELECT 1
            FROM public.app_user
            WHERE public.app_user.auth_user_id = auth.uid()
              AND public.app_user.account_state = 'approved'
              AND NOT public.app_user.is_blocked
              AND NOT public.app_user.is_deleted
        )
    );
