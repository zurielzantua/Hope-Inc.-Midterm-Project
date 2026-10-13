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
npm install
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
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

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
