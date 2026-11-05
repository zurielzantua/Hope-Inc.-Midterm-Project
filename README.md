# Hope Inc. Midterm Project

This repository contains the HOPE Inc. ERP web application, built with Next.js App Router, React, Tailwind CSS, TypeScript, and Supabase.

The Sprint 1 application includes registration, account and permission management, and a protected ERP dashboard. Supabase Auth manages identities and sessions; server-side authorization and database Row Level Security (RLS) protect access.

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
- TypeScript

## User Roles

The application is designed around the following roles:

- superadmin
- admin
- user

Public registrations always receive the `user` role and `pending` approval state. Users cannot choose Admin or Superadmin during registration; a Superadmin approves accounts and may designate approved Users as Admins.

## Security Requirements

The following security standards should be followed throughout the project:

- Enable Row Level Security (RLS) on all Supabase tables.
- Enforce account-state, role, and action-right checks on the server as well as in RLS policies.
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

Trusted server-side account checks and administrative operations use `SUPABASE_SECRET_KEY`. Set it in local `.env.local` and the deployment's server-only environment. Never rename it to a `NEXT_PUBLIC_*` variable or expose it to the browser. Public registration also requires IP-based rate limiting at the deployment edge before production use; this repository does not include a shared rate-limit service.

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

## ERP Dashboard and Permissions

Admins and Superadmins manage accounts through User Management; the Rights
Management dialog assigns per-action access. New public registrations remain
regular Users with Pending approval until a Superadmin approves them.

The protected `/erp` dashboard shows module tiles only when the signed-in account
has an active right in that module. Module access is rechecked on direct URL
requests. Admins and Superadmins can open User Management; only Superadmins can
open System Settings. Pending, blocked, deleted, and unauthorized accounts are
denied protected access.

The module destinations currently provide permission-gated workspace shells.
Customer, Product, Human Resources, Sales, and Reports operations are planned for
later sprints and are not implemented here.

Before opening a Pull Request, run `npm run check:db`, `npm run build`, and the
tests relevant to the task. Link the PR to its GitHub issue and request teammate
review.

## Development Workflow

- Work on the branch assigned to your team role.
- Open a Pull Request targeting `setup/initial-project-structure` and reference the related issue.
- Keep commits focused and descriptive; get teammate review before merging.

## Planned Business Modules

- Sprint 2: Customers and Products
- Sprint 3: Human Resources
- Sprint 4: Sales and Reports

## Notes

This project is under active development. See the Sprint 1 board and module map
for task ownership and the planned module schedule.

## License

This project is currently under active development and does not yet have a final license declaration.
