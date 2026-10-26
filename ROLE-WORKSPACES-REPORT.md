# ResolveAI role/workspace refinement

## Architecture

Before: students had their portal, but officers/admins shared one generic officer workspace. Staff policies and the service-backed bootstrap permitted all staff to read all cases; the dashboard used the fixed demo officer's cell.

After: one Student Portal, one reusable Cell Officer Workspace driven by trusted `profiles.cell_id`, and one Admin/Main Officer Command Center. There are no department-specific React pages. Server guards redirect other roles to their own workspace. Case pages verify access before returning case UI. Bootstrap queries are scoped before fetching related history/evidence, and action endpoints verify current ownership independently of the UI.

## Ownership and authorization

- Student: own complaints and existing submission/tracking/response flow only.
- Officer: current case `cell_id` must equal a valid configured profile `cell_id`. No-cell or unknown-cell officers receive no case data or action permissions. The no-cell layout displays an assignment/configuration message.
- Admin: all cases and cells, with authorized cross-cell intervention through the same action implementation.
- `src/lib/authorization.ts` centralizes workspace destinations, role boundaries, read/action predicates and audit attribution. Auth profiles come from the trusted database after Supabase `getUser()`, never signup metadata or action payload roles/cells.
- Original recommendation remains `recommended_cell_id` plus the original intelligence result. Current ownership remains the existing `complaints.cell_id`; no duplicate current-cell column was added.
- `src/lib/cells.ts` contains the canonical application cell definitions. Existing IDs and demo names are preserved: `student`, `approval`, `finance`, `records`. The database registry matches these definitions and is checked by a regression test.

## Workspace behavior

Cell officers see their name, Cell Officer role and configured cell in the navigation, header and dashboard. Dashboard metrics, priority queue, recently updated cases, escalations, related cases and institution context all derive from scoped data. Queue status/priority/category/SLA/institution/search/sort controls remain, but the arbitrary cell-scope switch is removed.

Admin routes reuse the same dashboard, queue, case and command-center components. Admin dashboard includes active/routed/waiting/due-soon/overdue/escalated/resolved metrics and configured-cell workloads. Admin command center adds cell and status filters alongside existing category/institution/SLA/time controls. Shared links stay within the appropriate `/admin` or `/officer` workspace.

The former `/officer/command-center` no longer exposes system-wide functionality. An officer is redirected to their own dashboard; an admin entering officer routes is redirected to their admin home.

## Actions and audit

- Request Information: current owner/admin only; Student and Institution recipients supported. Request text and audit actor are persisted; existing student response and SLA handling are preserved.
- Update Status: existing allowlisted transitions and validation remain. Arbitrary browser statuses are rejected.
- Transfer: configured target must differ from current cell and a reason is required. The transaction checks trusted actor/profile and locks the case before mutation. Old-cell access ends, new-cell access begins, and the old officer's client removes the transferred case without receiving the now-inaccessible record. Admin retains access. Original recommendation is unchanged.
- Escalate: current cell stays unchanged; higher-level attention is recorded and visible to Admin. Already-escalated cases are protected.
- Resolve: current owner/admin only, with summary/action/timestamp and actor audit. Further actions on resolved/closed cases remain disabled and are rejected by the database.
- Audit details include trusted actor ID/name/role/cell, previous/current cell and reason. The database overwrites any actor details supplied in the JSON with trusted profile values. Officer/admin case history displays the stored attribution. No similarity/SLA calculation events were added.

## Database changes

New migration: `supabase/migrations/20261025090000_role_cell_workspaces.sql`.

It adds `profiles.cell_id`, a role/cell consistency constraint, a configured-cell registry, cell foreign keys and a current-cell index. It replaces broad staff SELECT policies across complaints, intelligence, events, evidence and responses. Profile writes remain unavailable to browser roles; signup still creates students regardless of supplied role/cell metadata.

The service-only action RPC rechecks actor ownership under row locks and retains optimistic-version protection. Non-transfer actions cannot change cells. A trigger prevents changes to the original recommendation once routing is recorded. The existing analysis RPC's staff predicate is narrowed to the assigned cell/admin. Existing migration history was not edited.

