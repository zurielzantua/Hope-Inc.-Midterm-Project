-- S1-DEV-06 last-active-Superadmin guard test.
-- Run only against an empty disposable PostgreSQL database:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hope_last_superadmin_guard.sql
-- The fixture, migrations, and mutations are all rolled back.

\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    CREATE ROLE anon;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
DO $$
BEGIN
    CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
DO $$
BEGIN
    CREATE ROLE service_role;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
    CREATE SCHEMA IF NOT EXISTS auth;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        CREATE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $fn$
            SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $fn$;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'jwt'
    ) THEN
        CREATE FUNCTION auth.jwt() RETURNS jsonb
        LANGUAGE sql STABLE
        AS $fn$
            SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
        $fn$;
    END IF;
END;
$$;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    raw_app_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.role (
    role_id BIGINT PRIMARY KEY,
    role_code TEXT NOT NULL UNIQUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE public.app_user (
    auth_user_id UUID PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES public.role(role_id),
    account_state TEXT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

GRANT SELECT, UPDATE, DELETE ON public.role TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.app_user TO service_role;

\ir ../migrations/20261105013946_hope_last_superadmin_guard.sql
\ir ../migrations/20261105022225_hope_superadmin_actor_attribution.sql
\ir ../migrations/20261105033601_dev06_require_completed_superadmin_actor.sql

INSERT INTO public.role (role_id, role_code) VALUES
    (1, 'user'), (2, 'admin'), (3, 'superadmin');
INSERT INTO public.app_user (auth_user_id, role_id, account_state) VALUES
    ('11111111-1111-4111-8111-111111111111', 3, 'approved'),
    ('22222222-2222-4222-8222-222222222222', 3, 'approved');
INSERT INTO auth.users (id, raw_app_meta_data) VALUES
    ('11111111-1111-4111-8111-111111111111', '{"hope_first_password_complete": true}'),
    ('22222222-2222-4222-8222-222222222222', '{"hope_first_password_complete": true}');

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.is_completed_superadmin_actor()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.is_completed_superadmin_actor()', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.is_completed_superadmin_actor()', 'EXECUTE') THEN
        RAISE EXCEPTION 'the Superadmin actor-check helper must not be directly callable';
    END IF;
    IF has_function_privilege('anon', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE') THEN
        RAISE EXCEPTION 'set_superadmin_blocked grants are incorrect';
    END IF;
    IF has_function_privilege('anon', 'public.approve_pending_user(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.approve_pending_user(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.approve_pending_user(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'approve_pending_user grants are incorrect';
    END IF;
    IF has_function_privilege('anon', 'public.promote_user_to_admin(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.promote_user_to_admin(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.promote_user_to_admin(uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'promote_user_to_admin grants are incorrect';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    IF NOT public.set_superadmin_blocked('22222222-2222-4222-8222-222222222222', TRUE) THEN
        RAISE EXCEPTION 'blocking one of two active Superadmins was not applied';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.set_superadmin_blocked('11111111-1111-4111-8111-111111111111', TRUE);
        RAISE EXCEPTION 'expected a non-active actor to fail';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    BEGIN
        UPDATE public.app_user SET is_blocked = TRUE
         WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
        RAISE EXCEPTION 'expected blocking the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;

UPDATE public.app_user SET is_blocked = FALSE
 WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.set_superadmin_blocked('11111111-1111-4111-8111-111111111111', TRUE);
        RAISE EXCEPTION 'expected a Superadmin self-block to fail';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'self_block_forbidden' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
UPDATE public.app_user SET is_blocked = TRUE
 WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
    BEGIN
        UPDATE public.app_user SET role_id = 2
         WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
        RAISE EXCEPTION 'expected demoting the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;
UPDATE public.app_user SET is_blocked = FALSE
 WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
RESET ROLE;

UPDATE public.app_user SET role_id = 2
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
    BEGIN
        UPDATE public.app_user SET role_id = 2
         WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
        RAISE EXCEPTION 'expected demoting the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;
UPDATE public.app_user SET role_id = 3
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';

UPDATE public.app_user SET is_deleted = TRUE
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
    BEGIN
        UPDATE public.app_user SET is_deleted = TRUE
         WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
        RAISE EXCEPTION 'expected removing the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;
UPDATE public.app_user SET is_deleted = FALSE
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';

UPDATE public.app_user SET account_state = 'pending'
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
    BEGIN
        UPDATE public.app_user SET account_state = 'pending'
         WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
        RAISE EXCEPTION 'expected disabling the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;
UPDATE public.app_user SET account_state = 'approved'
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';

DO $$
BEGIN
    BEGIN
        UPDATE public.role SET is_deleted = TRUE WHERE role_code = 'superadmin';
        RAISE EXCEPTION 'expected disabling the active Superadmin role to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;

DELETE FROM public.app_user
 WHERE auth_user_id = '11111111-1111-4111-8111-111111111111';
DO $$
BEGIN
    BEGIN
        DELETE FROM public.app_user
         WHERE auth_user_id = '22222222-2222-4222-8222-222222222222';
        RAISE EXCEPTION 'expected removing the last active Superadmin to fail';
    EXCEPTION WHEN check_violation THEN
        IF SQLERRM <> 'last_active_superadmin' THEN RAISE; END IF;
    END;
END;
$$;

ROLLBACK;
