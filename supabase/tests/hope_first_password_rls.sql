-- S1-DEV-03 first-password and account-state RLS regression test.
-- Run only in a disposable Supabase database with an existing Auth-linked app_user:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -v test_auth_user_id="$HOPE_TEST_AUTH_USER_ID" -f supabase/tests/hope_first_password_rls.sql
-- The transaction rolls back the profile and permission fixture changes.

\set ON_ERROR_STOP on
\if :{?test_auth_user_id}
\else
  \echo 'Set test_auth_user_id to an existing disposable Auth-linked app_user UUID.'
  \quit 2
\endif

BEGIN;
SELECT set_config('hope.test_auth_user_id', :'test_auth_user_id', true);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.app_user WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid)
       OR NOT EXISTS (SELECT 1 FROM public.role WHERE NOT is_deleted)
       OR NOT EXISTS (SELECT 1 FROM public.module WHERE NOT is_deleted)
       OR NOT EXISTS (SELECT 1 FROM public.right_catalog WHERE NOT is_deleted) THEN
        RAISE EXCEPTION 'test account or seeded catalogues are missing';
    END IF;
END;
$$;

INSERT INTO public.user_permission (auth_user_id, right_id)
SELECT current_setting('hope.test_auth_user_id')::uuid, min(right_id)
  FROM public.right_catalog
 WHERE NOT is_deleted
ON CONFLICT (auth_user_id, right_id) DO UPDATE SET is_deleted = false;

UPDATE public.app_user
   SET account_state = 'approved', is_blocked = false, is_deleted = false
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;

SELECT set_config('request.jwt.claim.sub', current_setting('hope.test_auth_user_id'), true);
SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('hope.test_auth_user_id'),
    'role', 'authenticated',
    'app_metadata', '{}'::jsonb
)::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'missing completion marker exposed protected data';
    END IF;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('hope.test_auth_user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('hope_first_password_complete', 'true')
)::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'string completion marker was accepted as a JSON Boolean';
    END IF;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('hope.test_auth_user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('hope_first_password_complete', false)
)::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'false completion marker exposed protected data';
    END IF;
END;
$$;
RESET ROLE;

SELECT set_config('request.jwt.claims', jsonb_build_object(
    'sub', current_setting('hope.test_auth_user_id'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('hope_first_password_complete', true)
)::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.role) OR NOT EXISTS (SELECT 1 FROM public.module)
       OR NOT EXISTS (SELECT 1 FROM public.right_catalog) OR NOT EXISTS (SELECT 1 FROM public.app_user)
       OR NOT EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'approved, completed account could not read its allowed rows';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user SET account_state = 'pending'
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'Pending account read protected data';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user SET account_state = 'approved', is_blocked = true
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'Blocked account read protected data';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user SET is_blocked = false, is_deleted = true
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.role) OR EXISTS (SELECT 1 FROM public.module)
       OR EXISTS (SELECT 1 FROM public.right_catalog) OR EXISTS (SELECT 1 FROM public.app_user)
       OR EXISTS (SELECT 1 FROM public.user_permission) THEN
        RAISE EXCEPTION 'Soft-deleted account read protected data';
    END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
