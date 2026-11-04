-- S1-DBA-06: attribute audit rows to the authenticated Supabase user.
--
-- auth.uid() is derived from the verified Supabase request JWT.  A client
-- supplied app.username setting is intentionally ignored.  Service-role and
-- other trusted database operations have no human identity in the database
-- request context, so they are recorded with an explicit system actor.

CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
    SELECT COALESCE(
        auth.uid()::text,
        CASE
            WHEN current_user = 'service_role' THEN 'system:service_role'
            ELSE 'system:' || left(current_user::text, 43)
        END
    );
$$;

COMMENT ON FUNCTION public.audit_user() IS
'Returns the verified Supabase auth.uid() when present; otherwise records an explicit system database role. Client-supplied actor settings are ignored.';
