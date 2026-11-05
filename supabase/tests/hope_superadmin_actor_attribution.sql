-- S1-DEV-06 verified-actor audit attribution test.
-- Run only against an empty disposable PostgreSQL database:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hope_superadmin_actor_attribution.sql
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
    role_name TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE public.app_user (
    auth_user_id UUID PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role_id BIGINT NOT NULL REFERENCES public.role(role_id),
    account_state TEXT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    stamp TEXT
);
CREATE TABLE public.audit_log (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(30) NOT NULL,
    action VARCHAR(7) NOT NULL,
    record_key VARCHAR(60),
    old_values JSONB,
    new_values JSONB,
    action_by VARCHAR(50) NOT NULL,
    action_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

\ir ../migrations/20261104000002_hope_authenticated_audit_user.sql
\ir ../migrations/20261105013946_hope_last_superadmin_guard.sql
\ir ../migrations/20261105022225_hope_superadmin_actor_attribution.sql
\ir ../migrations/20261105033601_dev06_require_completed_superadmin_actor.sql

CREATE FUNCTION public.test_app_user_audit() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.audit_log (table_name, action, record_key, old_values, new_values, action_by)
    VALUES (TG_TABLE_NAME, 'EDIT', NEW.auth_user_id::text, to_jsonb(OLD), to_jsonb(NEW), public.audit_user());
    RETURN NULL;
END;
$$;

CREATE TRIGGER app_user_test_audit
    AFTER UPDATE ON public.app_user
    FOR EACH ROW
    EXECUTE FUNCTION public.test_app_user_audit();

INSERT INTO public.role (role_id, role_code, role_name) VALUES
    (1, 'user', 'User'),
    (2, 'admin', 'Admin'),
    (3, 'superadmin', 'Superadmin');

INSERT INTO public.app_user (auth_user_id, first_name, last_name, email, role_id, account_state) VALUES
    ('11111111-1111-4111-8111-111111111111', 'Actor', 'One', 'actor1@example.test', 3, 'approved'),
    ('22222222-2222-4222-8222-222222222222', 'Actor', 'Two', 'actor2@example.test', 3, 'approved'),
    ('33333333-3333-4333-8333-333333333333', 'Admin', 'Actor', 'admin@example.test', 2, 'approved'),
    ('77777777-7777-4777-8777-777777777777', 'Setup', 'Incomplete', 'incomplete@example.test', 3, 'approved'),
    ('88888888-8888-4888-8888-888888888888', 'Setup', 'String', 'string@example.test', 3, 'approved'),
    ('99999999-9999-4999-8999-999999999999', 'Setup', 'Stale', 'stale@example.test', 3, 'approved'),
    ('44444444-4444-4444-8444-444444444444', 'Pending', 'User', 'pending@example.test', 1, 'pending'),
    ('55555555-5555-4555-8555-555555555555', 'Approved', 'User', 'approved@example.test', 1, 'approved'),
    ('66666666-6666-4666-8666-666666666666', 'Second', 'Pending', 'second@example.test', 1, 'pending');

INSERT INTO auth.users (id, raw_app_meta_data) VALUES
    ('11111111-1111-4111-8111-111111111111', '{"hope_first_password_complete": true}'),
    ('22222222-2222-4222-8222-222222222222', '{"hope_first_password_complete": true}'),
    ('33333333-3333-4333-8333-333333333333', '{"hope_first_password_complete": true}'),
    ('77777777-7777-4777-8777-777777777777', '{"hope_first_password_complete": false}'),
    ('88888888-8888-4888-8888-888888888888', '{"hope_first_password_complete": "true"}'),
    ('99999999-9999-4999-8999-999999999999', '{"hope_first_password_complete": true}');

CREATE TEMP TABLE audit_before_setup_claim AS SELECT count(*)::bigint AS n FROM public.audit_log;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","app_metadata":{"hope_first_password_complete":false}}', true);
    BEGIN
        PERFORM public.approve_pending_user('44444444-4444-4444-8444-444444444444');
        RAISE EXCEPTION 'expected an incomplete setup session to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM public.promote_user_to_admin('55555555-5555-4555-8555-555555555555');
        RAISE EXCEPTION 'expected an incomplete setup session to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM public.set_superadmin_blocked('22222222-2222-4222-8222-222222222222', TRUE);
        RAISE EXCEPTION 'expected an incomplete setup session to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","app_metadata":{"hope_first_password_complete":true}}', true);
    BEGIN
        PERFORM public.approve_pending_user('66666666-6666-4666-8666-666666666666');
        RAISE EXCEPTION 'expected a string completion marker to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"99999999-9999-4999-8999-999999999999","app_metadata":{"hope_first_password_complete":false}}', true);
    BEGIN
        PERFORM public.approve_pending_user('66666666-6666-4666-8666-666666666666');
        RAISE EXCEPTION 'expected an incomplete JWT marker to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.audit_log) <> (SELECT n FROM audit_before_setup_claim) THEN
        RAISE EXCEPTION 'rejected setup sessions wrote audit rows';
    END IF;
    IF (SELECT account_state FROM public.app_user WHERE auth_user_id = '44444444-4444-4444-8444-444444444444') <> 'pending'
       OR (SELECT role_id FROM public.app_user WHERE auth_user_id = '55555555-5555-4555-8555-555555555555') <> 1
       OR (SELECT is_blocked FROM public.app_user WHERE auth_user_id = '22222222-2222-4222-8222-222222222222')
       OR (SELECT account_state FROM public.app_user WHERE auth_user_id = '66666666-6666-4666-8666-666666666666') <> 'pending' THEN
        RAISE EXCEPTION 'rejected setup session changed an account';
    END IF;
