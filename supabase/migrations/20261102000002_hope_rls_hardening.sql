-- S1-DBA-04: close view, account-state, and default-role privilege gaps.
-- This is forward-only so it also hardens databases where S1-DBA-03 already ran.

-- Active views must evaluate their source-table RLS policies as the caller.
ALTER VIEW employee_active SET (security_invoker = true);
ALTER VIEW department_active SET (security_invoker = true);
ALTER VIEW job_active SET (security_invoker = true);
ALTER VIEW jobhistory_active SET (security_invoker = true);
ALTER VIEW customer_active SET (security_invoker = true);
ALTER VIEW sales_active SET (security_invoker = true);
ALTER VIEW salesdetail_active SET (security_invoker = true);
ALTER VIEW product_active SET (security_invoker = true);
ALTER VIEW payment_active SET (security_invoker = true);
ALTER VIEW pricehist_active SET (security_invoker = true);
ALTER VIEW role_active SET (security_invoker = true);
ALTER VIEW module_active SET (security_invoker = true);
ALTER VIEW right_catalog_active SET (security_invoker = true);
ALTER VIEW user_permission_active SET (security_invoker = true);

-- Pending, blocked, and soft-deleted accounts cannot read protected records.
ALTER POLICY role_authenticated_read ON role
    USING (
        NOT is_deleted
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
        AND account_state = 'approved'
        AND NOT is_blocked
        AND NOT is_deleted
    );

ALTER POLICY user_permission_self_read ON user_permission
    USING (
        auth_user_id = auth.uid()
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

-- The default role lookup is only an internal provisioning operation.
ALTER FUNCTION public.default_user_role_id()
    SET search_path = pg_catalog, public;
ALTER FUNCTION public.default_user_role_id()
    SET row_security = on;
ALTER FUNCTION public.default_user_role_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.default_user_role_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_user_role_id() TO service_role;
