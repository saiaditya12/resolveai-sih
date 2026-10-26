create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'student' check (role in ('student', 'officer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id text primary key,
  student_id uuid not null references public.profiles(id),
  institution text not null,
  title text not null,
  description text not null,
  selected_category_hint text,
  category text not null default 'Other',
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  status text not null default 'Submitted'
    check (status in (
      'Submitted', 'Initial Review', 'Routed', 'Assigned', 'Officer Review',
      'Institution Response Requested', 'Student Action Required', 'Escalated',
      'Resolved', 'Closed'
    )),
  cell_id text not null default 'student'
    check (cell_id in ('student', 'approval', 'finance', 'records')),
  due_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  incident_date date,
  contacted boolean,
  contact_date date,
  contact_response text not null default '',
  routing_status text not null default 'pending'
    check (routing_status in ('pending', 'routed', 'manual-review')),
  recommended_cell_id text
    check (recommended_cell_id is null or recommended_cell_id in ('student', 'approval', 'finance', 'records')),
  routed_at timestamptz,
  overridden_by_officer boolean not null default false,
  request jsonb,
  resolution jsonb,
  escalation_reason text,
  institution_response jsonb,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.complaint_intelligence (
  complaint_id text primary key references public.complaints(id) on delete cascade,
  summary text not null,
  category text not null,
  subcategory text not null default '',
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Critical')),
  urgency_reason text not null,
  recommended_cell_id text,
  routing_reason text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  source text not null,
  needs_manual_review boolean not null,
  review_recommendation boolean not null,
  manual_review_reason text,
  analyzed_at timestamptz not null,
  result jsonb not null
);

create table if not exists public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('Student', 'System', 'Demo Cell', 'Demo Officer', 'Demo Institution')),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  explanation text not null default '',
  details jsonb not null default '{}'::jsonb
);
create index if not exists complaint_events_case_time
  on public.complaint_events (complaint_id, at, id);

create table if not exists public.complaint_evidence (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.complaint_responses (
  id uuid primary key default gen_random_uuid(),
  complaint_id text not null references public.complaints(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  request_event_id uuid not null references public.complaint_events(id),
  response_text text not null check (length(response_text) between 10 and 3000),
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (complaint_id, request_event_id)
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.profile_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('officer', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_intelligence enable row level security;
alter table public.complaint_events enable row level security;
alter table public.complaint_evidence enable row level security;
alter table public.complaint_responses enable row level security;

drop policy if exists "profile owner reads own profile" on public.profiles;
create policy "profile owner reads own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
revoke update, insert, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "students and staff read allowed complaints" on public.complaints;
create policy "students and staff read allowed complaints" on public.complaints
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.profile_is_staff()
  );
revoke insert, update, delete on public.complaints from anon, authenticated;
grant select on public.complaints to authenticated;

drop policy if exists "students and staff read allowed intelligence" on public.complaint_intelligence;
create policy "students and staff read allowed intelligence" on public.complaint_intelligence
  for select to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (c.student_id = (select auth.uid()) or public.profile_is_staff())
    )
  );
revoke insert, update, delete on public.complaint_intelligence from anon, authenticated;
grant select on public.complaint_intelligence to authenticated;

drop policy if exists "students and staff read allowed events" on public.complaint_events;
create policy "students and staff read allowed events" on public.complaint_events
  for select to authenticated
  using (
    exists (
      select 1 from public.complaints c
      where c.id = complaint_id
        and (c.student_id = (select auth.uid()) or public.profile_is_staff())
    )
  );
revoke insert, update, delete on public.complaint_events from anon, authenticated;
grant select on public.complaint_events to authenticated;

drop policy if exists "students and staff read allowed evidence metadata" on public.complaint_evidence;
create policy "students and staff read allowed evidence metadata" on public.complaint_evidence
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.profile_is_staff()
  );
revoke insert, update, delete on public.complaint_evidence from anon, authenticated;
grant select on public.complaint_evidence to authenticated;

drop policy if exists "students and staff read allowed responses" on public.complaint_responses;
create policy "students and staff read allowed responses" on public.complaint_responses
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or public.profile_is_staff()
  );
revoke insert, update, delete on public.complaint_responses from anon, authenticated;
grant select on public.complaint_responses to authenticated;

