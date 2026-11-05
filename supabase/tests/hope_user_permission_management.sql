-- DEV-07 RPC authorization, persistence, and audit test.
-- Run against an empty disposable PostgreSQL database only:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hope_user_permission_management.sql

\set ON_ERROR_STOP on
BEGIN;

DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
$$;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.role (
    role_id bigint PRIMARY KEY,
    role_code text NOT NULL UNIQUE,
    role_name text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.module (
    module_id bigint PRIMARY KEY,
    module_code text NOT NULL UNIQUE,
    module_name text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.right_catalog (
    right_id bigint PRIMARY KEY,
    module_id bigint NOT NULL REFERENCES public.module(module_id),
    right_code text NOT NULL UNIQUE,
    right_name text NOT NULL,
    is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.app_user (
    auth_user_id uuid PRIMARY KEY,
    role_id bigint NOT NULL REFERENCES public.role(role_id),
    account_state text NOT NULL,
    is_blocked boolean NOT NULL DEFAULT false,
    is_deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.user_permission (
    auth_user_id uuid NOT NULL REFERENCES public.app_user(auth_user_id),
    right_id bigint NOT NULL REFERENCES public.right_catalog(right_id),
    is_deleted boolean NOT NULL DEFAULT false,
    stamp varchar(60),
    PRIMARY KEY (auth_user_id, right_id)
);
CREATE TABLE public.audit_log (
    audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name varchar(30) NOT NULL,
    action varchar(7) NOT NULL,
    record_key varchar(60),
    old_values jsonb,
    new_values jsonb,
    action_by varchar(50) NOT NULL,
    action_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;

\ir ../migrations/20261104000002_hope_authenticated_audit_user.sql
\ir ../migrations/20261104233314_hope_audit_stamp_auth_uuid.sql

CREATE FUNCTION public.trg_set_stamp() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NEW;
END;
$$;
CREATE FUNCTION public.trg_audit_log() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN NULL;
END;
$$;
CREATE TRIGGER user_permission_biu_stamp
    BEFORE INSERT OR UPDATE ON public.user_permission
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();
CREATE TRIGGER user_permission_aiu_audit
    AFTER INSERT OR UPDATE ON public.user_permission
    FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('auth_user_id', 'right_id');

ALTER TABLE public.role ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.right_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission ENABLE ROW LEVEL SECURITY;

\ir ../migrations/20261105040425_dev07_user_permission_management.sql

INSERT INTO public.role (role_id, role_code, role_name) VALUES
    (1, 'user', 'User'), (2, 'admin', 'Admin'), (3, 'superadmin', 'Superadmin');
INSERT INTO public.module (module_id, module_code, module_name) VALUES
    (1, 'customer', 'Customer'), (2, 'product', 'Product'),
    (3, 'human_resources', 'Human Resources'), (4, 'sales', 'Sales'), (5, 'reports', 'Reports');
INSERT INTO public.right_catalog (right_id, module_id, right_code, right_name)
SELECT right_id,
       CASE WHEN right_id <= 3 THEN 1
            WHEN right_id <= 9 THEN 2
            WHEN right_id <= 22 THEN 3
            WHEN right_id <= 29 THEN 4
            ELSE 5 END,
       'permission_' || right_id::text,
       'Permission ' || right_id::text
  FROM pg_catalog.generate_series(1, 36) AS right_id;

INSERT INTO public.app_user (auth_user_id, role_id, account_state) VALUES
    ('11111111-1111-4111-8111-111111111111', 2, 'approved'),
    ('22222222-2222-4222-8222-222222222222', 3, 'approved'),
    ('33333333-3333-4333-8333-333333333333', 1, 'approved'),
    ('44444444-4444-4444-8444-444444444444', 1, 'approved'),
    ('55555555-5555-4555-8555-555555555555', 2, 'approved'),
    ('66666666-6666-4666-8666-666666666666', 3, 'approved'),
    ('77777777-7777-4777-8777-777777777777', 2, 'approved'),
    ('88888888-8888-4888-8888-888888888888', 2, 'approved');
INSERT INTO auth.users (id, raw_app_meta_data) VALUES
    ('11111111-1111-4111-8111-111111111111', '{"hope_first_password_complete": true}'),
    ('22222222-2222-4222-8222-222222222222', '{"hope_first_password_complete": true}'),
    ('33333333-3333-4333-8333-333333333333', '{"hope_first_password_complete": true}'),
    ('77777777-7777-4777-8777-777777777777', '{"hope_first_password_complete": false}'),
    ('88888888-8888-4888-8888-888888888888', '{"hope_first_password_complete": true}');

DO $$
BEGIN
    IF to_regprocedure('public.get_user_permissions(uuid)') IS NULL
       OR to_regprocedure('public.set_user_permissions(uuid,bigint[])') IS NULL THEN
        RAISE EXCEPTION 'DEV-07 rights RPCs are missing';
    END IF;
    IF has_function_privilege('anon', 'public.get_user_permissions(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.get_user_permissions(uuid)', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.get_user_permissions(uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.can_manage_user_permissions(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.can_manage_user_permissions(uuid)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.set_user_permissions(uuid,bigint[])', 'EXECUTE')
       OR NOT has_function_privilege('authenticated', 'public.set_user_permissions(uuid,bigint[])', 'EXECUTE')
       OR has_function_privilege('service_role', 'public.set_user_permissions(uuid,bigint[])', 'EXECUTE') THEN
        RAISE EXCEPTION 'rights RPC/helper grants are incorrect';
    END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
DECLARE
    v_right_count integer;
    v_assigned integer;
    v_audit_count integer;
BEGIN
    SELECT count(*) INTO v_right_count
      FROM public.get_user_permissions('44444444-4444-4444-8444-444444444444');
    IF v_right_count <> 36 THEN RAISE EXCEPTION 'expected 36 catalogue rights'; END IF;

    PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[1, 4]::bigint[]);
    SELECT count(*) INTO v_assigned
      FROM public.get_user_permissions('44444444-4444-4444-8444-444444444444')
     WHERE is_assigned;
    IF v_assigned <> 2 THEN RAISE EXCEPTION 'selected rights did not persist'; END IF;
    IF (SELECT count(*) FROM public.audit_log WHERE action_by = '11111111-1111-4111-8111-111111111111') <> 2 THEN
        RAISE EXCEPTION 'new permission rows were not attributed to the Admin';
    END IF;

    SELECT count(*) INTO v_audit_count FROM public.audit_log;
    PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[1, 4]::bigint[]);
    IF (SELECT count(*) FROM public.audit_log) <> v_audit_count THEN
        RAISE EXCEPTION 'saving unchanged rights created audit rows';
    END IF;

    PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[]::bigint[]);
    SELECT count(*) INTO v_assigned
      FROM public.get_user_permissions('44444444-4444-4444-8444-444444444444')
     WHERE is_assigned;
    IF v_assigned <> 0 THEN RAISE EXCEPTION 'None did not revoke all rights'; END IF;
    PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[4]::bigint[]);
    SELECT count(*) INTO v_assigned
      FROM public.get_user_permissions('44444444-4444-4444-8444-444444444444')
     WHERE is_assigned;
    IF v_assigned <> 1 THEN RAISE EXCEPTION 'restored permission did not persist'; END IF;

    SELECT count(*) INTO v_audit_count FROM public.audit_log;
    BEGIN
        PERFORM public.set_user_permissions('55555555-5555-4555-8555-555555555555', ARRAY[1]::bigint[]);
        RAISE EXCEPTION 'Admin modified another Admin permissions';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'rights_access_denied' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM public.get_user_permissions('66666666-6666-4666-8666-666666666666');
        RAISE EXCEPTION 'Admin viewed Superadmin permissions';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'rights_access_denied' THEN RAISE; END IF;
    END;
    BEGIN
        PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[999]::bigint[]);
        RAISE EXCEPTION 'unknown right ID was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
        IF SQLERRM <> 'invalid_right_ids' THEN RAISE; END IF;
    END;
    IF (SELECT count(*) FROM public.audit_log) <> v_audit_count THEN
        RAISE EXCEPTION 'rejected permission requests wrote audit rows';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    IF NOT public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[2, 4]::bigint[])
       OR NOT public.set_user_permissions('55555555-5555-4555-8555-555555555555', ARRAY[2]::bigint[])
       OR NOT public.set_user_permissions('66666666-6666-4666-8666-666666666666', ARRAY[3]::bigint[]) THEN
        RAISE EXCEPTION 'Superadmin could not manage eligible roles';
    END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
    IF (SELECT count(*) FROM public.audit_log WHERE action_by = '22222222-2222-4222-8222-222222222222') <> 3 THEN
        RAISE EXCEPTION 'Superadmin permission changes were not attributed to the verified actor';
    END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.get_user_permissions('44444444-4444-4444-8444-444444444444');
        RAISE EXCEPTION 'regular User accessed Rights Management';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'rights_access_denied' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

CREATE TEMP TABLE audit_before_setup_denials AS SELECT count(*)::bigint AS n FROM public.audit_log;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
SELECT set_config('request.jwt.claims', '{"sub":"77777777-7777-4777-8777-777777777777","app_metadata":{"hope_first_password_complete":true}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.set_user_permissions('44444444-4444-4444-8444-444444444444', ARRAY[5]::bigint[]);
        RAISE EXCEPTION 'incomplete Auth setup metadata was accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'rights_access_denied' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
SELECT set_config('request.jwt.claims', '{"sub":"88888888-8888-4888-8888-888888888888","app_metadata":{"hope_first_password_complete":false}}', true);
DO $$
BEGIN
    BEGIN
        PERFORM public.get_user_permissions('44444444-4444-4444-8444-444444444444');
        RAISE EXCEPTION 'incomplete JWT setup marker was accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'rights_access_denied' THEN RAISE; END IF;
    END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
    IF (SELECT count(*) FROM public.audit_log) <> (SELECT n FROM audit_before_setup_denials) THEN
        RAISE EXCEPTION 'setup-incomplete actors changed permissions';
    END IF;
END;
$$;

ROLLBACK;
