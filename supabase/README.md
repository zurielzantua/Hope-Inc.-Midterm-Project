# Supabase

This folder contains the database setup for Hope, Inc. ERP.
SQL migrations are stored in `supabase/migrations/`.

## One-time setup

1. Clone the project, then run the following commands from `Hope-Inc.-Midterm-Project`, the folder containing `package.json` and `.git`:

   ```bash
   git checkout your-feature-branch
   npm install
   ```

2. Ask the DB Admin to invite you to our shared Supabase project.
3. Log in and link the project:

   ```bash
   npx supabase login
   npx supabase link --project-ref xpfojvcfhudwtritpofx
   ```

   Linking asks for the database password. Get it privately from the DB Admin.
4. Check the connection:

   ```bash
   npx supabase migration list
   ```

## Environment variables

Create `.env.local` in the project root:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xpfojvcfhudwtritpofx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ask the DB Admin or copy from the Supabase dashboard>
```

## Running migrations

Only the DB Admin pushes migrations. Tell the team before pushing because this database is shared. From the project root, run:

```bash
./scripts/db-push.sh
```

## S1-DBA-03 account and permission contract

The `20261102000001_hope_accounts_permissions.sql` migration creates:

- `app_user`, keyed by the Supabase Auth `auth.users.id` UUID
- `role`, `module`, `right_catalog`, and `user_permission`
- active-row views for each soft-deletable catalogue/permission table

`app_user.role_id` defaults through `default_user_role_id()` to the seeded
`role.role_code = 'user'` row. `account_state` defaults to `pending`, and
`is_blocked` defaults to `false`. DBA-05 must seed the three roles before
registration can create an application-user profile.

Registration is a trusted server-side two-step operation: create the
Supabase Auth user first, then insert `app_user` with the returned UUID,
first/last name, and email. The database supplies the regular User role and
Pending state; clients must not supply elevated role, approval, or blocked
values. If profile creation fails, the trusted backend must clean up or
handle the Auth user as a partial-registration failure.

The public `authenticated` role can read its own approved, non-blocked,
non-deleted profile and permissions, and can read non-deleted catalogues only
when its account is approved and non-blocked. Pending, blocked, and deleted
accounts cannot read protected records. Active-row views use
`security_invoker = true`, so their source-table RLS policies are enforced.
There are no client write policies for account or permission data; provisioning,
approval, role changes, and permission grants/revocations must use a trusted
server-side operation. The default role lookup is executable only by
`service_role`.
Soft deletion is performed by setting `is_deleted = true`; restoration clears
that flag on the existing record.

## S1-DEV-03 first-password RLS requirement

The `20261104000001_hope_first_password_rls.sql` migration also requires the
trusted Supabase Auth JWT claim
`app_metadata.hope_first_password_complete` to be exactly `true` before an
authenticated user can read `role`, `module`, `right_catalog`, `app_user`, or
`user_permission`. A missing marker or `false` denies access, as do pending,
blocked, and soft-deleted application accounts. The policy reads
`app_metadata` through `auth.jwt()`; it must not be replaced with client-editable
`user_metadata`.

The trusted server-side password-completion operation must update the Auth
`app_metadata` marker. The client must then refresh its session/JWT before RLS
can observe the new value. Service-role operations bypass RLS and therefore do
not validate these policies; application-side authorization remains required.

The script first shows a dry run, then asks for confirmation before pushing.

## S1-DBA-04 password-reset token contract

The `20261102000003_hope_password_reset_tokens.sql` migration creates
`password_reset_token` for the trusted server-side recovery workflow. It stores
the Supabase Auth user ID, a one-way `token_hash` (`bytea`), `created_at`,
`expires_at`, and single-use state through `used` and `used_at`. It does not
store passwords or plaintext reset tokens, and it has no audit or soft-delete
trigger because expiry and redemption are the lifecycle.

Supabase Auth remains the owner of password management and its native recovery
session/link flow (`resetPasswordForEmail()` followed by `updateUser()`). The
table satisfies the planned application token-record contract only if DEV-04
chooses and documents one coherent integration; it must not introduce a second
independent recovery flow accidentally.

RLS is enabled with no client policies. `anon` and `authenticated` have no
table privileges; only the trusted `service_role` receives table access. A
trusted backend must hash the presented high-entropy token using the same
algorithm before lookup, require `used = false AND expires_at > now()`, verify
the intended `auth_user_id`, and redeem it with one conditional transaction:

```sql
UPDATE password_reset_token
   SET used = true, used_at = now()
 WHERE password_reset_token_id = $1
   AND auth_user_id = $2
   AND NOT used
   AND expires_at > now()
RETURNING auth_user_id;
```

The returned row is the only success signal; zero rows means expired, already
used, or mismatched. The update must occur in the same trusted transaction as
the token validation so concurrent redemption attempts cannot both succeed.
Because Supabase Auth password updates are a separate service operation, DEV-04
must handle an Auth-update failure after the token claim without allowing the
token to be reused. DEV-04 still owns request handling, email delivery,
callback/new password UX, session handling, and end-to-end expiry/reuse tests.
No live database deployment is performed by this migration change.

## S1-DBA-05 catalogue seed contract

`20261103000001_hope_seed_catalogues.sql` seeds the three default roles
(`superadmin`, `admin`, and `user`), the five business modules (`customer`,
`product`, `human_resources`, `sales`, and `reports`), and the 36 action rights
specified by the Sprint 1 requirements. It is idempotent: matching
soft-deleted seed rows are restored, while active rows and their IDs are
preserved. Conflicting active catalogue names or right-to-module assignments
fail the migration instead of being silently overwritten.

The migration does not create Supabase Auth users, initial superadmin
accounts, or passwords. Those accounts require an authorized provisioning
flow and one-time password setup links.

The HTML prototype's five module-level `.view` switches are visibility
controls, not additional action rights. Developers should use the module
catalogue and the user's module-level visibility decision to gate navigation
and screens, then use the 36 `right_catalog` rows for action authorization.
Do not add those `.view` switches to the action-right count or duplicate them
as `right_catalog` rows unless a separately approved schema change introduces
explicit module-visibility permissions.

After applying the migration, the DB Admin can verify the seed with:

```sql
SELECT role_id, role_code, role_name, is_deleted
FROM public.role
ORDER BY role_code;

SELECT module_id, module_code, module_name, is_deleted
FROM public.module
WHERE NOT is_deleted
ORDER BY module_code;

SELECT count(*) AS active_right_count
FROM public.right_catalog
WHERE NOT is_deleted;

SELECT public.default_user_role_id();
```

## Creating a new migration

1. From the project root, create a migration:

   ```bash
   npx supabase migration new your_migration_name
   ```

2. Write your SQL in the new file under `supabase/migrations/`.
3. Never edit a migration that has already been pushed. Open a PR with your new migration.

## Troubleshooting

- **`supabase: command not found`** — Use `npx supabase ...`; the CLI is not installed globally.
- **Linking asks for a ref, not a URL** — Use the project ref `xpfojvcfhudwtritpofx`, not the project URL.
- **Commands fail or files seem missing** — Run commands from `Hope-Inc.-Midterm-Project`, the folder containing `package.json` and `.git`.

## Rules

- Never commit `.env.local`, passwords, anon keys, or the service role key.
- Never commit directly to `main`.
