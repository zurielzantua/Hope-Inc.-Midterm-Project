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

The public `authenticated` role can read its own non-deleted profile and
permissions, and can read non-deleted catalogues. There are no client write
policies for account or permission data; provisioning, approval, role changes,
and permission grants/revocations must use a trusted server-side operation.
Soft deletion is performed by setting `is_deleted = true`; restoration clears
that flag on the existing record.

The script first shows a dry run, then asks for confirmation before pushing.

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
