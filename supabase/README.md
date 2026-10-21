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
