-- Fixture for the two-session last-Superadmin concurrency test.
-- Run only against an empty disposable PostgreSQL database. The shell test
-- supersedes this file's data and cleans up after the race.

\set ON_ERROR_STOP on

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

DROP TABLE IF EXISTS public.app_user CASCADE;
DROP TABLE IF EXISTS public.role CASCADE;

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

\ir ../migrations/20261105013946_hope_last_superadmin_guard.sql
\ir ../migrations/20261105022225_hope_superadmin_actor_attribution.sql

INSERT INTO public.role (role_id, role_code) VALUES
    (1, 'user'), (2, 'admin'), (3, 'superadmin');
INSERT INTO public.app_user (auth_user_id, role_id, account_state) VALUES
    ('11111111-1111-4111-8111-111111111111', 3, 'approved'),
    ('22222222-2222-4222-8222-222222222222', 3, 'approved');
