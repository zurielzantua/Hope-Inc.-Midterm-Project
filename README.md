# Hope Inc. Midterm Project

This repository is the initial foundation for the Hope Inc. midterm project, built with Next.js App Router, Tailwind CSS, and Supabase.

It is intended to support a role-based application experience for users, admins, and superadmins, with secure database access enforced through Supabase Row Level Security (RLS).

## Project Overview

Hope Inc. is a modern web application designed to manage users and access levels in a clean, responsive, and secure environment. The project focuses on:

- Role-based authentication and authorization
- Modern UI built with Tailwind CSS
- Secure data handling using Supabase
- Scalable structure using Next.js App Router

## Core Tech Stack

- Next.js
- React
- Tailwind CSS
- Supabase Auth
- Supabase Database
- TypeScript (recommended for development)

## User Roles

The application is designed around the following roles:

- superadmin
- admin
- user

For development environments, the default role assigned to new signups is:

- superadmin

## Security Requirements

The following security standards should be followed throughout the project:

- Enable Row Level Security (RLS) on all Supabase tables.
- Restrict data access based on authenticated user roles.
- Validate all user inputs before writing to the database.
- Keep secrets and environment variables out of version control.

## Project Goals

- Deliver a polished and responsive user experience
- Support secure access using role-based permissions
- Provide a maintainable, modular code structure
- Prepare a strong foundation for future feature expansion

## Recommended Folder Structure

```bash
.
├── app/
│   ├── api/
│   ├── auth/
│   ├── dashboard/
│   └── globals.css
├── components/
│   ├── auth/
│   ├── layout/
│   └── ui/
├── lib/
│   ├── supabase/
│   ├── utils/
│   └── auth.ts
├── public/
├── .env.local.example
├── package.json
├── tailwind.config.ts
├── next.config.js
├── README.md
└── tsconfig.json
```

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm ci
```

3. Set up your environment variables:

```bash
cp .env.local.example .env.local
```

4. Configure Supabase credentials in `.env.local`
5. Run the development server:

```bash
npm run dev
```

6. Open your browser to:

```bash
http://localhost:3000
```

## Environment Variables

Example variables to configure:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` accepts the project's `sb_publishable_...` key
or its legacy anon key. Never put a secret/service-role key or database password
in these variables. `.env.local` is ignored by Git; the example contains placeholders.

### S1-DEV-01: Supabase connection (issue #8)

Prerequisite: Node.js 20.9 or newer. On Windows PowerShell use `npm.cmd`
if execution policy blocks `npm.ps1`:

```powershell
npm.cmd ci
Copy-Item .env.local.example .env.local
# Fill in your project URL and publishable key locally, then:
npm.cmd run check:db
npm.cmd run dev
```

Copy the example only on first setup; do not overwrite an existing `.env.local`.
Restart the development server after changing environment variables.

`npm run check:db` sends a read-only HEAD query to the existing `product` table.
Set `SUPABASE_CHECK_TABLE` to another public HOPE table if agreed with the DB Admin.
A successful response verifies the database API connection, even when RLS returns
no visible rows. It does not prove that authenticated users have the correct rights.
Failures exit with a nonzero code; the DB Admin should check table availability,
Data API grants and RLS policies. Never disable RLS to make the check pass.

With the development server running, open `/api/health/supabase` to check the
website's server connection. Success returns `{"connected":true}`; failures return
HTTP 503. The diagnostic returns HTTP 404 in production and never returns records.

Client helpers:
- `lib/supabase/client.ts`: lazy browser client via `getSupabaseBrowserClient()`.
- `lib/supabase/server.ts`: stateless anonymous server client via
  `createSupabasePublicServerClient()`; it does not load signed-in user cookies.

Registration, cookie-based login/session handling, password reset, roles and the
protected dashboard remain DEV-02 through DEV-08. The existing authentication
controls are still UI placeholders. No role-assignment behavior is introduced here.

Verification before review: `npm ci`, `npm run check:db`, and `npm run build`.
Link the PR to #8; teammate approval and merge are still required.

## Development Workflow

- Use feature branches for all work.
- Never commit directly to the main branch.
- Keep commits focused and descriptive.
- Review changes before merging into the main branch.

## Planned Highlights

- Authentication and login flow
- Signup and role assignment
- Dashboard layouts for different user types
- User management and permissions
- Secure database schema with RLS policies

## Notes

This README is an initial project setup document and may evolve as the application grows. The project structure and implementation details will be refined as features are added.

## License

This project is currently under active development and does not yet have a final license declaration.
