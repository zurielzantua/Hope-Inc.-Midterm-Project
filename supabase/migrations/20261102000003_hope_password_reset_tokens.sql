-- S1-DBA-04: password-reset token records for the trusted recovery workflow.
-- Supabase Auth remains responsible for password storage and recovery sessions.
-- Store only a one-way token digest; never store or log the emailed token.

CREATE TABLE password_reset_token (
    password_reset_token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash             BYTEA NOT NULL UNIQUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at             TIMESTAMPTZ NOT NULL,
    used                   BOOLEAN NOT NULL DEFAULT FALSE,
    used_at                TIMESTAMPTZ,
    CONSTRAINT password_reset_token_expiry_ck CHECK (expires_at > created_at),
    CONSTRAINT password_reset_token_used_at_ck
        CHECK ((used AND used_at IS NOT NULL) OR (NOT used AND used_at IS NULL))
);

CREATE INDEX password_reset_token_user_idx
    ON password_reset_token (auth_user_id);

CREATE INDEX password_reset_token_active_idx
    ON password_reset_token (token_hash, expires_at)
    WHERE NOT used;

COMMENT ON TABLE password_reset_token IS
    'Trusted-server password-reset metadata; token_hash is a one-way digest and Supabase Auth owns passwords.';
COMMENT ON COLUMN password_reset_token.token_hash IS
    'Digest of a high-entropy reset token; plaintext tokens must never be persisted or logged.';
COMMENT ON COLUMN password_reset_token.used IS
    'Set true with used_at in the same atomic trusted-server update when the token is redeemed.';

ALTER TABLE password_reset_token ENABLE ROW LEVEL SECURITY;

-- No client-facing policies are intentional. The trusted backend uses service_role.
REVOKE ALL ON TABLE password_reset_token FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE password_reset_token TO service_role;
