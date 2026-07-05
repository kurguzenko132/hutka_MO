-- Step 41: simplify UI workflow, source dedupe and activity logs.
-- Safe to run on an existing Hutka Supabase database.

create extension if not exists "uuid-ossp";

create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_title text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.activity_logs enable row level security;

create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

drop policy if exists "Authenticated users can read activity_logs" on public.activity_logs;
create policy "Authenticated users can read activity_logs"
  on public.activity_logs
  for select to authenticated
  using (true);

drop policy if exists "Workspace editors can insert activity_logs" on public.activity_logs;
create policy "Workspace editors can insert activity_logs"
  on public.activity_logs
  for insert to authenticated
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can update activity_logs" on public.activity_logs;
create policy "Workspace editors can update activity_logs"
  on public.activity_logs
  for update to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'))
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can delete activity_logs" on public.activity_logs;
create policy "Workspace editors can delete activity_logs"
  on public.activity_logs
  for delete to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'));

create or replace function public.normalize_source_name(input text)
returns text
language sql
immutable
as $$
  select case
    when trim(coalesce(input, '')) = '' then ''
    when lower(trim(input)) in ('instagram', 'insta', 'ig', 'инстаграм', 'инста') then 'Instagram'
    when lower(trim(input)) in ('telegram', 'tg', 'телеграм', 'телега') then 'Telegram'
    when lower(trim(input)) in ('tiktok', 'тик ток', 'тикток') then 'TikTok'
    else regexp_replace(trim(input), '\s+', ' ', 'g')
  end;
$$;

with ranked_sources as (
  select
    id,
    public.normalize_source_name(name) as normalized_name,
    first_value(id) over (
      partition by public.normalize_source_name(name)
      order by created_at asc, id asc
    ) as keeper_id,
    row_number() over (
      partition by public.normalize_source_name(name)
      order by created_at asc, id asc
    ) as rn
  from public.sources
), reassigned_sources as (
  update public.leads l
  set source_id = ranked_sources.keeper_id
  from ranked_sources
  where l.source_id = ranked_sources.id
    and ranked_sources.rn > 1
  returning l.id
), renamed_sources as (
  update public.sources s
  set name = ranked_sources.normalized_name
  from ranked_sources
  where s.id = ranked_sources.id
    and ranked_sources.rn = 1
    and ranked_sources.normalized_name <> ''
  returning s.id
)
delete from public.sources s
using ranked_sources
where s.id = ranked_sources.id
  and ranked_sources.rn > 1;

create unique index if not exists sources_normalized_name_unique_idx
  on public.sources(public.normalize_source_name(name))
  where public.normalize_source_name(name) <> '';

-- Keep old report view columns in their original order and append new simple names.
-- This avoids Postgres error 42P16 from CREATE OR REPLACE VIEW column renaming.
create or replace view public.view_report_overview as
select
  count(*)::int as total_contacts,
  count(*) filter (where l.created_at >= now() - interval '7 days')::int as new_contacts_week,
  count(*) filter (where l.priority_score >= 75)::int as hot_contacts,
  count(*) filter (where fs.name in ('Заинтересован', 'Опрос') or l.priority_score >= 75)::int as ready_to_pilot,
  count(*) filter (where fs.name in ('Тестирует', 'Тест', 'Активен'))::int as active_participants,
  (select count(*) from public.survey_answers)::int as survey_answers,
  (select count(*) from public.tasks where status != 'done' and due_date < now())::int as overdue_tasks,
  (select count(*) from public.campaigns where status = 'active')::int as active_campaigns,
  (select count(*) from public.insights where status = 'accepted')::int as accepted_insights,
  (select count(*) from public.hypotheses where status in ('new', 'testing', 'needs_data'))::int as hypotheses_in_check,
  count(*) filter (where fs.name in ('Заинтересован', 'Опрос') or l.priority_score >= 75)::int as interested_contacts,
  count(*) filter (where fs.name in ('Тестирует', 'Тест', 'Активен'))::int as testing_contacts,
  count(*) filter (where l.next_contact_date < now())::int as need_action_contacts
from public.leads l
left join public.funnel_stages fs on fs.id = l.stage_id;

