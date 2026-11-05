-- S1-DEV-03 atomic claim regression test.
-- Run only in a disposable Supabase database with an existing test app_user:
--   psql "$HOPE_ISOLATED_DATABASE_URL" -v ON_ERROR_STOP=1 -v test_auth_user_id="$HOPE_TEST_AUTH_USER_ID" -f supabase/tests/hope_first_password_claim.sql
-- The transaction rolls back profile, stamp, and audit changes.
-- This checks the one-winner claim contract sequentially. Also run two concurrent
-- service-role RPC calls in an isolated database: in session A, BEGIN; call the
-- claim RPC with claim A; SELECT pg_sleep(5); COMMIT. During the sleep, session B
-- calls it with claim B. A must return claim A and B must return NULL. Then release
-- claim A. This exercises the row-lock recheck with two database connections.

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
    IF NOT EXISTS (
        SELECT 1 FROM public.app_user
         WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid
    ) THEN
        RAISE EXCEPTION 'test_auth_user_id is not linked to app_user';
    END IF;

    IF has_function_privilege('anon', 'public.claim_first_password_setup(uuid,uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.claim_first_password_setup(uuid,uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.claim_first_password_setup(uuid,uuid)', 'EXECUTE') THEN
        RAISE EXCEPTION 'claim function grants are incorrect';
    END IF;
END;
$$;

UPDATE public.app_user
   SET account_state = 'approved', is_blocked = false, is_deleted = false,
       first_password_setup_claim_id = NULL, first_password_setup_claimed_at = NULL
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;

SET LOCAL ROLE service_role;
DO $$
DECLARE
    v_user_id uuid := current_setting('hope.test_auth_user_id')::uuid;
    v_claim_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    v_claim_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
BEGIN
    IF public.claim_first_password_setup(v_user_id, v_claim_a) IS DISTINCT FROM v_claim_a THEN
        RAISE EXCEPTION 'first eligible claim was not accepted';
    END IF;
    IF public.claim_first_password_setup(v_user_id, v_claim_b) IS NOT NULL THEN
        RAISE EXCEPTION 'second claim was accepted while the first claim was held';
    END IF;
    IF public.release_first_password_setup(v_user_id, v_claim_b) THEN
        RAISE EXCEPTION 'a non-owner released another claim';
    END IF;
    IF NOT public.release_first_password_setup(v_user_id, v_claim_a) THEN
        RAISE EXCEPTION 'the claim owner could not release a rejected-password claim';
    END IF;
    IF public.claim_first_password_setup(v_user_id, v_claim_b) IS DISTINCT FROM v_claim_b THEN
        RAISE EXCEPTION 'released account could not be claimed again';
    END IF;
    IF NOT public.release_first_password_setup(v_user_id, v_claim_b) THEN
        RAISE EXCEPTION 'claim could not be released before account-state checks';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user
   SET account_state = 'pending'
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE service_role;
DO $$
BEGIN
    IF public.claim_first_password_setup(
        current_setting('hope.test_auth_user_id')::uuid,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Pending account was claimed';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user
   SET account_state = 'approved', is_blocked = true
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE service_role;
DO $$
BEGIN
    IF public.claim_first_password_setup(
        current_setting('hope.test_auth_user_id')::uuid,
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Blocked account was claimed';
    END IF;
END;
$$;
RESET ROLE;

UPDATE public.app_user
   SET is_blocked = false, is_deleted = true
 WHERE auth_user_id = current_setting('hope.test_auth_user_id')::uuid;
SET LOCAL ROLE service_role;
DO $$
BEGIN
    IF public.claim_first_password_setup(
        current_setting('hope.test_auth_user_id')::uuid,
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    ) IS NOT NULL THEN
        RAISE EXCEPTION 'Soft-deleted account was claimed';
    END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
