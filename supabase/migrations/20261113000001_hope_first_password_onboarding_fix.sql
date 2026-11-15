-- Hotfix: make first-password onboarding work with Supabase Auth invites/resets.
-- Follow-up to S1-DEV-03 (first-password RLS) and S1-DBA-04 (reset tokens).
--
-- Why this is needed:
--   `20261104000001_hope_first_password_rls.sql` required the custom JWT claim
--   `app_metadata.hope_first_password_complete = true` before an authenticated
--   user could read app_user, role, module, right_catalog, or user_permission.
--
--   Supabase's native invite and password-reset flows only update
--   auth.users.encrypted_password. They do not set that custom app_metadata
--   claim. Unless a trusted server calls the Auth Admin API and the client then
--   refreshes its JWT, a user who successfully set a password is still denied
--   every RLS-protected read. That makes "first password" and "reset password"
--   look broken even though the password change itself succeeded.
--
-- What this migration changes:
--   1. Derive "first password complete" from auth.users.encrypted_password,
--      using a locked-down SECURITY DEFINER helper. Invite and reset flows then
--      unlock RLS without app_metadata or a token refresh.
--   2. Let a signed-in, non-blocked, non-deleted user read their own app_user
--      row and role name while the account is still pending, so the onboarding
--      screen can show the pending state. Module, rights, and permission reads
--      still require an approved, non-blocked account with a password.
--
-- This does not create app_user rows for Auth users. Registration and invite
-- provisioning must still insert that row with a trusted service_role
-- operation. This migration also does not send email or handle Auth links;
-- those are Supabase Auth and application responsibilities.

CREATE OR REPLACE FUNCTION public.has_completed_first_password()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM auth.users AS u
         WHERE u.id = auth.uid()
           AND u.encrypted_password IS NOT NULL
           AND u.encrypted_password <> ''
    );
$$;

ALTER FUNCTION public.has_completed_first_password() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_completed_first_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_completed_first_password() TO authenticated;

COMMENT ON FUNCTION public.has_completed_first_password() IS
'True when the signed-in Auth user has a password. Used by RLS so Supabase invite/reset flows do not depend on custom app_metadata or a JWT refresh.';

-- Own profile: readable while pending so the first-password/pending screen can
-- load. Blocked and soft-deleted accounts remain denied.
ALTER POLICY app_user_self_read ON app_user
    USING (
        auth_user_id = auth.uid()
        AND NOT is_blocked
        AND NOT is_deleted
    );

-- Role names are harmless and are needed to render a pending profile. Any
-- signed-in, non-blocked, non-deleted account may read them.
ALTER POLICY role_authenticated_read ON role
    USING (
        NOT is_deleted
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE auth_user_id = auth.uid()
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

-- Modules and the rights catalogue stay protected until the account is
-- approved and has set a password.
ALTER POLICY module_authenticated_read ON module
    USING (
        NOT is_deleted
        AND public.has_completed_first_password()
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
        AND public.has_completed_first_password()
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE auth_user_id = auth.uid()
              AND account_state = 'approved'
              AND NOT is_blocked
              AND NOT is_deleted
        )
    );

-- Effective permissions: approved, active users who have set a password.
ALTER POLICY user_permission_self_read ON user_permission
    USING (
        auth_user_id = auth.uid()
        AND NOT is_deleted
        AND public.has_completed_first_password()
        AND EXISTS (
            SELECT 1
            FROM app_user
            WHERE app_user.auth_user_id = auth.uid()
              AND app_user.account_state = 'approved'
              AND NOT app_user.is_blocked
              AND NOT app_user.is_deleted
        )
    );