create or replace function public.create_student_complaint(
  p_student_id uuid,
  p_complaint jsonb,
  p_evidence jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := p_complaint ->> 'id';
  v_at timestamptz := (p_complaint ->> 'submitted_at')::timestamptz;
  v_item jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student') then
    raise exception 'forbidden';
  end if;
  if v_id !~ '^GRV-[0-9]{4}-[0-9]{4,}$'
    or length(trim(coalesce(p_complaint ->> 'title', ''))) not between 5 and 120
    or length(trim(coalesce(p_complaint ->> 'description', ''))) not between 50 and 3000
    or length(trim(coalesce(p_complaint ->> 'institution', ''))) not between 2 and 160
    or coalesce(jsonb_typeof(p_evidence), 'null') <> 'array'
    or jsonb_array_length(p_evidence) > 5 then
    raise exception 'invalid complaint';
  end if;
  insert into public.complaints (
    id, student_id, institution, title, description, selected_category_hint,
    category, status, priority, cell_id, due_at, submitted_at, updated_at,
    incident_date, contacted, contact_date, contact_response
  ) values (
    v_id, p_student_id, trim(p_complaint ->> 'institution'),
    trim(p_complaint ->> 'title'), trim(p_complaint ->> 'description'),
    nullif(p_complaint ->> 'selected_category_hint', ''),
    coalesce(nullif(p_complaint ->> 'selected_category_hint', ''), 'Other'),
    'Submitted', 'Medium', 'student', null, v_at, v_at,
    nullif(p_complaint ->> 'incident_date', '')::date,
    coalesce((p_complaint ->> 'contacted')::boolean, false),
    nullif(p_complaint ->> 'contact_date', '')::date,
    coalesce(p_complaint ->> 'contact_response', '')
  );
  insert into public.complaint_events (
    complaint_id, at, actor_type, actor_id, event_type, title, explanation
  ) values (
    v_id, v_at, 'Student', p_student_id, 'complaint_submitted',
    'Complaint submitted', 'Complaint recorded in the authenticated student account.'
  );
  for v_item in select value from jsonb_array_elements(p_evidence)
  loop
    if length(coalesce(v_item ->> 'name', '')) not between 1 and 255
      or coalesce(v_item ->> 'type', '') not in ('application/pdf', 'image/png', 'image/jpeg')
      or coalesce((v_item ->> 'size')::bigint, 0) not between 1 and 5242880 then
      raise exception 'invalid evidence metadata';
    end if;
    insert into public.complaint_evidence
      (complaint_id, student_id, name, mime_type, size_bytes, created_at)
    values
      (v_id, p_student_id, v_item ->> 'name', v_item ->> 'type',
       (v_item ->> 'size')::bigint, v_at);
  end loop;
  return v_id;
end;
$$;

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
    where id = p_actor_id and (id = v_owner or role in ('officer', 'admin'))
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
begin
  if auth.role() <> 'service_role'
    or not exists (select 1 from public.profiles where id = p_actor_id and role in ('officer', 'admin')) then
    raise exception 'forbidden';
  end if;
  if (p_patch ->> 'status') <> all(array[
    'Submitted', 'Initial Review', 'Routed', 'Assigned', 'Officer Review',
    'Institution Response Requested', 'Student Action Required', 'Escalated',
    'Resolved', 'Closed'
  ]) or (p_patch ->> 'cell_id') <> all(array['student', 'approval', 'finance', 'records']) then
    raise exception 'invalid action';
  end if;
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
    coalesce(p_event ->> 'explanation', ''), coalesce(p_event -> 'details', '{}'::jsonb)
  );
end;
$$;

create or replace function public.persist_student_response(
  p_actor_id uuid,
  p_complaint_id text,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_event uuid;
  v_at timestamptz := (p_response ->> 'at')::timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
  select e.id into v_request_event
  from public.complaint_events e
  join public.complaints c on c.id = e.complaint_id
  where c.id = p_complaint_id and c.student_id = p_actor_id
    and c.status = 'Student Action Required'
    and e.event_type = 'information_requested_student'
  order by e.at desc limit 1;
  if v_request_event is null
    or length(trim(coalesce(p_response ->> 'text', ''))) not between 10 and 3000
    or coalesce(jsonb_typeof(p_response -> 'evidence'), 'array') <> 'array'
    or jsonb_array_length(coalesce(p_response -> 'evidence', '[]'::jsonb)) > 5 then
    raise exception 'response not allowed';
  end if;
  insert into public.complaint_responses (
    complaint_id, student_id, request_event_id, response_text, evidence, created_at
  ) values (
    p_complaint_id, p_actor_id, v_request_event,
    trim(p_response ->> 'text'), coalesce(p_response -> 'evidence', '[]'::jsonb), v_at
  );
  update public.complaints set
    status = 'Officer Review', request = null, updated_at = v_at
  where id = p_complaint_id and student_id = p_actor_id
    and status = 'Student Action Required';
  if not found then raise exception 'response not allowed'; end if;
  insert into public.complaint_events (
    complaint_id, at, actor_type, actor_id, event_type, title, explanation
  ) values (
    p_complaint_id, v_at, 'Student', p_actor_id, 'student_responded',
    'Student response recorded', 'Student information was recorded in the case.'
  );
end;
$$;

revoke all on function public.create_student_complaint(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.persist_complaint_analysis(uuid, text, timestamptz, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.persist_officer_action(uuid, text, timestamptz, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.persist_student_response(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_student_complaint(uuid, jsonb, jsonb) to service_role;
grant execute on function public.persist_complaint_analysis(uuid, text, timestamptz, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.persist_officer_action(uuid, text, timestamptz, jsonb, jsonb) to service_role;
grant execute on function public.persist_student_response(uuid, text, jsonb) to service_role;
revoke all on function public.profile_is_staff() from public, anon;
grant execute on function public.profile_is_staff() to authenticated;
grant select on public.profiles, public.complaints, public.complaint_intelligence,
  public.complaint_events, public.complaint_evidence, public.complaint_responses
  to service_role;
grant insert, update, delete on public.profiles, public.complaints,
  public.complaint_intelligence, public.complaint_events,
  public.complaint_evidence, public.complaint_responses to service_role;
