-- S1-DBA-06 regression checks.
-- Run against an isolated Supabase database after all migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hope_audit_user.sql
--
-- The transaction rolls back all audit rows and temporary objects.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE audit_user_probe (
    probe_id   integer PRIMARY KEY,
    is_deleted boolean NOT NULL DEFAULT false,
    stamp      varchar(60)
);

CREATE TRIGGER audit_user_probe_stamp
    BEFORE INSERT OR UPDATE ON audit_user_probe
    FOR EACH ROW EXECUTE FUNCTION public.trg_set_stamp();

CREATE TRIGGER audit_user_probe_audit
    AFTER INSERT OR UPDATE ON audit_user_probe
    FOR EACH ROW EXECUTE FUNCTION public.trg_audit_log('probe_id');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
SELECT set_config('app.username', 'forged-by-client', true);

DO $$
DECLARE
    v_audit_id bigint;
    v_action_by text;
    v_stamp text;
BEGIN
    IF public.audit_user() <> '00000000-0000-0000-0000-00000000000a' THEN
        RAISE EXCEPTION 'authenticated user A was not selected';
    END IF;

    INSERT INTO audit_user_probe (probe_id) VALUES (1);
    SELECT audit_id, action_by, new_values ->> 'stamp'
      INTO v_audit_id, v_action_by, v_stamp
      FROM public.audit_log
     WHERE table_name = 'audit_user_probe'
       AND record_key = '1'
     ORDER BY audit_id DESC
     LIMIT 1;

    IF v_action_by <> '00000000-0000-0000-0000-00000000000a'
       OR v_stamp NOT LIKE 'ADD 00000000-0000-0000-0000-00000000000a %' THEN
        RAISE EXCEPTION 'ADD attribution or stamp is incorrect: %, %', v_action_by, v_stamp;
    END IF;

    UPDATE audit_user_probe SET probe_id = 2 WHERE probe_id = 1;
    IF (SELECT action_by FROM public.audit_log WHERE audit_id > v_audit_id ORDER BY audit_id DESC LIMIT 1)
       <> '00000000-0000-0000-0000-00000000000a' THEN
        RAISE EXCEPTION 'EDIT attribution is incorrect';
    END IF;

    UPDATE audit_user_probe SET is_deleted = true WHERE probe_id = 2;
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1)
       <> '00000000-0000-0000-0000-00000000000a' THEN
        RAISE EXCEPTION 'DELETE attribution is incorrect';
    END IF;

    UPDATE audit_user_probe SET is_deleted = false WHERE probe_id = 2;
    IF (SELECT action_by FROM public.audit_log ORDER BY audit_id DESC LIMIT 1)
       <> '00000000-0000-0000-0000-00000000000a' THEN
        RAISE EXCEPTION 'RESTORE attribution is incorrect';
    END IF;

    v_audit_id := (SELECT max(audit_id) FROM public.audit_log);
    UPDATE audit_user_probe SET probe_id = 2 WHERE probe_id = 2;
    IF (SELECT max(audit_id) FROM public.audit_log) <> v_audit_id THEN
        RAISE EXCEPTION 'no-op update unexpectedly created an audit row';
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
DO $$
DECLARE
    v_action_by text;
BEGIN
    IF public.audit_user() <> '00000000-0000-0000-0000-00000000000b' THEN
        RAISE EXCEPTION 'authenticated user B was not selected';
    END IF;

    INSERT INTO audit_user_probe (probe_id) VALUES (3);
    SELECT action_by
      INTO v_action_by
      FROM public.audit_log
     WHERE table_name = 'audit_user_probe'
       AND record_key = '3'
     ORDER BY audit_id DESC
     LIMIT 1;
    IF v_action_by <> '00000000-0000-0000-0000-00000000000b' THEN
        RAISE EXCEPTION 'authenticated user B audit attribution is incorrect: %', v_action_by;
    END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '', true);
DO $$
DECLARE
    v_actor text;
BEGIN
    SELECT public.audit_user() INTO v_actor;
    IF v_actor LIKE '00000000-0000-0000-0000-%'
       OR v_actor = 'forged-by-client'
       OR v_actor NOT LIKE 'system:%' THEN
        RAISE EXCEPTION 'unattributed operation was not classified as a system actor: %', v_actor;
    END IF;

    IF current_user = 'service_role' AND v_actor <> 'system:service_role' THEN
        RAISE EXCEPTION 'service-role operation was not explicitly classified: %', v_actor;
    END IF;
END;
$$;

ROLLBACK;
