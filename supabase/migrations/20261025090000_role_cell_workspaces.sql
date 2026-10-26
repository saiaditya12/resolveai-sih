-- Run after 20261024180000_phase10_persistence_auth.sql. No existing roles are promoted.
begin;
create table public.review_cells (
 id text primary key,
 name text not null,
 description text not null
);
-- Registry snapshot of src/lib/cells.ts; new configured cells require a registry migration.
insert into public.review_cells values
 ('student','Demo Student Grievance Cell','Student support and general academic concerns.'),
 ('approval','Demo Approval Review Cell','Approval and recognition concerns.'),
 ('finance','Demo Finance/Refund Review Cell','Fees and admission refunds.'),
 ('records','Demo Academic Records Cell','Student records and transcripts.');
alter table public.review_cells enable row level security;
create policy "authenticated reads configured cells" on public.review_cells for select to authenticated using (true);
revoke all on public.review_cells from anon, authenticated;
grant select on public.review_cells to authenticated, service_role;
alter table public.profiles add column cell_id text references public.review_cells(id);
alter table public.profiles add constraint profile_cell_role check (role = 'officer' or cell_id is null);
alter table public.complaints drop constraint complaints_cell_id_check;
alter table public.complaints drop constraint complaints_recommended_cell_id_check;
alter table public.complaints add constraint complaint_current_cell_fk foreign key (cell_id) references public.review_cells(id);
alter table public.complaints add constraint complaint_recommendation_cell_fk foreign key (recommended_cell_id) references public.review_cells(id);
create index complaints_current_cell on public.complaints(cell_id, updated_at desc);

create or replace function public.can_read_case(p_student uuid, p_cell text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (
   p.role = 'admin' or (p.role = 'student' and p.id = p_student)
   or (p.role = 'officer' and p.cell_id is not null and p.cell_id = p_cell)
 ));
$$;
revoke all on function public.can_read_case(uuid,text) from public, anon;
grant execute on function public.can_read_case(uuid,text) to authenticated;
drop policy "students and staff read allowed complaints" on public.complaints;
create policy "scoped complaint access" on public.complaints for select to authenticated
 using (public.can_read_case(student_id, cell_id));
drop policy "students and staff read allowed intelligence" on public.complaint_intelligence;
create policy "scoped case relations" on public.complaint_intelligence for select to authenticated
 using (exists (select 1 from public.complaints c where c.id = complaint_id and public.can_read_case(c.student_id,c.cell_id)));
drop policy "students and staff read allowed events" on public.complaint_events;
create policy "scoped case relations" on public.complaint_events for select to authenticated
 using (exists (select 1 from public.complaints c where c.id = complaint_id and public.can_read_case(c.student_id,c.cell_id)));
drop policy "students and staff read allowed evidence metadata" on public.complaint_evidence;
create policy "scoped case relations" on public.complaint_evidence for select to authenticated
 using (exists (select 1 from public.complaints c where c.id = complaint_id and public.can_read_case(c.student_id,c.cell_id)));
drop policy "students and staff read allowed responses" on public.complaint_responses;
create policy "scoped case relations" on public.complaint_responses for select to authenticated
 using (exists (select 1 from public.complaints c where c.id = complaint_id and public.can_read_case(c.student_id,c.cell_id)));
-- Neither browser profile updates nor user metadata may assign roles/cells.
revoke insert, update, delete on public.profiles from anon, authenticated;
create or replace function public.protect_original_recommendation()
returns trigger language plpgsql set search_path = '' as $$
begin
 if old.routing_status <> 'pending' and new.recommended_cell_id is distinct from old.recommended_cell_id then
   raise exception 'original recommendation is immutable';
 end if;
 return new;
end;
$$;
create trigger original_recommendation_immutable before update on public.complaints
 for each row execute function public.protect_original_recommendation();
