-- S1-DEV-03: atomically serialize first-password completion attempts.
-- This durable claim prevents two requests using the same verified setup
-- session from both updating the Auth password. Auth still owns passwords.

ALTER TABLE public.app_user
    ADD COLUMN first_password_setup_claim_id UUID,
    ADD COLUMN first_password_setup_claimed_at TIMESTAMPTZ,
    ADD CONSTRAINT app_user_first_password_claim_ck CHECK (
        (first_password_setup_claim_id IS NULL AND first_password_setup_claimed_at IS NULL)
        OR (first_password_setup_claim_id IS NOT NULL AND first_password_setup_claimed_at IS NOT NULL)
    );

COMMENT ON COLUMN public.app_user.first_password_setup_claim_id IS
    'Trusted server claim ID that serializes first-password completion; it is not an invitation token.';
COMMENT ON COLUMN public.app_user.first_password_setup_claimed_at IS
    'Time the trusted server atomically claimed first-password completion.';

GRANT SELECT (auth_user_id, account_state, is_blocked, is_deleted, first_password_setup_claim_id)
    ON public.app_user TO service_role;
GRANT UPDATE (first_password_setup_claim_id, first_password_setup_claimed_at)
    ON public.app_user TO service_role;

CREATE OR REPLACE FUNCTION public.claim_first_password_setup(
    p_auth_user_id UUID,
    p_claim_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_claim_id UUID;
BEGIN
    IF p_auth_user_id IS NULL OR p_claim_id IS NULL THEN
        RETURN NULL;
    END IF;

    UPDATE public.app_user
       SET first_password_setup_claim_id = p_claim_id,
           first_password_setup_claimed_at = clock_timestamp()
     WHERE auth_user_id = p_auth_user_id
       AND account_state = 'approved'
       AND NOT is_blocked
       AND NOT is_deleted
       AND first_password_setup_claim_id IS NULL
    RETURNING first_password_setup_claim_id INTO v_claim_id;

    RETURN v_claim_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_first_password_setup(
    p_auth_user_id UUID,
    p_claim_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_released BOOLEAN;
BEGIN
    IF p_auth_user_id IS NULL OR p_claim_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE public.app_user
       SET first_password_setup_claim_id = NULL,
           first_password_setup_claimed_at = NULL
     WHERE auth_user_id = p_auth_user_id
       AND first_password_setup_claim_id = p_claim_id
    RETURNING TRUE INTO v_released;

    RETURN COALESCE(v_released, FALSE);
END;
$$;

COMMENT ON FUNCTION public.claim_first_password_setup(UUID, UUID) IS
    'Atomically claims an eligible account row for one first-password completion request. Call only after server-side identity/session verification.';
COMMENT ON FUNCTION public.release_first_password_setup(UUID, UUID) IS
    'Releases only the matching claim after Auth definitively rejects the proposed password; ambiguous failures must retain the claim for reconciliation.';

REVOKE ALL ON FUNCTION public.claim_first_password_setup(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_first_password_setup(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_password_setup(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_first_password_setup(UUID, UUID) TO service_role;