## Verification

- 221 tests passed, zero failures: 124 existing tests plus 97 new checks across four files.
- Tests include actual server guards, actual action handlers with mocked transport, and both migrations executed in isolated PostgreSQL through PGlite. Database tests exercise RLS, forged signup metadata, prohibited profile writes, cross-cell RPC denial, transfer access changes, audit attribution, escalation, resolution, student responses and recommendation immutability.
- Lint passed.
- Standalone TypeScript check passed.
- Production build passed with Cache Components and partial prefetching still enabled.
- Existing intelligence, similarity, SLA, persistence projection, draft restoration and bootstrap lifecycle tests remain passing.
- Live browser verification is **not complete**. The existing browser currently displays “We couldn't load your saved complaints” after the schema-dependent change. The migration/account setup has not been confirmed. Finance/Records/Admin account switching and the live `GRV-2026-9422` lifecycle have not been executed. The database test uses a synthetic record with that ID, not the live record.
- Existing responsive layouts/navigation/dialog components are reused, with additional wrapping and multi-row spacing for longer cell labels and metrics. Live desktop/mobile visual checks remain pending setup; no claim of completed visual verification is made.

## Files created

- `src/lib/cells.ts`, `src/lib/authorization.ts`
- `src/app/admin/layout.tsx`
- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/command-center/page.tsx`
- `src/app/admin/queue/page.tsx`
- `src/app/admin/complaints/[id]/page.tsx`
- `supabase/migrations/20261025090000_role_cell_workspaces.sql`
- `tests/workspace-authorization.test.mjs`
- `tests/workspace-database.test.mjs`
- `tests/workspace-api.test.mjs`
- `tests/workspace-routes.test.mjs`
- `ROLE-WORKSPACES-SETUP.md`, `ROLE-WORKSPACES-REPORT.md`

## Files modified

- `package.json`, `package-lock.json` — PGlite development-only database test dependency.
- `src/lib/officer-model.ts` — reuses canonical cells.
- `src/lib/supabase/auth.ts` — trusted cell-aware profiles and role destinations.
- `src/lib/persistence/api.ts`, `src/lib/persistence/mapper.ts` — scoped loads and audit projection.
- `src/lib/complaint-tracking.ts` — optional audit metadata type.
- `src/app/api/complaints/route.ts`
- `src/app/api/complaints/[id]/actions/route.ts`
- `src/app/api/complaints/[id]/analysis/route.ts`
- `src/app/api/complaints/[id]/responses/route.ts`
- `src/components/ComplaintStoreProvider.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/components/officer/OfficerDemoProvider.tsx`
- `src/components/officer/OfficerNav.tsx`
- `src/components/officer/OfficerDashboard.tsx`
- `src/components/officer/ComplaintQueue.tsx`
- `src/components/officer/OfficerCommandCenter.tsx`
- `src/components/officer/OfficerCase.tsx`
- `src/components/officer/OfficerCaseSections.tsx`
- `src/components/officer/RelatedComplaints.tsx`
- `src/app/officer/layout.tsx`, `src/app/officer/officer.css`
- `src/app/officer/command-center/page.tsx`
- `src/app/officer/complaints/[id]/page.tsx`
- `src/app/student/layout.tsx`, `src/components/student/StudentNav.tsx` — Student Portal labels only.

## Manual setup and remaining limits

Follow `ROLE-WORKSPACES-SETUP.md` for exact SQL Editor instructions, email-based profile assignments without hardcoded database IDs, account verification and workspace URLs. No live migration, privilege assignment or case mutation was executed by the implementation scripts.

Apply the new migration before using the updated authenticated application. Configure Aarav as officer/finance, a separate Records account as officer/records, and an Admin account as admin/null. Do not share secrets in chat.

The existing fixed prototype SLA clock is retained. Other open sessions need a reload/session refresh to update their displayed queue after an external transfer; every action still checks current ownership in the database. There is no new realtime subscription, account-management frontend, deployment, official AICTE mapping, or unrelated feature work.
