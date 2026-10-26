# ResolveAI

ResolveAI is a Smart India Hackathon prototype for managing student grievances. It demonstrates complaint submission, tracking, and staff workflows; it is not an official AICTE service.

## Features

- Student, officer, and admin demo workspaces for complaint intake and case review.
- Complaint status tracking, officer responses, and evidence metadata handling.
- Optional server-side AI-assisted complaint analysis and related-complaint suggestions.
- Institution issue-pattern views and an officer command center with demo SLA monitoring.
- Optional Supabase authentication and persistence; without Supabase configuration, the app uses local in-memory demo data.

All sample institutions, complaints, people, and metrics are fictional. Routing cells and SLA values are illustrative prototype data, not official AICTE mappings or policies.

## Stack

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Supabase Auth and Postgres for optional persistent mode
- Groq's OpenAI-compatible API for optional complaint analysis
- GSAP, Lenis, and Three.js for selected interface effects

## Local setup

Use Node.js 24 (the version used for project verification) and npm.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. Without Supabase settings, the app runs in demo mode and does not persist data.

To enable persistent mode, copy `.env.example` to `.env.local` and set the Supabase values listed below. To enable AI analysis, also set the optional Groq key. Keep server-side credentials private and never commit `.env.local`.

### Environment variable names

Persistent mode:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

Optional AI analysis:

- `GROQ_API_KEY` (server-side only)
- `GROQ_MODEL` (optional model selection)

`.env.example` lists variable names with blank values; obtain credentials from the respective provider dashboards.

## Supabase setup

Create a Supabase project, configure the three persistent-mode variables, then apply every SQL migration in `supabase/migrations/` in timestamp order using the Supabase CLI or SQL Editor. Configure Auth email confirmation and redirect URLs for your environment. New users receive the student role; assign staff roles only through a trusted administrative workflow. Review the migrations and authorization policies in a non-production project before deployment.

## Checks

```sh
npm test
npm run lint
npm run typecheck
npm run build
```