END;
$$;

DO $$
BEGIN
    IF has_function_privilege('anon', 'public.is_completed_superadmin_actor()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.is_completed_superadmin_actor()', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.is_completed_superadmin_actor()', 'EXECUTE') THEN
        RAISE EXCEPTION 'the Superadmin actor-check helper must not be directly callable';
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
    IF has_function_privilege('anon', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.set_superadmin_blocked(uuid,boolean)', 'EXECUTE') THEN
        RAISE EXCEPTION 'set_superadmin_blocked grants are incorrect';
    END IF;
END;
$$;

-- Actor One approves the pending User.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    IF NOT public.approve_pending_user('44444444-4444-4444-8444-444444444444') THEN
        RAISE EXCEPTION 'approval was not applied';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT account_state FROM public.app_user WHERE auth_user_id = '44444444-4444-4444-8444-444444444444') <> 'approved' THEN
        RAISE EXCEPTION 'approval did not persist';
    END IF;
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1) <> '11111111-1111-4111-8111-111111111111' THEN
        RAISE EXCEPTION 'approval was not attributed to the verified actor';
    END IF;
END;
$$;

-- Actor Two approves another pending User; attribution must follow the JWT, not a fixed actor.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    IF NOT public.approve_pending_user('66666666-6666-4666-8666-666666666666') THEN
        RAISE EXCEPTION 'second approval was not applied';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1) <> '22222222-2222-4222-8222-222222222222' THEN
        RAISE EXCEPTION 'second approval did not record the second verified actor';
    END IF;
END;
$$;

-- Actor One promotes the approved User to Admin.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    IF NOT public.promote_user_to_admin('55555555-5555-4555-8555-555555555555') THEN
        RAISE EXCEPTION 'promotion was not applied';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT role_id FROM public.app_user WHERE auth_user_id = '55555555-5555-4555-8555-555555555555') <> 2 THEN
        RAISE EXCEPTION 'promotion did not persist';
    END IF;
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1) <> '11111111-1111-4111-8111-111111111111' THEN
        RAISE EXCEPTION 'promotion was not attributed to the verified actor';
    END IF;
END;
$$;

-- Actor One blocks Actor Two.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    IF NOT public.set_superadmin_blocked('22222222-2222-4222-8222-222222222222', TRUE) THEN
        RAISE EXCEPTION 'Superadmin block was not applied';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF NOT (SELECT is_blocked FROM public.app_user WHERE auth_user_id = '22222222-2222-4222-8222-222222222222') THEN
        RAISE EXCEPTION 'Superadmin block did not persist';
    END IF;
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1) <> '11111111-1111-4111-8111-111111111111' THEN
        RAISE EXCEPTION 'Superadmin block was not attributed to the verified actor';
    END IF;
END;
$$;

-- A regular Admin cannot approve, and a failed actor check must not write an audit row.
CREATE TEMP TABLE audit_before AS SELECT count(*)::bigint AS n FROM public.audit_log;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.approve_pending_user('44444444-4444-4444-8444-444444444444');
        RAISE EXCEPTION 'expected an Admin approval to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'superadmin_actor_required' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.audit_log) <> (SELECT n FROM audit_before) THEN
        RAISE EXCEPTION 'rejected actor wrote an audit row';
    END IF;
END;
$$;

-- A Superadmin cannot block their own account.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.set_superadmin_blocked('11111111-1111-4111-8111-111111111111', TRUE);
        RAISE EXCEPTION 'expected a Superadmin self-block to be rejected';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'self_block_forbidden' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT is_blocked FROM public.app_user WHERE auth_user_id = '11111111-1111-4111-8111-111111111111') THEN
        RAISE EXCEPTION 'rejected self-block changed the account';
    END IF;
    IF EXISTS (SELECT 1 FROM public.audit_log WHERE action_by = 'system:service_role') THEN
        RAISE EXCEPTION 'an action was attributed to system:service_role';
    END IF;
END;
$$;

ROLLBACK;
