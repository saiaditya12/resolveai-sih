# Role workspaces — Supabase setup

## Apply the new migration

Run `supabase/migrations/20261025090000_role_cell_workspaces.sql` once in the **configured development Supabase project's SQL Editor**, after the existing Phase 10 migration. The original migration has not been edited. No deployment is included in this work.

The new application expects `profiles.cell_id`. Apply the migration before using the updated authenticated application. Existing officers start with `cell_id = null` and receive no complaint access until assigned. Nothing automatically promotes or assigns an account.

The migration adds a review-cell registry, profile assignment, foreign keys, scoped RLS on complaints and all related tables, an immutable-recommendation trigger, and locked ownership checks in the action RPC. `complaints.cell_id` remains the **current** responsibility; `recommended_cell_id` and the intelligence result remain the original recommendation. No duplicate ownership column is introduced.

## Assign existing accounts

Use Supabase Authentication → Users to identify the exact account email. Do not identify accounts only by display name, and do not paste passwords or keys into this chat.

First inspect the intended account (replace the example email):

```sql
select u.email, p.id, p.display_name, p.role, p.cell_id
from auth.users u join public.profiles p on p.id = u.id
where lower(u.email) = lower('aarav-test@example.com');
```

After verifying the row is Aarav Sharma's intended demo account, assign Finance:

```sql
update public.profiles p
set role = 'officer', cell_id = 'finance'
from auth.users u
where p.id = u.id and lower(u.email) = lower('aarav-test@example.com')
returning p.id, p.display_name, p.role, p.cell_id;
```

For a Records officer, create a separate test account through `/register` or Supabase Authentication → Users. Complete any email confirmation using your normal test setup. New accounts always start as students regardless of signup metadata. Then run:

```sql
update public.profiles p
set role = 'officer', cell_id = 'records'
from auth.users u
where p.id = u.id and lower(u.email) = lower('records-test@example.com')
returning p.id, p.display_name, p.role, p.cell_id;
```

For the Admin/Main Officer, create another account the same way, verify its email, then run:

```sql
update public.profiles p
set role = 'admin', cell_id = null
from auth.users u
where p.id = u.id and lower(u.email) = lower('admin-test@example.com')
returning p.id, p.display_name, p.role, p.cell_id;
```

Verify all three accounts:

```sql
select u.email, p.display_name, p.role, p.cell_id, c.name as assigned_cell
from public.profiles p
join auth.users u on u.id = p.id
left join public.review_cells c on c.id = p.cell_id
where lower(u.email) in (
 'aarav-test@example.com', 'records-test@example.com', 'admin-test@example.com'
);
```

Replace every example email with the intended account. Sign out and back in after assignments to refresh the workspace. The browser cannot update profile roles/cells, and ordinary admins do not receive a browser-based account administration API.

## URLs and live verification

- Student: `/student/dashboard`, `/student/complaints/new`, `/student/complaints/GRV-2026-9422`.
- Finance and Records officers use the **same** `/officer/dashboard`, `/officer/queue`, `/officer/complaints/GRV-2026-9422`.
- Admin: `/admin/dashboard`, `/admin/command-center`, `/admin/queue`, `/admin/complaints/GRV-2026-9422`.
- Login: `/login` routes each account to its own role's dashboard. Cross-workspace routes redirect to the trusted role's home. Inaccessible case URLs do not return case content.

Confirm the test case before changing it:

```sql
select id, student_id, status, cell_id as current_responsibility,
       recommended_cell_id as original_recommendation, updated_at
from public.complaints where id = 'GRV-2026-9422';
```

Expected initial responsibility/recommendation: Finance. Finance sees the case; Records does not; Admin sees it. Request information as Finance and respond as its owning student. Transfer to Records with a reason: Finance loses reads/actions immediately, Records gains access, and recommendation remains Finance. Escalate as Records: responsibility remains Records and Admin sees the escalation. Resolve as Records: the student sees the outcome and history. Resolved/closed cases cannot accept further actions.

The implementation tests this lifecycle against synthetic `GRV-2026-9422` data in isolated PostgreSQL (PGlite). This does **not** mean the live record has been changed or tested. Live browser verification requires the migration and configured accounts. No live role assignments or test-case mutations have been performed by the implementation scripts.

## Adding a cell

`src/lib/cells.ts` is the canonical application configuration; routing, transfer validation, selectors, labels and authorization use it. The original IDs remain `student`, `approval`, `finance`, `records`, all explicitly demo cells.

To add a cell, add its configuration and a **new migration** inserting the same ID/name/description into `public.review_cells`; update the registry agreement test to include the new migration. Assign an officer's profile to that ID. No new React dashboard, queue or case pages are needed. Only change category routing if the new cell should receive an existing classification. Do not edit previously applied migrations.

## Limits retained intentionally

- Existing SLA calculations use their fixed prototype scenario clock, not official policy or a live countdown.
- Cell officers' related complaints and institution context include only cases they are authorized to read; Admin sees system-wide context.
- No email/SMS, real institution outreach, production account administration UI, or official AICTE organizational mapping was added.
- Profile assignments are trusted SQL administration, not self-service.
- Other open browser sessions refresh their queue on reload/session refresh; there is no new realtime subscription. Every action rechecks current database ownership, even if a browser displays an old case.