create or replace function public.persist_officer_action(
  p_actor_id uuid,
  p_complaint_id text,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_event jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_case public.complaints%rowtype;
 v_actor public.profiles%rowtype;
 v_action text := p_event -> 'details' ->> 'action';
 v_details jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'forbidden'; end if;
 -- Serialize ownership checks and mutation. Recheck trusted profile on every action.
 select * into v_actor from public.profiles where id = p_actor_id for share;
 select * into v_case from public.complaints where id = p_complaint_id for update;
 if v_case.id is null or v_actor.id is null or not (
   v_actor.role = 'admin' or (v_actor.role = 'officer' and v_actor.cell_id is not null and v_actor.cell_id = v_case.cell_id)
 ) then raise exception 'forbidden'; end if;
 if v_case.updated_at is distinct from p_expected_updated_at or v_case.status in ('Resolved','Closed') then
   raise exception 'stale complaint or finalised case';
 end if;
 if not exists (select 1 from public.review_cells where id = p_patch ->> 'cell_id')
   or coalesce(v_action,'') not in ('request','status','transfer','escalate','resolve') then
   raise exception 'invalid action';
 end if;
 if v_action = 'transfer' then
   if p_patch ->> 'cell_id' = v_case.cell_id or length(trim(coalesce(p_event -> 'details' ->> 'reason',''))) < 10
     or p_patch ->> 'status' is distinct from v_case.status then raise exception 'invalid transfer'; end if;
 elsif p_patch ->> 'cell_id' is distinct from v_case.cell_id then
   raise exception 'only transfer changes ownership';
 end if;
 if v_action = 'escalate' and (v_case.status = 'Escalated' or p_patch ->> 'status' <> 'Escalated'
   or length(trim(coalesce(p_patch ->> 'escalation_reason',''))) < 10) then raise exception 'invalid escalation'; end if;
 if v_action = 'status' and coalesce(p_patch ->> 'status','') not in ('Officer Review','Student Action Required','Institution Response Requested') then
   raise exception 'invalid status'; end if;
 if v_action = 'request' and (coalesce(p_patch ->> 'status','') not in ('Student Action Required','Institution Response Requested')
   or length(trim(coalesce(p_event ->> 'explanation',''))) < 10) then raise exception 'invalid request'; end if;
 if v_action = 'resolve' and (p_patch ->> 'status' <> 'Resolved'
   or length(trim(coalesce(p_patch -> 'resolution' ->> 'summary',''))) < 10
   or length(trim(coalesce(p_patch -> 'resolution' ->> 'action',''))) < 10) then raise exception 'invalid resolution'; end if;
 v_details := coalesce(p_event -> 'details','{}'::jsonb) || jsonb_build_object(
   'actor_id',v_actor.id,'actor_name',v_actor.display_name,'actor_role',v_actor.role,'actor_cell',v_actor.cell_id,
   'from_cell',v_case.cell_id,'to_cell',p_patch ->> 'cell_id');
  update public.complaints set
    status = p_patch ->> 'status',
    cell_id = p_patch ->> 'cell_id',
    routing_status = p_patch ->> 'routing_status',
    overridden_by_officer = coalesce((p_patch ->> 'overridden_by_officer')::boolean, false),
    request = p_patch -> 'request',
    resolution = p_patch -> 'resolution',
    escalation_reason = p_patch ->> 'escalation_reason',
    institution_response = p_patch -> 'institution_response',
    due_at = nullif(p_patch ->> 'due_at', '')::timestamptz,
    resolved_at = nullif(p_patch ->> 'resolved_at', '')::timestamptz,
    updated_at = (p_patch ->> 'updated_at')::timestamptz
  where id = p_complaint_id and updated_at = p_expected_updated_at
    and status not in ('Resolved', 'Closed');
  if not found then raise exception 'stale complaint or finalised case'; end if;
  insert into public.complaint_events (
    id, complaint_id, at, actor_type, actor_id, event_type, title, explanation, details
  ) values (
    (p_event ->> 'id')::uuid, p_complaint_id,
    (p_event ->> 'at')::timestamptz, 'Demo Officer', p_actor_id,
    p_event ->> 'event_type', p_event ->> 'title',
    coalesce(p_event ->> 'explanation', ''), v_details
  );
end;
$$;

revoke all on function public.persist_officer_action(uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.persist_officer_action(uuid,text,timestamptz,jsonb,jsonb) to service_role;
create or replace function public.persist_complaint_analysis(
  p_actor_id uuid,
  p_complaint_id text,
  p_expected_updated_at timestamptz,
  p_patch jsonb,
  p_result jsonb,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_item jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  select student_id into v_owner from public.complaints
  where id = p_complaint_id for update;
  if v_owner is null or not exists (
    select 1 from public.profiles
    where id = p_actor_id and (role = 'student' and id = v_owner or role = 'admin' or (role = 'officer' and cell_id is not null and cell_id = (select c.cell_id from public.complaints c where c.id = p_complaint_id)))
  ) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.complaint_intelligence where complaint_id = p_complaint_id) then
    raise exception 'analysis already recorded';
  end if;
  if not exists (
    select 1 from public.complaints
    where id = p_complaint_id and updated_at = p_expected_updated_at
  ) then raise exception 'stale complaint'; end if;
  insert into public.complaint_intelligence (
    complaint_id, summary, category, subcategory, priority, urgency_reason,
    recommended_cell_id, routing_reason, confidence, source,
    needs_manual_review, review_recommendation, manual_review_reason,
    analyzed_at, result
  ) values (
    p_complaint_id, p_result ->> 'summary', p_result ->> 'category',
    coalesce(p_result ->> 'subcategory', ''), p_result ->> 'priority',
    p_result ->> 'urgencyReason', p_result ->> 'recommendedCellId',
    p_result ->> 'routingReason', (p_result ->> 'confidence')::numeric,
    p_result ->> 'source', (p_result ->> 'needsManualReview')::boolean,
    (p_result ->> 'reviewRecommended')::boolean,
    p_result ->> 'manualReviewReason',
    (p_result ->> 'analyzedAt')::timestamptz, p_result
  );
  update public.complaints set
    category = p_patch ->> 'category',
    priority = p_patch ->> 'priority',
    status = p_patch ->> 'status',
    cell_id = p_patch ->> 'cell_id',
    routing_status = p_patch ->> 'routing_status',
    recommended_cell_id = nullif(p_patch ->> 'recommended_cell_id', ''),
    routed_at = nullif(p_patch ->> 'routed_at', '')::timestamptz,
    overridden_by_officer = coalesce((p_patch ->> 'overridden_by_officer')::boolean, false),
    summary = coalesce(p_patch -> 'summary', '{}'::jsonb),
    updated_at = (p_patch ->> 'updated_at')::timestamptz
  where id = p_complaint_id;
  for v_item in select value from jsonb_array_elements(p_events)
  loop
    insert into public.complaint_events (
      id, complaint_id, at, actor_type, actor_id, event_type, title, explanation, details
    ) values (
      coalesce(nullif(v_item ->> 'id', '')::uuid, gen_random_uuid()),
      p_complaint_id, (v_item ->> 'at')::timestamptz,
      coalesce(v_item ->> 'actor', 'System'), p_actor_id,
      coalesce(v_item ->> 'event_type', 'analysis'), v_item ->> 'title',
      coalesce(v_item ->> 'explanation', ''), coalesce(v_item -> 'details', '{}'::jsonb)
    );
  end loop;
end;
$$;


commit;
