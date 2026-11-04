-- S1-DEV-03: require trusted Auth metadata before exposing application data.
-- The marker is written only by trusted server-side Auth operations. Do not
-- replace app_metadata with user_metadata: clients can edit user_metadata.
--
-- Auth metadata changes are visible to RLS only after the client presents a
-- refreshed JWT containing the new app_metadata value.

ALTER POLICY role_authenticated_read ON role
    USING (
        NOT is_deleted
        AND COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'hope_first_password_complete',
            'false'
        ) = 'true'
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY module_authenticated_read ON module
    USING (
        NOT is_deleted
        AND COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'hope_first_password_complete',
            'false'
        ) = 'true'
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY right_catalog_authenticated_read ON right_catalog
    USING (
        NOT is_deleted
        AND COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'hope_first_password_complete',
            'false'
        ) = 'true'
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

ALTER POLICY app_user_self_read ON app_user
    USING (
        auth_user_id = auth.uid()
        AND COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'hope_first_password_complete',
            'false'
        ) = 'true'
        AND account_state = 'approved'
        AND NOT is_blocked
        AND NOT is_deleted
    );

ALTER POLICY user_permission_self_read ON user_permission
    USING (
        auth_user_id = auth.uid()
        AND COALESCE(
            auth.jwt() -> 'app_metadata' ->> 'hope_first_password_complete',
            'false'
        ) = 'true'
        AND NOT is_deleted
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE app_user.auth_user_id = auth.uid()
              AND app_user.account_state = 'approved'
              AND NOT app_user.is_blocked
              AND NOT app_user.is_deleted
        )
    );
