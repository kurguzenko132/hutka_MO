-- Hutka MVP schema for Supabase PostgreSQL
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text,
  role text default 'marketer' check (role in ('admin', 'marketer', 'viewer')),
  avatar_url text,
  created_at timestamptz default now()
);

-- Some early Hutka installations have a profiles table created before auth
-- linkage was introduced. Bring it to the current contract before indexes and
-- auth helpers below use this column.
alter table public.profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create table if not exists public.sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text,
  created_at timestamptz default now()
);

create table if not exists public.funnel_stages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text default 'master',
  order_index int not null default 0,
  color text default 'purple',
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('master', 'salon', 'client', 'partner')),
  niche text,
  city text,
  phone text,
  telegram text,
  instagram text,
  email text,
  source_id uuid references public.sources(id),
  stage_id uuid references public.funnel_stages(id),
  interest_level text default 'warm',
  priority_score int default 0 check (priority_score >= 0 and priority_score <= 100),
  notes text,
  next_step text,
  next_contact_date timestamptz,
  assigned_to uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tags (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text default 'purple',
  created_at timestamptz default now()
);

create table if not exists public.lead_tags (
  lead_id uuid references public.leads(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (lead_id, tag_id)
);

create table if not exists public.lead_interactions (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null,
  channel text,
  text text,
  result text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete set null,
  title text not null,
  description text,
  due_date timestamptz,
  priority text default 'none' check (priority in ('none', 'low', 'medium', 'high', 'urgent')),
  status text default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.surveys (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  type text,
  description text,
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  slug text,
  created_at timestamptz default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid references public.surveys(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  options jsonb default '[]'::jsonb,
  order_index int default 0,
  required boolean default false
);

create table if not exists public.survey_answers (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid references public.surveys(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  question_id uuid references public.survey_questions(id) on delete cascade,
  response_group_id uuid,
  respondent_name text,
  respondent_contact text,
  answer jsonb,
  created_at timestamptz default now()
);

create table if not exists public.campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  goal text,
  channel text,
  city text,
  niche text,
  budget numeric default 0,
  offer_text text,
  status text default 'active' check (status in ('draft', 'active', 'paused', 'finished')),
  start_date date,
  end_date date,
  result_notes text,
  created_at timestamptz default now()
);

create table if not exists public.campaign_leads (
  campaign_id uuid references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  primary key (campaign_id, lead_id)
);

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

create table if not exists public.insights (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text,
  evidence text,
  importance text default 'medium',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.hypotheses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text default 'new',
  evidence_for text,
  evidence_against text,
  result text,
  next_action text,
  created_at timestamptz default now()
);


-- Step 7 migrations for existing MVP databases
alter table public.surveys add column if not exists slug text;
create unique index if not exists surveys_slug_unique_idx on public.surveys(slug) where slug is not null;
alter table public.survey_answers add column if not exists response_group_id uuid;
alter table public.survey_answers add column if not exists respondent_name text;
alter table public.survey_answers add column if not exists respondent_contact text;

-- Basic seed data
insert into public.sources (name, type) values
  ('Instagram', 'social'),
  ('Telegram', 'social'),
  ('TikTok', 'social'),
  ('Рекомендация', 'referral'),
  ('Офлайн', 'offline'),
  ('Beauty-школа', 'partner'),
  ('Реклама', 'ads')
on conflict do nothing;

insert into public.funnel_stages (name, type, order_index, color) values
  ('Новый', 'master', 1, 'gray'),
  ('Написали', 'master', 2, 'purple'),
  ('Ответил', 'master', 3, 'blue'),
  ('Заинтересован', 'master', 4, 'yellow'),
  ('Тестирует', 'master', 5, 'green'),
  ('Пауза', 'master', 6, 'gray'),
  ('Отказ', 'master', 7, 'red')
on conflict do nothing;

insert into public.tags (name, color) values
  ('Нужны клиенты', 'pink'),
  ('Нет CRM', 'purple'),
  ('Пустые окна', 'yellow'),
  ('Тестирует', 'green'),
  ('Салон', 'blue'),
  ('Вернуться позже', 'gray'),
  ('Заинтересован', 'yellow')
on conflict do nothing;

-- Simple dashboard views
create or replace view public.view_dashboard_stats as
select
  count(*)::int as total_leads,
  count(*) filter (where created_at >= now() - interval '7 days')::int as new_leads_week,
  count(*) filter (where priority_score >= 75)::int as hot_leads,
  (select count(*) from public.tasks where status != 'done' and due_date < now())::int as overdue_tasks
from public.leads;

create or replace view public.view_city_performance as
select
  coalesce(city, 'Не указан') as city,
  count(*)::int as total_leads,
  count(*) filter (where type = 'master')::int as masters,
  count(*) filter (where type = 'salon')::int as salons,
  count(*) filter (where priority_score >= 75)::int as ready_to_test
from public.leads
group by city
order by total_leads desc;

-- Enable RLS on workspace data tables before defining scoped policies.
alter table public.profiles enable row level security;
alter table public.sources enable row level security;
alter table public.funnel_stages enable row level security;
alter table public.leads enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;
alter table public.lead_interactions enable row level security;
alter table public.tasks enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_answers enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_leads enable row level security;
alter table public.activity_logs enable row level security;
alter table public.insights enable row level security;
alter table public.hypotheses enable row level security;

-- Remove broad MVP policies if they were created by an older schema revision.
do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array[
    'profiles','sources','funnel_stages','leads','tags','lead_tags','lead_interactions','tasks',
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','activity_logs','insights','hypotheses'
  ] loop
    policy_name := 'Authenticated users can manage ' || tbl;
    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
  end loop;
end $$;

create or replace function public.save_survey_builder_definition(
  p_survey_id uuid,
  p_definition jsonb,
  p_mode text default 'save',
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  survey_payload jsonb := coalesce(p_definition -> 'survey', '{}'::jsonb);
  v_survey_id uuid := p_survey_id;
  normalized_key text := lower(trim(coalesce(survey_payload ->> 'key', '')));
  normalized_title text := trim(coalesce(survey_payload ->> 'title', ''));
  normalized_slug text;
  existing_status text;
  actor_id uuid;
  section jsonb;
  question jsonb;
  rule jsonb;
  section_id uuid;
  section_position integer := 0;
  question_position integer;
  question_total integer := 0;
  next_version integer;
begin
  if coalesce(p_definition ->> 'schemaVersion', '') <> '1.0' or normalized_key !~ '^[a-z][a-z0-9_]{1,99}$' or normalized_title = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid-survey');
  end if;
  select count(*) into question_total from jsonb_array_elements(coalesce(p_definition -> 'sections', '[]'::jsonb)) section_row, jsonb_array_elements(coalesce(section_row -> 'questions', '[]'::jsonb)) question_row;
  if question_total < 1 or question_total > 500 then return jsonb_build_object('ok', false, 'error', 'question-limit'); end if;
  select id into actor_id from public.profiles where user_id = auth.uid() limit 1;
  if actor_id is null and auth.role() = 'service_role' then actor_id := p_actor_profile_id; end if;
  if v_survey_id is not null then
    select status into existing_status from public.surveys where id = v_survey_id for update;
    if existing_status is null then return jsonb_build_object('ok', false, 'error', 'survey-not-found'); end if;
    if existing_status = 'active' then return jsonb_build_object('ok', false, 'error', 'published-locked'); end if;
  else
    normalized_slug := regexp_replace(normalized_key, '_+', '-', 'g');
    while exists (select 1 from public.surveys where lower(slug) = lower(normalized_slug)) loop
      normalized_slug := regexp_replace(normalized_key, '_+', '-', 'g') || '-' || substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6);
    end loop;
    insert into public.surveys (survey_key, title, type, description, status, slug, settings, start_screen, completion_screen)
    values (normalized_key, normalized_title, nullif(survey_payload ->> 'type', ''), nullif(survey_payload ->> 'description', ''), case when p_mode = 'publish' then 'active' else 'draft' end, normalized_slug, coalesce(survey_payload -> 'settings', '{}'::jsonb), coalesce(survey_payload -> 'startScreen', '{}'::jsonb), coalesce(survey_payload -> 'completionScreen', '{}'::jsonb)) returning id into v_survey_id;
  end if;
  update public.surveys set survey_key = normalized_key, title = normalized_title, type = nullif(survey_payload ->> 'type', ''), description = nullif(survey_payload ->> 'description', ''), settings = coalesce(survey_payload -> 'settings', '{}'::jsonb), start_screen = coalesce(survey_payload -> 'startScreen', '{}'::jsonb), completion_screen = coalesce(survey_payload -> 'completionScreen', '{}'::jsonb), updated_at = now() where id = v_survey_id;
  delete from public.survey_questions question_row where question_row.survey_id = v_survey_id;
  delete from public.survey_sections section_row where section_row.survey_id = v_survey_id;
  delete from public.survey_classification_rules rule_row where rule_row.survey_id = v_survey_id;
  for section in select value from jsonb_array_elements(p_definition -> 'sections') loop
    section_position := section_position + 1;
    insert into public.survey_sections (survey_id, key, title, description, visibility, order_index) values (v_survey_id, section ->> 'key', section ->> 'title', nullif(section ->> 'description', ''), coalesce(section -> 'visibility', '{}'::jsonb), section_position) returning id into section_id;
    question_position := 0;
    for question in select value from jsonb_array_elements(coalesce(section -> 'questions', '[]'::jsonb)) loop
      question_position := question_position + 1;
      insert into public.survey_questions (survey_id, section_id, key, question_text, question_type, options, order_index, required, description, visibility, options_source, validation, settings, contact_mapping)
      values (v_survey_id, section_id, question ->> 'key', question ->> 'title', question ->> 'type', coalesce(question -> 'options', '[]'::jsonb), section_position * 1000 + question_position, coalesce((question ->> 'required')::boolean, false), nullif(question ->> 'description', ''), coalesce(question -> 'visibility', '{}'::jsonb), coalesce(question -> 'optionsSource', '{}'::jsonb), coalesce(question -> 'validation', '{}'::jsonb), coalesce(question -> 'settings', '{}'::jsonb), coalesce(question -> 'contactMapping', '{}'::jsonb));
    end loop;
  end loop;
  for rule in select value from jsonb_array_elements(coalesce(p_definition -> 'classificationRules', '[]'::jsonb)) loop
    insert into public.survey_classification_rules (survey_id, key, title, priority, conditions, actions) values (v_survey_id, rule ->> 'key', rule ->> 'title', coalesce((rule ->> 'priority')::integer, 100), coalesce(rule -> 'when', '{}'::jsonb), coalesce(rule -> 'actions', '[]'::jsonb));
  end loop;
  if p_mode = 'publish' then
    next_version := case when p_survey_id is null then 1 else (select version + 1 from public.surveys where id = v_survey_id) end;
    update public.surveys set status = 'active', version = next_version, published_at = now(), updated_at = now() where id = v_survey_id;
    insert into public.survey_versions (survey_id, version, definition, published_by) values (v_survey_id, next_version, p_definition, actor_id) on conflict (survey_id, version) do update set definition = excluded.definition, published_by = excluded.published_by, created_at = now();
  end if;
  insert into public.activity_logs (user_id, action, entity_type, entity_id, entity_title, details) values (actor_id, case when p_survey_id is null then 'создал анкету' when p_mode = 'publish' then 'опубликовал анкету' else 'изменил анкету' end, 'survey', v_survey_id, normalized_title, jsonb_build_object('questions', question_total, 'mode', p_mode));
  return jsonb_build_object('ok', true, 'survey_id', v_survey_id, 'slug', (select slug from public.surveys where id = v_survey_id));
exception when unique_violation then return jsonb_build_object('ok', false, 'error', 'duplicate-key');
end;
$$;

revoke all on function public.save_survey_builder_definition(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.save_survey_builder_definition(uuid, jsonb, text, uuid) to authenticated, service_role;


-- Public survey forms are read and submitted through Next.js server actions
-- with the service role key. Keep these drops so older anon policies are removed.
drop policy if exists "Anyone can read active surveys" on public.surveys;
drop policy if exists "Anyone can read active survey questions" on public.survey_questions;
drop policy if exists "Anyone can submit active survey answers" on public.survey_answers;

-- Step 8 campaign helper indexes and view
create index if not exists campaign_leads_campaign_id_idx on public.campaign_leads(campaign_id);
create index if not exists campaign_leads_lead_id_idx on public.campaign_leads(lead_id);
create index if not exists campaigns_status_idx on public.campaigns(status);

create or replace view public.view_campaign_performance as
select
  c.id,
  c.name,
  c.channel,
  c.city,
  c.niche,
  c.status,
  count(cl.lead_id)::int as contacts,
  count(cl.lead_id) filter (where fs.name in ('Ответил', 'Заинтересован', 'Опрос', 'Тестирует', 'Тест', 'Активен'))::int as responses,
  count(cl.lead_id) filter (where fs.name in ('Заинтересован', 'Опрос', 'Тестирует', 'Тест', 'Активен'))::int as surveys,
  count(cl.lead_id) filter (where fs.name in ('Тестирует', 'Тест', 'Активен') or l.priority_score >= 75)::int as participants
from public.campaigns c
left join public.campaign_leads cl on cl.campaign_id = c.id
left join public.leads l on l.id = cl.lead_id
left join public.funnel_stages fs on fs.id = l.stage_id
group by c.id, c.name, c.channel, c.city, c.niche, c.status;

-- Step 9 insights workflow
alter table public.insights add column if not exists status text default 'new';
alter table public.insights add column if not exists next_action text;
alter table public.insights add column if not exists updated_at timestamptz default now();

alter table public.insights drop constraint if exists insights_importance_check;
alter table public.insights add constraint insights_importance_check
  check (importance in ('low', 'medium', 'high', 'critical')) not valid;

alter table public.insights drop constraint if exists insights_status_check;
alter table public.insights add constraint insights_status_check
  check (status in ('new', 'in_review', 'accepted', 'archived')) not valid;

create table if not exists public.insight_leads (
  insight_id uuid references public.insights(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  primary key (insight_id, lead_id)
);

create table if not exists public.insight_campaigns (
  insight_id uuid references public.insights(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  primary key (insight_id, campaign_id)
);

create table if not exists public.insight_surveys (
  insight_id uuid references public.insights(id) on delete cascade,
  survey_id uuid references public.surveys(id) on delete cascade,
  primary key (insight_id, survey_id)
);

create index if not exists insights_status_idx on public.insights(status);
create index if not exists insights_importance_idx on public.insights(importance);
create index if not exists insight_leads_lead_id_idx on public.insight_leads(lead_id);
create index if not exists insight_campaigns_campaign_id_idx on public.insight_campaigns(campaign_id);
create index if not exists insight_surveys_survey_id_idx on public.insight_surveys(survey_id);

alter table public.insight_leads enable row level security;
alter table public.insight_campaigns enable row level security;
alter table public.insight_surveys enable row level security;

-- Remove broad MVP policies for insight link tables if they exist.
do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array['insight_leads','insight_campaigns','insight_surveys'] loop
    policy_name := 'Authenticated users can manage ' || tbl;
    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
  end loop;
end $$;

create or replace view public.view_insight_summary as
select
  i.id,
  i.title,
  i.category,
  i.importance,
  i.status,
  i.created_at,
  (
    (select count(*) from public.insight_leads il where il.insight_id = i.id) +
    (select count(*) from public.insight_campaigns ic where ic.insight_id = i.id) +
    (select count(*) from public.insight_surveys isv where isv.insight_id = i.id)
  )::int as relations_count
from public.insights i
order by
  case i.importance when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
  i.created_at desc;

-- Step 10 hypotheses workflow
alter table public.hypotheses add column if not exists category text default 'Идея';
alter table public.hypotheses alter column category set default 'Идея';
alter table public.hypotheses add column if not exists test_method text;
alter table public.hypotheses add column if not exists success_metric text;
alter table public.hypotheses add column if not exists confidence text default 'medium';
alter table public.hypotheses add column if not exists updated_at timestamptz default now();

alter table public.hypotheses drop constraint if exists hypotheses_status_check;
alter table public.hypotheses add constraint hypotheses_status_check
  check (status in ('new', 'testing', 'validated', 'invalidated', 'needs_data', 'closed')) not valid;

alter table public.hypotheses drop constraint if exists hypotheses_confidence_check;
alter table public.hypotheses add constraint hypotheses_confidence_check
  check (confidence in ('low', 'medium', 'high')) not valid;

create table if not exists public.hypothesis_leads (
  hypothesis_id uuid references public.hypotheses(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  primary key (hypothesis_id, lead_id)
);

create table if not exists public.hypothesis_insights (
  hypothesis_id uuid references public.hypotheses(id) on delete cascade,
  insight_id uuid references public.insights(id) on delete cascade,
  primary key (hypothesis_id, insight_id)
);

create table if not exists public.hypothesis_campaigns (
  hypothesis_id uuid references public.hypotheses(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  primary key (hypothesis_id, campaign_id)
);

create table if not exists public.hypothesis_surveys (
  hypothesis_id uuid references public.hypotheses(id) on delete cascade,
  survey_id uuid references public.surveys(id) on delete cascade,
  primary key (hypothesis_id, survey_id)
);

create index if not exists hypotheses_status_idx on public.hypotheses(status);
create index if not exists hypotheses_confidence_idx on public.hypotheses(confidence);
create index if not exists hypotheses_category_idx on public.hypotheses(category);
create index if not exists hypothesis_leads_lead_id_idx on public.hypothesis_leads(lead_id);
create index if not exists hypothesis_insights_insight_id_idx on public.hypothesis_insights(insight_id);
create index if not exists hypothesis_campaigns_campaign_id_idx on public.hypothesis_campaigns(campaign_id);
create index if not exists hypothesis_surveys_survey_id_idx on public.hypothesis_surveys(survey_id);

alter table public.hypothesis_leads enable row level security;
alter table public.hypothesis_insights enable row level security;
alter table public.hypothesis_campaigns enable row level security;
alter table public.hypothesis_surveys enable row level security;

-- Remove broad MVP policies for hypothesis link tables if they exist.
do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array['hypothesis_leads','hypothesis_insights','hypothesis_campaigns','hypothesis_surveys'] loop
    policy_name := 'Authenticated users can manage ' || tbl;
    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
  end loop;
end $$;

create or replace view public.view_hypothesis_summary as
select
  h.id,
  h.title,
  h.category,
  h.status,
  h.confidence,
  h.created_at,
  (
    (select count(*) from public.hypothesis_leads hl where hl.hypothesis_id = h.id) +
    (select count(*) from public.hypothesis_insights hi where hi.hypothesis_id = h.id) +
    (select count(*) from public.hypothesis_campaigns hc where hc.hypothesis_id = h.id) +
    (select count(*) from public.hypothesis_surveys hs where hs.hypothesis_id = h.id)
  )::int as relations_count
from public.hypotheses h
order by
  case h.status
    when 'testing' then 1
    when 'needs_data' then 2
    when 'new' then 3
    when 'validated' then 4
    when 'invalidated' then 5
    else 6
  end,
  case h.confidence when 'high' then 1 when 'medium' then 2 else 3 end,
  h.created_at desc;

-- Step 11 reports workflow
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

create or replace view public.view_report_stage_distribution as
select
  coalesce(fs.name, 'Новый') as stage,
  count(l.id)::int as contacts
from public.leads l
left join public.funnel_stages fs on fs.id = l.stage_id
group by coalesce(fs.name, 'Новый')
order by contacts desc;

create or replace view public.view_report_source_distribution as
select
  coalesce(s.name, 'Не указан') as source,
  count(l.id)::int as contacts,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts
from public.leads l
left join public.sources s on s.id = l.source_id
group by coalesce(s.name, 'Не указан')
order by contacts desc;

create or replace view public.view_report_niche_distribution as
select
  coalesce(l.niche, 'Не указана') as niche,
  count(l.id)::int as contacts,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts
from public.leads l
group by coalesce(l.niche, 'Не указана')
order by contacts desc;

-- Step 12 geography workflow
create or replace view public.view_geography_city_summary as
with city_base as (
  select
    coalesce(l.city, 'Не указан') as city,
    count(l.id)::int as contacts,
    count(l.id) filter (where l.type = 'master')::int as masters,
    count(l.id) filter (where l.type = 'salon')::int as salons,
    count(l.id) filter (where l.type = 'client')::int as clients,
    count(l.id) filter (where l.type = 'partner')::int as partners,
    count(l.id) filter (where fs.name in ('Заинтересован', 'Опрос') or l.priority_score >= 75)::int as ready_to_pilot,
    count(l.id) filter (where fs.name in ('Тестирует', 'Тест', 'Активен'))::int as active_participants,
    count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts
  from public.leads l
  left join public.funnel_stages fs on fs.id = l.stage_id
  group by coalesce(l.city, 'Не указан')
), city_niches as (
  select
    city,
    array_agg(niche order by contacts desc) filter (where niche is not null and niche != '') as top_niches
  from (
    select
      coalesce(city, 'Не указан') as city,
      coalesce(niche, 'Не указана') as niche,
      count(*) as contacts
    from public.leads
    group by coalesce(city, 'Не указан'), coalesce(niche, 'Не указана')
  ) n
  group by city
), city_sources as (
  select
    city,
    array_agg(source order by contacts desc) filter (where source is not null and source != '') as top_sources
  from (
    select
      coalesce(l.city, 'Не указан') as city,
      coalesce(s.name, 'Не указан') as source,
      count(*) as contacts
    from public.leads l
    left join public.sources s on s.id = l.source_id
    group by coalesce(l.city, 'Не указан'), coalesce(s.name, 'Не указан')
  ) s
  group by city
)
select
  cb.city,
  cb.contacts,
  cb.masters,
  cb.salons,
  cb.clients,
  cb.partners,
  cb.ready_to_pilot,
  cb.active_participants,
  cb.hot_contacts,
  coalesce(cn.top_niches, array[]::text[]) as top_niches,
  coalesce(cs.top_sources, array[]::text[]) as top_sources,
  least(
    100,
    greatest(
      0,
      round(
        (case when cb.contacts >= 50 then 35 else cb.contacts * 0.7 end) +
        (case when cb.ready_to_pilot >= 15 then 30 else cb.ready_to_pilot * 2 end) +
        (case when cb.active_participants >= 5 then 20 else cb.active_participants * 4 end) +
        (case when cb.hot_contacts >= 15 then 15 else cb.hot_contacts end)
      )
    )
  )::int as pilot_readiness
from city_base cb
left join city_niches cn on cn.city = cb.city
left join city_sources cs on cs.city = cb.city
order by pilot_readiness desc, contacts desc;

create or replace view public.view_geography_niche_summary as
select
  coalesce(l.city, 'Не указан') as city,
  coalesce(l.niche, 'Не указана') as niche,
  count(l.id)::int as contacts,
  count(l.id) filter (where fs.name in ('Заинтересован', 'Опрос') or l.priority_score >= 75)::int as ready_to_pilot,
  count(l.id) filter (where fs.name in ('Тестирует', 'Тест', 'Активен'))::int as active_participants,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts,
  least(
    100,
    greatest(
      0,
      round(
        (case when count(l.id) >= 25 then 35 else count(l.id) * 1.4 end) +
        (count(l.id) filter (where fs.name in ('Заинтересован', 'Опрос') or l.priority_score >= 75)) * 4 +
        (count(l.id) filter (where fs.name in ('Тестирует', 'Тест', 'Активен'))) * 6 +
        (count(l.id) filter (where l.priority_score >= 75)) * 2
      )
    )
  )::int as readiness
from public.leads l
left join public.funnel_stages fs on fs.id = l.stage_id
group by coalesce(l.city, 'Не указан'), coalesce(l.niche, 'Не указана')
order by readiness desc, contacts desc;

-- Step 13 funnels workflow
update public.funnel_stages set type = 'master' where type is null;

with ranked as (
  select
    id,
    first_value(id) over (partition by name, type order by order_index asc, created_at asc, id asc) as keeper_id,
    row_number() over (partition by name, type order by order_index asc, created_at asc, id asc) as rn
  from public.funnel_stages
), reassigned as (
  update public.leads l
  set stage_id = ranked.keeper_id
  from ranked
  where l.stage_id = ranked.id and ranked.rn > 1
  returning l.id
)
delete from public.funnel_stages fs
using ranked
where fs.id = ranked.id and ranked.rn > 1;

create unique index if not exists funnel_stages_name_type_unique on public.funnel_stages(name, type);
create index if not exists leads_stage_id_idx on public.leads(stage_id);
create index if not exists leads_updated_at_idx on public.leads(updated_at desc);

insert into public.funnel_stages (name, type, order_index, color) values
  ('Новый', 'master', 1, 'gray'),
  ('Написали', 'master', 2, 'purple'),
  ('Ответил', 'master', 3, 'blue'),
  ('Заинтересован', 'master', 4, 'yellow'),
  ('Тестирует', 'master', 5, 'green'),
  ('Пауза', 'master', 6, 'gray'),
  ('Отказ', 'master', 7, 'red')
on conflict (name, type) do update set
  order_index = excluded.order_index,
  color = excluded.color;

do $$
declare
  target_stage uuid;
begin
  select id into target_stage from public.funnel_stages where name = 'Новый' and type = 'master' order by order_index limit 1;
  update public.leads set stage_id = target_stage where stage_id in (select id from public.funnel_stages where name in ('Найден', 'Найдено') and type = 'master') and target_stage is not null;
  delete from public.funnel_stages where name in ('Найден', 'Найдено') and type = 'master';

  select id into target_stage from public.funnel_stages where name = 'Написали' and type = 'master' order by order_index limit 1;
  update public.leads set stage_id = target_stage where stage_id in (select id from public.funnel_stages where name = 'Написал' and type = 'master') and target_stage is not null;
  delete from public.funnel_stages where name = 'Написал' and type = 'master';

  select id into target_stage from public.funnel_stages where name = 'Заинтересован' and type = 'master' order by order_index limit 1;
  update public.leads set stage_id = target_stage where stage_id in (select id from public.funnel_stages where name in ('Опрос', 'Готов к пилоту', 'Горячий контакт') and type = 'master') and target_stage is not null;
  delete from public.funnel_stages where name in ('Опрос', 'Готов к пилоту', 'Горячий контакт') and type = 'master';

  select id into target_stage from public.funnel_stages where name = 'Тестирует' and type = 'master' order by order_index limit 1;
  update public.leads set stage_id = target_stage where stage_id in (select id from public.funnel_stages where name in ('Тест', 'Активен', 'Тестер', 'Активный участник', 'Пилот') and type = 'master') and target_stage is not null;
  delete from public.funnel_stages where name in ('Тест', 'Активен', 'Тестер', 'Активный участник', 'Пилот') and type = 'master';
end $$;

create or replace view public.view_funnel_stage_summary as
select
  fs.id,
  fs.name,
  fs.type,
  fs.color,
  fs.order_index,
  count(l.id)::int as contacts,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts,
  count(l.id) filter (where fs.name in ('Заинтересован') or l.priority_score >= 75)::int as ready_to_pilot,
  count(l.id) filter (where fs.name in ('Тестирует'))::int as active_participants
from public.funnel_stages fs
left join public.leads l on l.stage_id = fs.id
group by fs.id, fs.name, fs.type, fs.color, fs.order_index
order by fs.order_index asc;

-- Step 15: task workflow performance indexes
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_priority_idx on public.tasks(priority);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_lead_id_idx on public.tasks(lead_id);

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks alter column priority set default 'none';
update public.tasks set priority = 'none' where priority is null or priority = '';
update public.tasks set priority = 'none' where priority not in ('none', 'low', 'medium', 'high', 'urgent');
alter table public.tasks add constraint tasks_priority_check check (priority in ('none', 'low', 'medium', 'high', 'urgent'));

create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('responsible', 'executor', 'co_executor')),
  created_at timestamptz default now(),
  primary key (task_id, profile_id, role)
);

alter table public.task_assignees enable row level security;

create index if not exists task_assignees_task_id_idx on public.task_assignees(task_id);
create index if not exists task_assignees_profile_id_idx on public.task_assignees(profile_id);
create index if not exists task_assignees_role_idx on public.task_assignees(role);

-- Step 16: Settings and editable dictionaries
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into public.app_settings (key, value) values
  ('product_name', 'Hutka'),
  ('workspace_name', 'Beauty CRM Launch'),
  ('default_city', 'Минск'),
  ('weekly_report_day', 'Понедельник')
on conflict (key) do nothing;

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

create index if not exists sources_name_idx on public.sources(name);
create index if not exists sources_type_idx on public.sources(type);
create unique index if not exists sources_normalized_name_unique_idx
  on public.sources(public.normalize_source_name(name))
  where public.normalize_source_name(name) <> '';
create index if not exists funnel_stages_type_order_idx on public.funnel_stages(type, order_index);
create index if not exists tags_name_idx on public.tags(name);

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can manage app_settings" on public.app_settings;

-- Step 18: production auth helpers
create unique index if not exists profiles_user_id_unique_idx on public.profiles(user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'marketer'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Step 19: roles and access control
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.user_id = u.id and (p.email is null or p.email = '');

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where user_id = auth.uid() limit 1),
    'viewer'
  );
$$;

grant execute on function public.current_profile_role() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when exists (select 1 from public.profiles) then 'marketer' else 'admin' end
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Remove old broad MVP policies.
do $$
declare
  tbl text;
  policy_name text;
begin
  foreach tbl in array array[
    'profiles','sources','funnel_stages','leads','tags','lead_tags','lead_interactions','tasks',
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','activity_logs','insights','hypotheses',
    'insight_leads','insight_campaigns','insight_surveys',
    'hypothesis_leads','hypothesis_insights','hypothesis_campaigns','hypothesis_surveys'
  ] loop
    policy_name := 'Authenticated users can manage ' || tbl;
    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
  end loop;
end $$;

drop policy if exists "Authenticated users can manage app_settings" on public.app_settings;

-- Profiles: everyone authenticated can read team profiles, only admins can change roles.
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles
  for update to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

-- Read access for all authenticated users.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'sources','funnel_stages','leads','tags','lead_tags','lead_interactions','tasks',
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','activity_logs','insights','hypotheses',
    'insight_leads','insight_campaigns','insight_surveys',
    'hypothesis_leads','hypothesis_insights','hypothesis_campaigns','hypothesis_surveys',
    'app_settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'Authenticated users can read ' || tbl, tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Authenticated users can read ' || tbl, tbl);
  end loop;
end $$;

-- Admin + marketer can edit workspace operating data.
do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array[
    'leads','tags','lead_tags','lead_interactions','tasks',
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','activity_logs','insights','hypotheses',
    'insight_leads','insight_campaigns','insight_surveys',
    'hypothesis_leads','hypothesis_insights','hypothesis_campaigns','hypothesis_surveys'
  ] loop
    foreach action in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Workspace editors can ' || action || ' ' || tbl, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can insert ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_profile_role() in (''admin'', ''marketer'')) with check (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can update ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can delete ' || tbl,
      tbl
    );
  end loop;
end $$;

-- Admin-only dictionaries and app settings.
do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array['sources','funnel_stages','app_settings'] loop
    foreach action in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Admins can ' || action || ' ' || tbl, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() = ''admin'')',
      'Admins can insert ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_profile_role() = ''admin'') with check (public.current_profile_role() = ''admin'')',
      'Admins can update ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.current_profile_role() = ''admin'')',
      'Admins can delete ' || tbl,
      tbl
    );
  end loop;
end $$;

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);

-- Step 20 CSV imports workflow
create table if not exists public.import_logs (
  id uuid primary key default uuid_generate_v4(),
  file_name text not null,
  total_rows int default 0,
  imported_rows int default 0,
  skipped_rows int default 0,
  failed_rows int default 0,
  status text default 'finished' check (status in ('finished', 'finished_with_errors', 'failed')),
  error_details jsonb default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.import_logs enable row level security;

create index if not exists import_logs_created_at_idx on public.import_logs(created_at desc);
create index if not exists import_logs_created_by_idx on public.import_logs(created_by);

drop policy if exists "Authenticated users can read import_logs" on public.import_logs;
create policy "Authenticated users can read import_logs"
  on public.import_logs
  for select to authenticated
  using (true);

drop policy if exists "Workspace editors can insert import_logs" on public.import_logs;
create policy "Workspace editors can insert import_logs"
  on public.import_logs
  for insert to authenticated
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can update import_logs" on public.import_logs;
create policy "Workspace editors can update import_logs"
  on public.import_logs
  for update to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'))
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Admins can delete import_logs" on public.import_logs;
create policy "Admins can delete import_logs"
  on public.import_logs
  for delete to authenticated
  using (public.current_profile_role() = 'admin');

-- Step 23 contact relations hub
create index if not exists survey_answers_lead_id_idx on public.survey_answers(lead_id);

-- Step 24 notifications and events center
create table if not exists public.notification_reads (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  event_key text not null,
  read_at timestamptz default now(),
  unique (profile_id, event_key)
);

alter table public.notification_reads enable row level security;

create index if not exists notification_reads_profile_id_idx on public.notification_reads(profile_id);
create index if not exists notification_reads_event_key_idx on public.notification_reads(event_key);
create index if not exists notification_reads_read_at_idx on public.notification_reads(read_at desc);

drop policy if exists "Users can read own notification reads" on public.notification_reads;
create policy "Users can read own notification reads"
  on public.notification_reads
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = notification_reads.profile_id
    and p.user_id = auth.uid()
  ));

drop policy if exists "Users can insert own notification reads" on public.notification_reads;
create policy "Users can insert own notification reads"
  on public.notification_reads
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = notification_reads.profile_id
    and p.user_id = auth.uid()
  ));

drop policy if exists "Users can update own notification reads" on public.notification_reads;
create policy "Users can update own notification reads"
  on public.notification_reads
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = notification_reads.profile_id
    and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = notification_reads.profile_id
    and p.user_id = auth.uid()
  ));

-- Step 25 quality and stability
create index if not exists leads_email_lower_idx on public.leads (lower(email)) where email is not null and email <> '';
create index if not exists leads_instagram_lower_idx on public.leads (lower(instagram)) where instagram is not null and instagram <> '';
create index if not exists leads_telegram_lower_idx on public.leads (lower(telegram)) where telegram is not null and telegram <> '';
create index if not exists leads_phone_idx on public.leads (phone) where phone is not null and phone <> '';
create index if not exists leads_updated_at_idx on public.leads(updated_at desc);
create index if not exists lead_interactions_created_at_idx on public.lead_interactions(created_at desc);

-- Step 29 marketer profile settings
alter table public.profiles add column if not exists job_title text default 'Маркетолог';
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists telegram text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles
set job_title = coalesce(nullif(job_title, ''), case role
  when 'admin' then 'Администратор'
  when 'viewer' then 'Наблюдатель'
  else 'Маркетолог'
end)
where job_title is null or job_title = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, job_title, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'job_title', 'Маркетолог'),
    case when exists (select 1 from public.profiles) then 'marketer' else 'admin' end
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and old.user_id = auth.uid() and public.current_profile_role() <> 'admin' then
    new.user_id := old.user_id;
    new.email := old.email;
    new.role := old.role;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_system_fields_before_update on public.profiles;
create trigger protect_profile_system_fields_before_update
before update on public.profiles
for each row execute function public.protect_profile_system_fields();

create index if not exists profiles_job_title_idx on public.profiles(job_title);

-- Step 30: personal lead questionnaires
create table if not exists public.lead_questionnaires (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  description text,
  status text default 'active' check (status in ('draft', 'active', 'closed')),
  token text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lead_questionnaire_questions (
  id uuid primary key default uuid_generate_v4(),
  questionnaire_id uuid references public.lead_questionnaires(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'short_text',
  options jsonb default '[]'::jsonb,
  required boolean default false,
  order_index int default 0,
  created_at timestamptz default now()
);

create table if not exists public.lead_questionnaire_answers (
  id uuid primary key default uuid_generate_v4(),
  questionnaire_id uuid references public.lead_questionnaires(id) on delete cascade,
  question_id uuid references public.lead_questionnaire_questions(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  response_group_id uuid,
  respondent_name text,
  respondent_contact text,
  answer jsonb,
  created_at timestamptz default now()
);

alter table public.lead_questionnaires enable row level security;
alter table public.lead_questionnaire_questions enable row level security;
alter table public.lead_questionnaire_answers enable row level security;

create index if not exists lead_questionnaires_lead_id_idx on public.lead_questionnaires(lead_id);
create index if not exists lead_questionnaires_token_idx on public.lead_questionnaires(token);
create index if not exists lead_questionnaire_questions_form_idx on public.lead_questionnaire_questions(questionnaire_id, order_index);
create index if not exists lead_questionnaire_answers_form_idx on public.lead_questionnaire_answers(questionnaire_id, created_at desc);
create index if not exists lead_questionnaire_answers_lead_id_idx on public.lead_questionnaire_answers(lead_id);

-- Workspace users can read personal questionnaires; only editors can manage them.
do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array['lead_questionnaires','lead_questionnaire_questions','lead_questionnaire_answers'] loop
    execute format('drop policy if exists %I on public.%I', 'Authenticated users can manage ' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'Authenticated users can read ' || tbl, tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Authenticated users can read ' || tbl, tbl);

    foreach action in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Workspace editors can ' || action || ' ' || tbl, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can insert ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_profile_role() in (''admin'', ''marketer'')) with check (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can update ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.current_profile_role() in (''admin'', ''marketer''))',
      'Workspace editors can delete ' || tbl,
      tbl
    );
  end loop;
end $$;

-- Public personal questionnaire links are read and submitted through Next.js
-- server actions with the service role key. Keep these drops so older anon
-- policies are removed and active questionnaire tokens cannot be enumerated
-- through the Supabase anon API.
drop policy if exists "Anyone can read active lead questionnaires" on public.lead_questionnaires;
drop policy if exists "Anyone can read active lead questionnaire questions" on public.lead_questionnaire_questions;
drop policy if exists "Anyone can submit active lead questionnaire answers" on public.lead_questionnaire_answers;

-- Step 33: editable question packs.
create table if not exists public.question_packs (
  id uuid primary key default uuid_generate_v4(),
  slug text unique,
  title text not null,
  short_title text not null,
  description text,
  audience text not null default 'any' check (audience in ('master', 'salon', 'client', 'partner', 'any')),
  badge text default 'пак',
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.question_pack_questions (
  id uuid primary key default uuid_generate_v4(),
  pack_id uuid references public.question_packs(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'short_text',
  options jsonb default '[]'::jsonb,
  required boolean default false,
  order_index int default 0,
  created_at timestamptz default now()
);

alter table public.question_packs enable row level security;
alter table public.question_pack_questions enable row level security;

create index if not exists question_packs_status_idx on public.question_packs(status);
create index if not exists question_packs_audience_idx on public.question_packs(audience);
create index if not exists question_pack_questions_pack_order_idx on public.question_pack_questions(pack_id, order_index);

-- Read question packs for the whole workspace.
drop policy if exists "Authenticated users can read question_packs" on public.question_packs;
create policy "Authenticated users can read question_packs"
  on public.question_packs
  for select to authenticated
  using (true);

drop policy if exists "Authenticated users can read question_pack_questions" on public.question_pack_questions;
create policy "Authenticated users can read question_pack_questions"
  on public.question_pack_questions
  for select to authenticated
  using (true);

-- Only admins can manage reusable question packs.
do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array['question_packs','question_pack_questions'] loop
    foreach action in array array['insert','update','delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Admins can ' || action || ' ' || tbl, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() = ''admin'')',
      'Admins can insert ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_profile_role() = ''admin'') with check (public.current_profile_role() = ''admin'')',
      'Admins can update ' || tbl,
      tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.current_profile_role() = ''admin'')',
      'Admins can delete ' || tbl,
      tbl
    );
  end loop;
end $$;

-- Seed default packs once, but keep them editable afterwards.
insert into public.question_packs (slug, title, short_title, description, audience, badge, status)
values
  ('master-discovery', 'Диагностика индивидуального мастера', 'Мастер: диагностика', 'Базовый пакет, чтобы быстро понять нишу, запись, клиентов, боли и готовность к тестированию.', 'master', 'старт', 'active'),
  ('master-map-profile', 'Профиль мастера для карты', 'Мастер: профиль на карте', 'Пак для сбора данных, которые нужны для карточки мастера на карте: услуги, цены, фото, адрес, расписание.', 'master', 'карта', 'active'),
  ('salon-discovery', 'Диагностика салона', 'Салон: диагностика', 'Пак для салона: команда, запись, администраторы, текущая CRM, проблемы и интерес к карте.', 'salon', 'b2b', 'active'),
  ('pilot-feedback', 'Обратная связь после тестирования', 'Фидбек после теста', 'Пак после тестирования: что понятно, что мешает, чего не хватило, готовность пользоваться дальше.', 'any', 'фидбек', 'active'),
  ('refusal-reason', 'Причина отказа / паузы', 'Причина отказа', 'Короткий пак, чтобы понять, почему человек не идет дальше, и можно ли вернуться позже.', 'any', 'отказ', 'active'),
  ('client-map-research', 'Исследование клиента карты', 'Клиент: карта', 'Пак для клиентов, чтобы понять, как они ищут мастеров и что должно быть в карточке на карте.', 'client', 'b2c', 'active')
on conflict (slug) do update
set
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  audience = excluded.audience,
  badge = excluded.badge,
  status = excluded.status,
  updated_at = now();

with packs as (
  select id, slug from public.question_packs
)
insert into public.question_pack_questions (pack_id, question_text, question_type, options, required, order_index)
select packs.id, seed.question_text, seed.question_type, seed.options::jsonb, seed.required, seed.order_index
from packs
join (
  values
  ('master-discovery', 1, 'Какое у вас beauty-направление и какие основные услуги вы оказываете?', 'long_text', '[]', true),
  ('master-discovery', 2, 'В каком городе и районе вы принимаете клиентов?', 'short_text', '[]', true),
  ('master-discovery', 3, 'Как сейчас клиенты записываются к вам?', 'single_choice', '["Instagram Direct","Telegram","WhatsApp/Viber","Телефон","Онлайн-запись","Через администратора","Другое"]', true),
  ('master-discovery', 4, 'Есть ли у вас свободные окна, которые хотелось бы заполнять?', 'single_choice', '["Да, часто","Иногда","Редко","Почти нет свободных окон"]', true),
  ('master-discovery', 5, 'Какая главная проблема сейчас: клиенты, запись, повторные визиты, продвижение или другое?', 'long_text', '[]', true),
  ('master-discovery', 6, 'Пользуетесь ли вы CRM или сервисом онлайн-записи?', 'yes_no', '[]', true),
  ('master-discovery', 7, 'Что должно быть в приложении, чтобы вы реально начали им пользоваться?', 'long_text', '[]', true),
  ('master-discovery', 8, 'Готовы ли протестировать раннюю версию Hutka?', 'single_choice', '["Да, готов(а)","Можно попробовать позже","Пока не готов(а)","Нужно больше информации"]', true),

  ('master-map-profile', 1, 'Как вы хотите, чтобы назывался ваш профиль на карте?', 'short_text', '[]', true),
  ('master-map-profile', 2, 'Опишите себя как мастера в 2–4 предложениях.', 'long_text', '[]', true),
  ('master-map-profile', 3, 'Какие 3–7 услуг нужно показать в первую очередь?', 'long_text', '[]', true),
  ('master-map-profile', 4, 'Какая стартовая цена или диапазон цен по основным услугам?', 'short_text', '[]', true),
  ('master-map-profile', 5, 'Где вы принимаете клиентов: салон, студия, дом, выезд?', 'single_choice', '["Салон","Студия","На дому","Выезд к клиенту","Смешанный формат"]', true),
  ('master-map-profile', 6, 'Какие дни и время обычно доступны для записи?', 'long_text', '[]', true),
  ('master-map-profile', 7, 'Какие фото/материалы вы готовы добавить в профиль?', 'multiple_choice', '["Фото работ","Фото рабочего места","Портфолио Instagram","Отзывы клиентов","Прайс","Сертификаты"]', false),
  ('master-map-profile', 8, 'Что важно подчеркнуть в вашем профиле, чтобы клиент выбрал именно вас?', 'long_text', '[]', false),

  ('salon-discovery', 1, 'Сколько мастеров работает в салоне и какие направления закрываете?', 'long_text', '[]', true),
  ('salon-discovery', 2, 'Кто сейчас ведет запись клиентов?', 'single_choice', '["Администратор","Владелец","Каждый мастер сам","CRM/онлайн-запись","Смешанный формат"]', true),
  ('salon-discovery', 3, 'Какой системой сейчас пользуетесь для записи и клиентской базы?', 'short_text', '[]', true),
  ('salon-discovery', 4, 'Что не устраивает в текущем процессе записи или CRM?', 'long_text', '[]', true),
  ('salon-discovery', 5, 'Есть ли проблема с пустыми окнами у мастеров?', 'single_choice', '["Да, часто","Иногда","Нет, загрузка стабильная","Сложно оценить"]', true),
  ('salon-discovery', 6, 'Нужен ли салону дополнительный канал заявок через карту?', 'yes_no', '[]', true),
  ('salon-discovery', 7, 'Какие роли нужны в системе: владелец, администратор, мастер, управляющий?', 'multiple_choice', '["Владелец","Администратор","Управляющий","Мастер","Маркетолог"]', true),
  ('salon-discovery', 8, 'На каких условиях вы готовы протестировать Hutka?', 'long_text', '[]', false),

  ('pilot-feedback', 1, 'Что было самым понятным и полезным в Hutka?', 'long_text', '[]', true),
  ('pilot-feedback', 2, 'Что было непонятно или неудобно?', 'long_text', '[]', true),
  ('pilot-feedback', 3, 'Какую оценку вы бы поставили текущей версии?', 'rating', '[]', true),
  ('pilot-feedback', 4, 'Какая функция нужна вам в первую очередь?', 'long_text', '[]', true),
  ('pilot-feedback', 5, 'Будете ли пользоваться дальше, если мы доработаем замечания?', 'single_choice', '["Да","Скорее да","Не уверен(а)","Скорее нет","Нет"]', true),
  ('pilot-feedback', 6, 'Что должно измениться, чтобы вы точно остались?', 'long_text', '[]', false),
  ('pilot-feedback', 7, 'Можно ли использовать ваш отзыв как кейс/цитату?', 'yes_no', '[]', false),

  ('refusal-reason', 1, 'Почему сейчас не готовы тестировать Hutka?', 'single_choice', '["Нет времени","Неактуально","Уже есть CRM","Не понимаю пользу","Не хочу заполнять профиль","Не верю, что будут заявки","Не готов(а) платить","Другое"]', true),
  ('refusal-reason', 2, 'Что могло бы изменить ваше решение?', 'long_text', '[]', false),
  ('refusal-reason', 3, 'Можно ли вернуться к вам позже?', 'single_choice', '["Да, через 1–2 недели","Да, через месяц","Да, позже","Нет"]', true),
  ('refusal-reason', 4, 'Какой формат был бы удобнее: короткий созвон, видео-демо, текстовая инструкция или готовый профиль?', 'multiple_choice', '["Короткий созвон","Видео-демо","Текстовая инструкция","Помощь с заполнением профиля","Не нужно"]', false),

  ('client-map-research', 1, 'Как вы обычно ищете beauty-мастера?', 'multiple_choice', '["Instagram","TikTok","Google/Яндекс","По рекомендациям","Карты","Telegram-чаты","Сервисы записи","Другое"]', true),
  ('client-map-research', 2, 'Что важнее при выборе мастера?', 'multiple_choice', '["Фото работ","Отзывы","Цена","Близость","Свободное время","Опыт","Сертификаты","Скорость ответа"]', true),
  ('client-map-research', 3, 'Записались бы вы к мастеру через карту, если видны работы, цены, отзывы и свободные окна?', 'yes_no', '[]', true),
  ('client-map-research', 4, 'Что должно быть в карточке мастера, чтобы вызвать доверие?', 'long_text', '[]', true),
  ('client-map-research', 5, 'Какая главная причина не записаться через приложение?', 'long_text', '[]', false)
) as seed(slug, order_index, question_text, question_type, options, required)
  on packs.slug = seed.slug
where not exists (
  select 1 from public.question_pack_questions existing
  where existing.pack_id = packs.id
);

-- STEP 34: editable message templates
create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  short_title text,
  description text,
  audience text not null default 'any',
  category text not null default 'custom',
  channel text not null default 'any',
  status text not null default 'active',
  body text not null,
  order_index int default 99,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.message_templates enable row level security;

create index if not exists message_templates_status_idx on public.message_templates(status);
create index if not exists message_templates_audience_idx on public.message_templates(audience);
create index if not exists message_templates_category_idx on public.message_templates(category);
create index if not exists message_templates_order_idx on public.message_templates(order_index, created_at);

drop policy if exists "Authenticated users can read message_templates" on public.message_templates;
create policy "Authenticated users can read message_templates"
  on public.message_templates
  for select to authenticated
  using (true);

drop policy if exists "Admins can insert message_templates" on public.message_templates;
create policy "Admins can insert message_templates"
  on public.message_templates
  for insert to authenticated
  with check (public.current_profile_role() = 'admin');

drop policy if exists "Admins can update message_templates" on public.message_templates;
create policy "Admins can update message_templates"
  on public.message_templates
  for update to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

drop policy if exists "Admins can delete message_templates" on public.message_templates;
create policy "Admins can delete message_templates"
  on public.message_templates
  for delete to authenticated
  using (public.current_profile_role() = 'admin');

insert into public.message_templates (slug, title, short_title, description, audience, category, channel, status, body, order_index)
values
  (
    'first-touch-master',
    'Первое сообщение индивидуальному мастеру',
    'Мастер: первое касание',
    'Короткое первое сообщение, чтобы аккуратно начать диалог с мастером.',
    'master',
    'first_touch',
    'instagram',
    'active',
    'Привет, {{first_name}}! Мы сейчас запускаем Hutka — сервис, где beauty-мастера смогут получать заявки через карту и удобнее вести запись. Хочу задать пару коротких вопросов, чтобы понять, насколько это может быть полезно для вашего направления {{niche}}. Можно отправить короткую анкету?',
    1
  ),
  (
    'send-questionnaire',
    'Отправка персональной анкеты',
    'Отправить анкету',
    'Сообщение для отправки персональной ссылки на вопросы из карточки контакта.',
    'any',
    'questionnaire',
    'any',
    'active',
    '{{first_name}}, спасибо! Вот короткая анкета — она поможет понять, как вам может быть полезна Hutka и что нужно учесть в тестировании:\n\n{{questionnaire_link}}\n\nОтветы займут 2–4 минуты.',
    2
  ),
  (
    'questionnaire-reminder',
    'Напоминание пройти анкету',
    'Напоминание по анкете',
    'Мягкое напоминание, если человек получил ссылку, но еще не ответил.',
    'any',
    'follow_up',
    'any',
    'active',
    '{{first_name}}, привет! Напомню про короткую анкету по Hutka. Она нужна, чтобы мы не предлагали лишнее, а поняли именно вашу ситуацию: {{questionnaire_link}}\n\nБуду благодарен за ответы, когда будет удобно.',
    3
  ),
  (
    'pilot-invite',
    'Приглашение в тестирование',
    'Пригласить в тест',
    'Сообщение, когда контакт подходит для раннего тестирования.',
    'any',
    'pilot',
    'any',
    'active',
    '{{first_name}}, по вашим ответам вижу, что вы хорошо подходите для первой группы тестирования Hutka. Предлагаю подключить вас к раннему тесту: поможем оформить профиль, посмотрим, как работает карта и какие заявки можно получать. Вам удобно обсудить детали?',
    4
  ),
  (
    'refusal-clarify',
    'Уточнить причину отказа',
    'Причина отказа',
    'Короткое сообщение, чтобы понять реальную причину отказа или паузы.',
    'any',
    'refusal',
    'any',
    'active',
    'Понял, {{first_name}}, спасибо за честный ответ. Можно коротко уточнить, что больше всего мешает сейчас: нет времени, пока непонятна польза, уже есть система, не хочется заполнять профиль или просто сейчас неактуально? Это поможет нам лучше доработать Hutka.',
    5
  ),
  (
    'feedback-after-pilot',
    'Фидбек после теста',
    'Фидбек после теста',
    'Сообщение для сбора обратной связи после тестирования.',
    'any',
    'feedback',
    'any',
    'active',
    '{{first_name}}, спасибо, что протестировали Hutka. Очень важно понять, что было полезно, что неудобно и чего не хватило. Можете коротко написать 2–3 мысли или пройти мини-анкету: {{questionnaire_link}}',
    6
  )
on conflict (slug) do update
set
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  audience = excluded.audience,
  category = excluded.category,
  channel = excluded.channel,
  status = excluded.status,
  body = excluded.body,
  order_index = excluded.order_index,
  updated_at = now();

-- STEP 35: refusal reasons and refusal analytics
create table if not exists public.refusal_reasons (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  color text default 'gray',
  is_active boolean default true,
  order_index int default 99,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.leads add column if not exists refusal_reason_id uuid references public.refusal_reasons(id) on delete set null;
alter table public.leads add column if not exists refusal_reason text;
alter table public.leads add column if not exists refusal_comment text;
alter table public.leads add column if not exists refused_at timestamptz;

create index if not exists refusal_reasons_active_order_idx on public.refusal_reasons(is_active, order_index, name);
create index if not exists leads_refusal_reason_id_idx on public.leads(refusal_reason_id);
create index if not exists leads_refused_at_idx on public.leads(refused_at desc);

alter table public.refusal_reasons enable row level security;

drop policy if exists "Authenticated users can read refusal_reasons" on public.refusal_reasons;
create policy "Authenticated users can read refusal_reasons"
  on public.refusal_reasons
  for select to authenticated
  using (true);

drop policy if exists "Admins can insert refusal_reasons" on public.refusal_reasons;
create policy "Admins can insert refusal_reasons"
  on public.refusal_reasons
  for insert to authenticated
  with check (public.current_profile_role() = 'admin');

drop policy if exists "Admins can update refusal_reasons" on public.refusal_reasons;
create policy "Admins can update refusal_reasons"
  on public.refusal_reasons
  for update to authenticated
  using (public.current_profile_role() = 'admin')
  with check (public.current_profile_role() = 'admin');

drop policy if exists "Admins can delete refusal_reasons" on public.refusal_reasons;
create policy "Admins can delete refusal_reasons"
  on public.refusal_reasons
  for delete to authenticated
  using (public.current_profile_role() = 'admin');

insert into public.refusal_reasons (name, description, color, is_active, order_index)
values
  ('Нет времени', 'Человеку интересно, но сейчас нет ресурса проходить тест или заполнять профиль.', 'yellow', true, 1),
  ('Неактуально сейчас', 'Потребность может появиться позже, контакт стоит вернуть в follow-up.', 'gray', true, 2),
  ('Уже есть CRM', 'Пользуется другой системой и не видит причины менять процесс.', 'blue', true, 3),
  ('Не понимает пользу', 'Нужно лучше объяснить ценность карты, заявок и записи.', 'purple', true, 4),
  ('Не хочет заполнять профиль', 'Барьер онбординга: нужно упростить профиль или помочь заполнить.', 'pink', true, 5),
  ('Не верит, что будут заявки', 'Нужны кейсы, доказательства и примеры реального спроса.', 'red', true, 6),
  ('Не готов платить', 'Пока не видит окупаемости или ценности платного формата.', 'red', true, 7),
  ('Не наш сегмент', 'Контакт не подходит для текущей фазы запуска.', 'gray', true, 8),
  ('Другое', 'Причина требует ручного комментария.', 'gray', true, 99)
on conflict (name) do update
set
  description = excluded.description,
  color = excluded.color,
  is_active = excluded.is_active,
  order_index = excluded.order_index,
  updated_at = now();

create or replace view public.view_refusal_reason_distribution as
select
  coalesce(rr.name, l.refusal_reason, 'Причина не указана') as reason,
  coalesce(rr.color, 'gray') as color,
  count(*)::int as contacts
from public.leads l
left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
where l.refused_at is not null or l.refusal_reason is not null
group by coalesce(rr.name, l.refusal_reason, 'Причина не указана'), coalesce(rr.color, 'gray')
order by contacts desc, reason asc;

-- STEP 36: saved contact views and smart filters
create table if not exists public.saved_lead_views (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists saved_lead_views_profile_created_idx on public.saved_lead_views(profile_id, created_at desc);

alter table public.saved_lead_views enable row level security;

drop policy if exists "Users can read own saved lead views" on public.saved_lead_views;
create policy "Users can read own saved lead views"
  on public.saved_lead_views
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = saved_lead_views.profile_id
    and p.user_id = auth.uid()
  ));

drop policy if exists "Users can insert own saved lead views" on public.saved_lead_views;
create policy "Users can insert own saved lead views"
  on public.saved_lead_views
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = saved_lead_views.profile_id
    and p.user_id = auth.uid()
  ));

drop policy if exists "Users can update own saved lead views" on public.saved_lead_views;
create policy "Users can update own saved lead views"
  on public.saved_lead_views
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = saved_lead_views.profile_id
    and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = saved_lead_views.profile_id
    and p.user_id = auth.uid()
  ));

drop policy if exists "Users can delete own saved lead views" on public.saved_lead_views;
create policy "Users can delete own saved lead views"
  on public.saved_lead_views
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = saved_lead_views.profile_id
    and p.user_id = auth.uid()
  ));

-- Step 39: Telegram notifications and delivery logs
create table if not exists public.telegram_delivery_logs (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null default 'manual',
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  chat_id text,
  message text,
  error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.telegram_delivery_logs enable row level security;

create index if not exists telegram_delivery_logs_created_at_idx on public.telegram_delivery_logs(created_at desc);
create index if not exists telegram_delivery_logs_event_type_idx on public.telegram_delivery_logs(event_type);
create index if not exists telegram_delivery_logs_status_idx on public.telegram_delivery_logs(status);

insert into public.app_settings (key, value) values
  ('telegram_enabled', 'false'),
  ('telegram_chat_id', ''),
  ('telegram_notify_questionnaires', 'true'),
  ('telegram_notify_followups', 'false'),
  ('telegram_daily_digest_enabled', 'false'),
  ('telegram_daily_digest_hour', '09:00')
on conflict (key) do nothing;

drop policy if exists "Authenticated users can read telegram delivery logs" on public.telegram_delivery_logs;
create policy "Authenticated users can read telegram delivery logs"
  on public.telegram_delivery_logs
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert telegram delivery logs" on public.telegram_delivery_logs;
drop policy if exists "Workspace editors can insert telegram delivery logs" on public.telegram_delivery_logs;
create policy "Workspace editors can insert telegram delivery logs"
  on public.telegram_delivery_logs
  for insert
  to authenticated
  with check (public.current_profile_role() in ('admin', 'marketer'));

-- STEP 39: Telegram notifications
alter table public.profiles add column if not exists telegram_chat_id text;
alter table public.profiles add column if not exists telegram_notifications_enabled boolean default false;
alter table public.profiles add column if not exists telegram_last_test_at timestamptz;

create index if not exists profiles_telegram_chat_id_idx on public.profiles(telegram_chat_id);
create index if not exists profiles_telegram_notifications_enabled_idx on public.profiles(telegram_notifications_enabled);

-- Step 41: task team roles
drop policy if exists "Authenticated users can read task_assignees" on public.task_assignees;
create policy "Authenticated users can read task_assignees"
  on public.task_assignees
  for select to authenticated
  using (true);

drop policy if exists "Workspace editors can insert task_assignees" on public.task_assignees;
create policy "Workspace editors can insert task_assignees"
  on public.task_assignees
  for insert to authenticated
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can update task_assignees" on public.task_assignees;
create policy "Workspace editors can update task_assignees"
  on public.task_assignees
  for update to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'))
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can delete task_assignees" on public.task_assignees;
create policy "Workspace editors can delete task_assignees"
  on public.task_assignees
  for delete to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'));

-- Step 42: indexes for the most frequent workspace reads and actions
create index if not exists leads_source_id_idx
  on public.leads(source_id);
create index if not exists leads_created_at_idx
  on public.leads(created_at desc);
create index if not exists leads_name_idx
  on public.leads(name);
create index if not exists leads_priority_updated_idx
  on public.leads(priority_score desc, updated_at desc);
create index if not exists leads_next_contact_date_idx
  on public.leads(next_contact_date)
  where next_contact_date is not null;
create index if not exists leads_city_idx
  on public.leads(city)
  where city is not null and city <> '';
create index if not exists leads_niche_idx
  on public.leads(niche)
  where niche is not null and niche <> '';

create index if not exists lead_interactions_lead_created_idx
  on public.lead_interactions(lead_id, created_at desc);

create index if not exists tasks_open_due_date_idx
  on public.tasks(due_date)
  where status in ('todo', 'in_progress') and due_date is not null;
create index if not exists tasks_open_lead_created_idx
  on public.tasks(lead_id, created_at desc)
  where status in ('todo', 'in_progress');

create index if not exists survey_answers_created_at_idx
  on public.survey_answers(created_at desc);
create index if not exists survey_answers_survey_created_idx
  on public.survey_answers(survey_id, created_at desc);
create index if not exists survey_questions_survey_order_idx
  on public.survey_questions(survey_id, order_index);
create index if not exists survey_answers_response_group_idx
  on public.survey_answers(response_group_id)
  where response_group_id is not null;

create index if not exists lead_questionnaires_status_created_idx
  on public.lead_questionnaires(status, created_at desc);

-- Step 43: database pagination and metadata for the contact directory
create or replace function public.hutka_normalize_stage_name(input text)
returns text
language sql
immutable
as $$
  select case lower(replace(trim(coalesce(input, '')), 'ё', 'е'))
    when 'найден' then 'Новый'
    when 'найдено' then 'Новый'
    when 'новый' then 'Новый'
    when 'новая' then 'Новый'
    when 'написал' then 'Написали'
    when 'написали' then 'Написали'
    when 'написана' then 'Написали'
    when 'ответил' then 'Ответил'
    when 'ответила' then 'Ответил'
    when 'ответили' then 'Ответил'
    when 'заинтересован' then 'Заинтересован'
    when 'заинтересована' then 'Заинтересован'
    when 'опрос' then 'Заинтересован'
    when 'анкета' then 'Заинтересован'
    when 'готов к пилоту' then 'Заинтересован'
    when 'горячий контакт' then 'Заинтересован'
    when 'горячий лид' then 'Заинтересован'
    when 'тест' then 'Тестирует'
    when 'тестирует' then 'Тестирует'
    when 'тестирование' then 'Тестирует'
    when 'активен' then 'Тестирует'
    when 'активна' then 'Тестирует'
    when 'активный участник' then 'Тестирует'
    when 'тестер' then 'Тестирует'
    when 'пилот' then 'Тестирует'
    when 'готов тестировать' then 'Тестирует'
    when 'готова тестировать' then 'Тестирует'
    when 'пауза' then 'Пауза'
    when 'вернуться позже' then 'Пауза'
    when 'отложен' then 'Пауза'
    when 'отложена' then 'Пауза'
    when 'отказ' then 'Отказ'
    when 'отказы' then 'Отказ'
    when 'lost' then 'Отказ'
    when 'rejected' then 'Отказ'
    else coalesce(nullif(trim(input), ''), 'Новый')
  end;
$$;

create or replace function public.get_lead_directory_page(
  p_q text default null,
  p_type text default null,
  p_city text default null,
  p_niche text default null,
  p_stage text default null,
  p_source text default null,
  p_priority text default null,
  p_tag text default null,
  p_view text default null,
  p_offset integer default 0,
  p_limit integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      l.id,
      l.name,
      l.type,
      case l.type
        when 'salon' then 'Салон'
        when 'client' then 'Клиент'
        when 'partner' then 'Партнер'
        else 'Мастер'
      end as type_label,
      l.niche,
      l.city,
      l.phone,
      l.telegram,
      l.instagram,
      l.email,
      l.priority_score,
      case
        when coalesce(l.priority_score, 0) >= 75 then 'Высокий'
        when coalesce(l.priority_score, 0) >= 45 then 'Средний'
        else 'Низкий'
      end as priority_label,
      l.notes,
      l.next_step,
      l.next_contact_date,
      l.refusal_reason,
      l.refusal_comment,
      l.refused_at,
      l.created_at,
      s.name as source_name,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      rr.name as refusal_reason_name,
      coalesce(tag_data.tags, array[]::text[]) as tags,
      coalesce(tag_data.interested_tag, false) as interested_tag,
      coalesce(tag_data.testing_tag, false) as testing_tag,
      coalesce(tag_data.return_tag, false) as return_tag
    from public.leads l
    left join public.sources s on s.id = l.source_id
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
    left join lateral (
      select
        coalesce(array_agg(distinct t.name order by t.name) filter (where nullif(trim(t.name), '') is not null), array[]::text[]) as tags,
        coalesce(bool_or(lower(replace(trim(t.name), 'ё', 'е')) in (
          'заинтересован', 'горячий контакт', 'горячий лид', 'готов к пилоту'
        )), false) as interested_tag,
        coalesce(bool_or(lower(replace(trim(t.name), 'ё', 'е')) in (
          'тестирует', 'тестирование', 'тестер', 'пилот', 'готов тестировать', 'готова тестировать'
        )), false) as testing_tag,
        coalesce(bool_or(
          lower(replace(trim(t.name), 'ё', 'е')) like '%вернуться%'
          or lower(replace(trim(t.name), 'ё', 'е')) like '%пауза%'
        ), false) as return_tag
      from public.lead_tags lt
      join public.tags t on t.id = lt.tag_id
      where lt.lead_id = l.id
    ) tag_data on true
  ),
  filtered as materialized (
    select *
    from base b
    where
      (
        nullif(trim(p_type), '') is null
        or lower(b.type_label) = lower(trim(p_type))
        or b.type = lower(trim(p_type))
      )
      and (
        nullif(trim(p_city), '') is null
        or (
          lower(trim(p_city)) = lower('Не указан')
          and nullif(trim(coalesce(b.city, '')), '') is null
        )
        or lower(trim(coalesce(b.city, ''))) = lower(trim(p_city))
      )
      and (
        nullif(trim(p_niche), '') is null
        or (
          lower(trim(p_niche)) = lower('Не указана')
          and nullif(trim(coalesce(b.niche, '')), '') is null
        )
        or lower(trim(coalesce(b.niche, ''))) = lower(trim(p_niche))
      )
      and (
        nullif(trim(p_stage), '') is null
        or b.stage_name = public.hutka_normalize_stage_name(p_stage)
      )
      and (
        nullif(trim(p_source), '') is null
        or (
          lower(trim(p_source)) = lower('Не указан')
          and nullif(trim(coalesce(b.source_name, '')), '') is null
        )
        or lower(trim(coalesce(b.source_name, ''))) = lower(trim(p_source))
      )
      and (
        nullif(trim(p_priority), '') is null
        or lower(b.priority_label) = lower(trim(p_priority))
      )
      and (
        nullif(trim(p_tag), '') is null
        or exists (
          select 1
          from unnest(b.tags) as selected_tag(name)
          where lower(trim(selected_tag.name)) = lower(trim(p_tag))
        )
      )
      and (
        nullif(trim(p_q), '') is null
        or concat_ws(
          ' ',
          b.name,
          b.type_label,
          coalesce(nullif(trim(b.niche), ''), 'Не указана'),
          coalesce(nullif(trim(b.city), ''), 'Не указан'),
          b.stage_name,
          coalesce(nullif(trim(b.source_name), ''), 'Не указан'),
          b.priority_label,
          coalesce(nullif(trim(b.next_step), ''), 'Связаться'),
          b.instagram,
          b.telegram,
          b.phone,
          b.email,
          b.notes,
          array_to_string(b.tags, ' ')
        ) ilike '%' || trim(p_q) || '%'
      )
      and (
        nullif(trim(p_view), '') is null
        or lower(trim(p_view)) = 'all'
        or lower(trim(p_view)) not in (
          'all', 'interested', 'hot', 'testing', 'pilot', 'need-write', 'followup',
          'unanswered', 'paused', 'refusals', 'no-next-step'
        )
        or (
          lower(trim(p_view)) in ('interested', 'hot')
          and (b.stage_name = 'Заинтересован' or coalesce(b.priority_score, 0) >= 75 or b.interested_tag)
        )
        or (
          lower(trim(p_view)) in ('testing', 'pilot')
          and (b.stage_name = 'Тестирует' or b.testing_tag)
        )
        or (
          lower(trim(p_view)) in ('need-write', 'followup')
          and b.stage_name not in ('Отказ', 'Тестирует')
          and (
            b.next_contact_date < date_trunc('day', now()) + interval '1 day'
            or b.return_tag
          )
        )
        or (
          lower(trim(p_view)) = 'unanswered'
          and b.stage_name in ('Новый', 'Написали')
        )
        or (
          lower(trim(p_view)) = 'paused'
          and (b.stage_name = 'Пауза' or b.return_tag)
        )
        or (
          lower(trim(p_view)) = 'refusals'
          and (
            b.stage_name = 'Отказ'
            or nullif(trim(coalesce(b.refusal_reason, b.refusal_reason_name, '')), '') is not null
          )
        )
        or (
          lower(trim(p_view)) = 'no-next-step'
          and b.stage_name not in ('Отказ', 'Тестирует')
          and (
            nullif(trim(coalesce(b.next_step, '')), '') is null
            or lower(trim(b.next_step)) in ('связаться', '—')
            or b.next_contact_date is null
          )
        )
      )
  ),
  paged as (
    select *
    from filtered
    order by created_at desc nulls last, id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'type', p.type,
          'niche', p.niche,
          'city', p.city,
          'phone', p.phone,
          'telegram', p.telegram,
          'instagram', p.instagram,
          'email', p.email,
          'priority_score', p.priority_score,
          'notes', p.notes,
          'next_step', p.next_step,
          'next_contact_date', p.next_contact_date,
          'refusal_reason', p.refusal_reason,
          'refusal_comment', p.refusal_comment,
          'refused_at', p.refused_at,
          'created_at', p.created_at,
          'sources', case when p.source_name is null then null else jsonb_build_object('name', p.source_name) end,
          'funnel_stages', jsonb_build_object('name', p.stage_name),
          'refusal_reasons', case when p.refusal_reason_name is null then null else jsonb_build_object('name', p.refusal_reason_name) end,
          'lead_tags', coalesce((
            select jsonb_agg(jsonb_build_object('tags', jsonb_build_object('name', tag_item.name)))
            from unnest(p.tags) as tag_item(name)
          ), '[]'::jsonb)
        )
        order by p.created_at desc nulls last, p.id desc
      )
      from paged p
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_lead_directory_meta()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      case l.type
        when 'salon' then 'Салон'
        when 'client' then 'Клиент'
        when 'partner' then 'Партнер'
        else 'Мастер'
      end as type_label,
      coalesce(nullif(trim(l.city), ''), 'Не указан') as city_label,
      coalesce(nullif(trim(l.niche), ''), 'Не указана') as niche_label,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      coalesce(nullif(trim(s.name), ''), 'Не указан') as source_name,
      case
        when coalesce(l.priority_score, 0) >= 75 then 'Высокий'
        when coalesce(l.priority_score, 0) >= 45 then 'Средний'
        else 'Низкий'
      end as priority_label,
      l.priority_score,
      l.next_step,
      l.next_contact_date,
      l.refusal_reason,
      rr.name as refusal_reason_name,
      coalesce(tag_data.tags, array[]::text[]) as tags,
      coalesce(tag_data.interested_tag, false) as interested_tag,
      coalesce(tag_data.testing_tag, false) as testing_tag,
      coalesce(tag_data.return_tag, false) as return_tag
    from public.leads l
    left join public.sources s on s.id = l.source_id
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
    left join lateral (
      select
        coalesce(array_agg(distinct t.name order by t.name) filter (where nullif(trim(t.name), '') is not null), array[]::text[]) as tags,
        coalesce(bool_or(lower(replace(trim(t.name), 'ё', 'е')) in (
          'заинтересован', 'горячий контакт', 'горячий лид', 'готов к пилоту'
        )), false) as interested_tag,
        coalesce(bool_or(lower(replace(trim(t.name), 'ё', 'е')) in (
          'тестирует', 'тестирование', 'тестер', 'пилот', 'готов тестировать', 'готова тестировать'
        )), false) as testing_tag,
        coalesce(bool_or(
          lower(replace(trim(t.name), 'ё', 'е')) like '%вернуться%'
          or lower(replace(trim(t.name), 'ё', 'е')) like '%пауза%'
        ), false) as return_tag
      from public.lead_tags lt
      join public.tags t on t.id = lt.tag_id
      where lt.lead_id = l.id
    ) tag_data on true
  )
  select jsonb_build_object(
    'total', count(*),
    'types', coalesce((
      select jsonb_agg(value order by value)
      from (select distinct type_label as value from base) values_list
    ), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(value order by value)
      from (select distinct city_label as value from base) values_list
    ), '[]'::jsonb),
    'niches', coalesce((
      select jsonb_agg(value order by value)
      from (select distinct niche_label as value from base) values_list
    ), '[]'::jsonb),
    'stages', coalesce((
      select jsonb_agg(value order by order_index, value)
      from (
        select distinct
          stage_name as value,
          case stage_name
            when 'Новый' then 1
            when 'Написали' then 2
            when 'Ответил' then 3
            when 'Заинтересован' then 4
            when 'Тестирует' then 5
            when 'Пауза' then 6
            when 'Отказ' then 7
            else 99
          end as order_index
        from base
      ) values_list
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(value order by value)
      from (select distinct source_name as value from base) values_list
    ), '[]'::jsonb),
    'priorities', coalesce((
      select jsonb_agg(value order by order_index)
      from (
        select distinct
          priority_label as value,
          case priority_label when 'Высокий' then 1 when 'Средний' then 2 else 3 end as order_index
        from base
      ) values_list
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(value order by value)
      from (
        select distinct tag_item.name as value
        from base
        cross join lateral unnest(base.tags) as tag_item(name)
        where nullif(trim(tag_item.name), '') is not null
      ) values_list
    ), '[]'::jsonb),
    'smart_counts', jsonb_build_object(
      'all', count(*),
      'interested', count(*) filter (
        where stage_name = 'Заинтересован' or coalesce(priority_score, 0) >= 75 or interested_tag
      ),
      'testing', count(*) filter (
        where stage_name = 'Тестирует' or testing_tag
      ),
      'need-write', count(*) filter (
        where stage_name not in ('Отказ', 'Тестирует')
          and (
            next_contact_date < date_trunc('day', now()) + interval '1 day'
            or return_tag
          )
      ),
      'unanswered', count(*) filter (
        where stage_name in ('Новый', 'Написали')
      ),
      'paused', count(*) filter (
        where stage_name = 'Пауза' or return_tag
      ),
      'refusals', count(*) filter (
        where stage_name = 'Отказ'
          or nullif(trim(coalesce(refusal_reason, refusal_reason_name, '')), '') is not null
      ),
      'no-next-step', count(*) filter (
        where stage_name not in ('Отказ', 'Тестирует')
          and (
            nullif(trim(coalesce(next_step, '')), '') is null
            or lower(trim(next_step)) in ('связаться', '—')
            or next_contact_date is null
          )
      )
    )
  )
  from base;
$$;

revoke all on function public.hutka_normalize_stage_name(text) from public;
revoke all on function public.get_lead_directory_page(text, text, text, text, text, text, text, text, text, integer, integer) from public;
revoke all on function public.get_lead_directory_meta() from public;

grant execute on function public.hutka_normalize_stage_name(text) to authenticated, service_role;
grant execute on function public.get_lead_directory_page(text, text, text, text, text, text, text, text, text, integer, integer) to authenticated, service_role;
grant execute on function public.get_lead_directory_meta() to authenticated, service_role;

-- Step 44: atomic task creation from the "What to do" workspace
create index if not exists tasks_open_lead_title_idx
  on public.tasks(lead_id, title)
  where status in ('todo', 'in_progress');

create or replace function public.create_followup_task(
  p_lead_id uuid,
  p_title text,
  p_description text default null,
  p_due_date timestamptz default null,
  p_priority text default 'medium',
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_task_id uuid;
  new_task_id uuid;
  normalized_title text := nullif(trim(p_title), '');
  normalized_priority text := case
    when p_priority in ('none', 'low', 'medium', 'high', 'urgent') then p_priority
    else 'medium'
  end;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  if normalized_title is null then
    return jsonb_build_object('ok', false, 'error', 'missing-followup-data');
  end if;

  if not exists (
    select 1
    from public.leads
    where id = p_lead_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'lead-not-found');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_lead_id::text),
    hashtext(lower(normalized_title))
  );

  select id
  into existing_task_id
  from public.tasks
  where lead_id = p_lead_id
    and title = normalized_title
    and status in ('todo', 'in_progress')
  order by created_at desc
  limit 1;

  if existing_task_id is not null then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'task_id', existing_task_id
    );
  end if;

  insert into public.tasks (
    lead_id,
    title,
    description,
    due_date,
    priority,
    status,
    created_by
  )
  values (
    p_lead_id,
    normalized_title,
    nullif(trim(coalesce(p_description, '')), ''),
    p_due_date,
    normalized_priority,
    'todo',
    p_created_by
  )
  returning id into new_task_id;

  insert into public.lead_interactions (
    lead_id,
    type,
    channel,
    text,
    result,
    created_by
  )
  values (
    p_lead_id,
    'note',
    'Hutka',
    'Автоматически создана задача по рекомендации: ' || normalized_title,
    'auto_followup_task_created',
    p_created_by
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'task_id', new_task_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'followup-task-failed'
    );
end;
$$;

revoke all on function public.create_followup_task(uuid, text, text, timestamptz, text, uuid) from public;
grant execute on function public.create_followup_task(uuid, text, text, timestamptz, text, uuid) to authenticated, service_role;

-- Step 45: database pagination and exact counters for the task workspace
create or replace function public.get_task_directory_page(
  p_q text default null,
  p_status text default 'active',
  p_priority text default null,
  p_due text default null,
  p_lead_id text default null,
  p_profile_id text default null,
  p_offset integer default 0,
  p_limit integer default 40
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      t.id,
      t.title,
      t.description,
      t.due_date,
      t.priority,
      t.status,
      t.created_at,
      l.id as lead_id,
      l.name as lead_name,
      coalesce(assignee_data.assignees, '[]'::jsonb) as assignees,
      coalesce(assignee_data.search_text, '') as assignee_search
    from public.tasks t
    left join public.leads l on l.id = t.lead_id
    left join lateral (
      select
        jsonb_agg(
          jsonb_build_object(
            'role', ta.role,
            'profiles', jsonb_build_object(
              'id', p.id,
              'full_name', p.full_name,
              'email', p.email,
              'job_title', p.job_title,
              'avatar_url', p.avatar_url
            )
          )
          order by
            case ta.role when 'responsible' then 1 when 'executor' then 2 else 3 end,
            coalesce(nullif(trim(p.full_name), ''), p.email)
        ) as assignees,
        string_agg(
          concat_ws(' ', p.full_name, p.email, p.job_title, ta.role),
          ' '
        ) as search_text
      from public.task_assignees ta
      join public.profiles p on p.id = ta.profile_id
      where ta.task_id = t.id
    ) assignee_data on true
  ),
  filtered as materialized (
    select *
    from base b
    where
      (
        nullif(trim(p_status), '') is null
        or (
          lower(trim(p_status)) = 'active'
          and b.status in ('todo', 'in_progress')
        )
        or (
          lower(trim(p_status)) <> 'active'
          and b.status = lower(trim(p_status))
        )
      )
      and (
        nullif(trim(p_priority), '') is null
        or b.priority = lower(trim(p_priority))
      )
      and (
        nullif(trim(p_lead_id), '') is null
        or b.lead_id::text = trim(p_lead_id)
      )
      and (
        nullif(trim(p_profile_id), '') is null
        or exists (
          select 1
          from public.task_assignees selected_assignee
          where selected_assignee.task_id = b.id
            and selected_assignee.profile_id::text = trim(p_profile_id)
        )
      )
      and (
        nullif(trim(p_due), '') is null
        or (
          lower(trim(p_due)) = 'overdue'
          and b.due_date < date_trunc('day', now())
        )
        or (
          lower(trim(p_due)) = 'today'
          and b.due_date >= date_trunc('day', now())
          and b.due_date < date_trunc('day', now()) + interval '1 day'
        )
        or (
          lower(trim(p_due)) = 'week'
          and b.due_date >= date_trunc('day', now()) + interval '1 day'
          and b.due_date < date_trunc('day', now()) + interval '7 days'
        )
        or (
          lower(trim(p_due)) = 'later'
          and b.due_date >= date_trunc('day', now()) + interval '7 days'
        )
        or (
          lower(trim(p_due)) = 'no_date'
          and b.due_date is null
        )
      )
      and (
        nullif(trim(p_q), '') is null
        or concat_ws(
          ' ',
          b.title,
          b.description,
          b.lead_name,
          b.priority,
          b.status,
          b.assignee_search
        ) ilike '%' || trim(p_q) || '%'
      )
  ),
  paged as (
    select *
    from filtered
    order by due_date asc nulls last, created_at desc, id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'overdue', count(*) filter (
          where status in ('todo', 'in_progress')
            and due_date < date_trunc('day', now())
        ),
        'today', count(*) filter (
          where status in ('todo', 'in_progress')
            and due_date >= date_trunc('day', now())
            and due_date < date_trunc('day', now()) + interval '1 day'
        ),
        'urgent', count(*) filter (where priority = 'urgent'),
        'done', count(*) filter (where status = 'done')
      )
      from filtered
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'description', p.description,
          'due_date', p.due_date,
          'priority', p.priority,
          'status', p.status,
          'created_at', p.created_at,
          'leads', case
            when p.lead_id is null then null
            else jsonb_build_object('id', p.lead_id, 'name', p.lead_name)
          end,
          'assignees', p.assignees
        )
        order by p.due_date asc nulls last, p.created_at desc, p.id desc
      )
      from paged p
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_task_directory_page(text, text, text, text, text, text, integer, integer) from public;
grant execute on function public.get_task_directory_page(text, text, text, text, text, text, integer, integer) to authenticated, service_role;

-- Step 46: compact aggregates for campaign and survey lists
create or replace function public.get_campaign_summaries()
returns table (
  id uuid,
  name text,
  goal text,
  channel text,
  city text,
  niche text,
  budget numeric,
  offer_text text,
  status text,
  start_date date,
  end_date date,
  result_notes text,
  created_at timestamptz,
  contacts_count bigint,
  responses_count bigint,
  interested_count bigint,
  testing_count bigint,
  refused_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.goal,
    c.channel,
    c.city,
    c.niche,
    c.budget,
    c.offer_text,
    c.status,
    c.start_date,
    c.end_date,
    c.result_notes,
    c.created_at,
    count(distinct cl.lead_id) as contacts_count,
    count(distinct cl.lead_id) filter (
      where public.hutka_normalize_stage_name(fs.name) in ('Ответил', 'Заинтересован', 'Тестирует')
    ) as responses_count,
    count(distinct cl.lead_id) filter (
      where public.hutka_normalize_stage_name(fs.name) in ('Заинтересован', 'Тестирует')
    ) as interested_count,
    count(distinct cl.lead_id) filter (
      where public.hutka_normalize_stage_name(fs.name) = 'Тестирует'
    ) as testing_count,
    count(distinct cl.lead_id) filter (
      where public.hutka_normalize_stage_name(fs.name) = 'Отказ'
    ) as refused_count
  from public.campaigns c
  left join public.campaign_leads cl on cl.campaign_id = c.id
  left join public.leads l on l.id = cl.lead_id
  left join public.funnel_stages fs on fs.id = l.stage_id
  group by c.id
  order by c.created_at desc;
$$;

create or replace function public.get_survey_summaries()
returns table (
  id uuid,
  title text,
  type text,
  description text,
  status text,
  slug text,
  created_at timestamptz,
  questions_count bigint,
  answers_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.type,
    s.description,
    s.status,
    s.slug,
    s.created_at,
    coalesce(question_counts.total, 0) as questions_count,
    coalesce(answer_counts.total, 0) as answers_count
  from public.surveys s
  left join lateral (
    select count(*) as total
    from public.survey_questions sq
    where sq.survey_id = s.id
  ) question_counts on true
  left join lateral (
    select count(distinct coalesce(sa.response_group_id, sa.id)) as total
    from public.survey_answers sa
    where sa.survey_id = s.id
  ) answer_counts on true
  order by s.created_at desc;
$$;

revoke all on function public.get_campaign_summaries() from public;
revoke all on function public.get_survey_summaries() from public;

grant execute on function public.get_campaign_summaries() to authenticated, service_role;
grant execute on function public.get_survey_summaries() to authenticated, service_role;

-- Step 47: database classification and pagination for "What to do"
create index if not exists lead_questionnaires_lead_status_created_idx
  on public.lead_questionnaires(lead_id, status, created_at desc);

create or replace function public.get_followup_recommendations_page(
  p_reason text default null,
  p_offset integer default 0,
  p_limit integer default 40,
  p_bulk_limit integer default 10
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      l.id,
      l.name,
      l.niche,
      l.city,
      l.priority_score,
      l.next_step,
      l.next_contact_date,
      l.created_at,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      exists (
        select 1
        from public.tasks open_task
        where open_task.lead_id = l.id
          and open_task.status in ('todo', 'in_progress')
      ) as has_open_task,
      coalesce(activity.last_activity, l.created_at) as last_activity,
      unanswered.questionnaire_id,
      unanswered.questionnaire_title
    from public.leads l
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join lateral (
      select max(li.created_at) as last_activity
      from public.lead_interactions li
      where li.lead_id = l.id
    ) activity on true
    left join lateral (
      select
        questionnaire.id as questionnaire_id,
        questionnaire.title as questionnaire_title
      from public.lead_questionnaires questionnaire
      where questionnaire.lead_id = l.id
        and questionnaire.status = 'active'
        and not exists (
          select 1
          from public.lead_questionnaire_answers answer
          where answer.questionnaire_id = questionnaire.id
        )
      order by questionnaire.created_at desc
      limit 1
    ) unanswered on true
    where public.hutka_normalize_stage_name(fs.name) <> 'Отказ'
  ),
  reasoned as materialized (
    select
      b.*,
      case
        when b.next_contact_date < date_trunc('day', now()) then 'overdue_followup'
        when b.next_contact_date >= date_trunc('day', now())
          and b.next_contact_date < date_trunc('day', now()) + interval '1 day'
          then 'today_followup'
        when coalesce(b.priority_score, 0) >= 75 and not b.has_open_task
          then 'hot_without_task'
        when b.questionnaire_id is not null and not b.has_open_task
          then 'unanswered_questionnaire'
        when (
          nullif(trim(coalesce(b.next_step, '')), '') is null
          or b.next_contact_date is null
        ) and not b.has_open_task
          then 'missing_next_action'
        when b.stage_name in ('Новый', 'Написали', 'Ответил', 'Заинтересован')
          and b.last_activity < date_trunc('day', now()) - interval '7 days'
          and not b.has_open_task
          then 'stale_stage'
        else null
      end as reason
    from base b
  ),
  classified as materialized (
    select
      r.*,
      case
        when r.reason = 'overdue_followup' then 0
        when r.reason = 'today_followup' and coalesce(r.priority_score, 0) >= 75 then 0
        when r.reason in ('today_followup', 'hot_without_task') then 1
        when r.reason in ('missing_next_action', 'stale_stage') and coalesce(r.priority_score, 0) >= 60 then 1
        else 2
      end as priority_weight
    from reasoned r
    where r.reason is not null
  ),
  filtered as materialized (
    select *
    from classified c
    where nullif(trim(p_reason), '') is null
      or c.reason = trim(p_reason)
  ),
  paged as (
    select *
    from filtered
    order by priority_weight, priority_score desc nulls last, created_at desc, id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ),
  bulk_page as (
    select *
    from classified
    where not has_open_task
    order by priority_weight, priority_score desc nulls last, created_at desc, id
    limit least(greatest(coalesce(p_bulk_limit, 10), 1), 25)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'urgent', count(*) filter (where priority_weight = 0),
        'overdue', count(*) filter (where reason = 'overdue_followup'),
        'today', count(*) filter (where reason = 'today_followup'),
        'hot', count(*) filter (where reason = 'hot_without_task'),
        'questionnaires', count(*) filter (where reason = 'unanswered_questionnaire'),
        'without_tasks', count(*) filter (where not has_open_task)
      )
      from classified
    ),
    'items', coalesce((
      select jsonb_agg(
        to_jsonb(p) - 'priority_weight'
        order by p.priority_weight, p.priority_score desc nulls last, p.created_at desc, p.id
      )
      from paged p
    ), '[]'::jsonb),
    'bulk_items', coalesce((
      select jsonb_agg(
        to_jsonb(b) - 'priority_weight'
        order by b.priority_weight, b.priority_score desc nulls last, b.created_at desc, b.id
      )
      from bulk_page b
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_followup_recommendations_page(text, integer, integer, integer) from public;
grant execute on function public.get_followup_recommendations_page(text, integer, integer, integer) to authenticated, service_role;

-- Step 48: exact funnel aggregates with bounded cards per stage
create index if not exists leads_stage_updated_idx
  on public.leads(stage_id, updated_at desc);

create or replace function public.get_funnel_board_page(
  p_campaign_id uuid default null,
  p_limit_per_stage integer default 40
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as materialized (
    select
      l.id,
      l.name,
      l.type,
      l.niche,
      l.city,
      l.priority_score,
      l.next_step,
      l.updated_at,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      s.name as source_name,
      coalesce(nullif(trim(rr.name), ''), nullif(trim(l.refusal_reason), '')) as refusal_reason_name
    from public.leads l
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.sources s on s.id = l.source_id
    left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
    where
      p_campaign_id is null
      or exists (
        select 1
        from public.campaign_leads cl
        where cl.campaign_id = p_campaign_id
          and cl.lead_id = l.id
      )
  ),
  ranked as materialized (
    select
      f.*,
      row_number() over (
        partition by f.stage_name
        order by f.updated_at desc nulls last, f.id
      ) as stage_row_number
    from filtered f
  ),
  stage_counts as materialized (
    select
      f.stage_name,
      count(*) as contacts,
      count(*) filter (
        where coalesce(f.priority_score, 0) >= 75
          or f.stage_name = 'Заинтересован'
      ) as hot_contacts,
      count(*) filter (where f.stage_name = 'Тестирует') as ready_contacts
    from filtered f
    group by f.stage_name
  ),
  limited_items as materialized (
    select r.*
    from ranked r
    where r.stage_row_number <= least(greatest(coalesce(p_limit_per_stage, 40), 1), 100)
  ),
  refusal_counts as materialized (
    select
      coalesce(f.refusal_reason_name, 'Причина не указана') as reason,
      count(*) as contacts
    from filtered f
    where f.stage_name = 'Отказ'
    group by coalesce(f.refusal_reason_name, 'Причина не указана')
  )
  select jsonb_build_object(
    'items',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'name', item.name,
            'type', item.type,
            'niche', item.niche,
            'city', item.city,
            'priority_score', item.priority_score,
            'next_step', item.next_step,
            'stage_name', item.stage_name,
            'source_name', item.source_name,
            'refusal_reason_name', item.refusal_reason_name,
            'tags', coalesce((
              select jsonb_agg(tag.name order by tag.name)
              from public.lead_tags lead_tag
              join public.tags tag on tag.id = lead_tag.tag_id
              where lead_tag.lead_id = item.id
            ), '[]'::jsonb)
          )
          order by item.stage_name, item.updated_at desc nulls last, item.id
        )
        from limited_items item
      ), '[]'::jsonb),
    'stage_counts',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'stage_name', stage_count.stage_name,
            'contacts', stage_count.contacts,
            'hot_contacts', stage_count.hot_contacts,
            'ready_contacts', stage_count.ready_contacts
          )
          order by stage_count.stage_name
        )
        from stage_counts stage_count
      ), '[]'::jsonb),
    'summary',
      (
        select jsonb_build_object(
          'total', count(*),
          'replied', count(*) filter (
            where f.stage_name in ('Ответил', 'Заинтересован', 'Тестирует')
          ),
          'hot', count(*) filter (
            where coalesce(f.priority_score, 0) >= 75
              or f.stage_name = 'Заинтересован'
          ),
          'ready', count(*) filter (where f.stage_name = 'Тестирует'),
          'refused', count(*) filter (where f.stage_name = 'Отказ'),
          'need_action', count(*) filter (
            where nullif(trim(coalesce(f.next_step, '')), '') is null
              or trim(f.next_step) = 'Связаться'
          )
        )
        from filtered f
      ),
    'refusal_reasons',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', refusal.reason,
            'value', refusal.contacts
          )
          order by refusal.contacts desc, refusal.reason
        )
        from refusal_counts refusal
      ), '[]'::jsonb)
  );
$$;

create or replace function public.get_funnel_stage_page(
  p_stage_name text,
  p_campaign_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 40
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as materialized (
    select
      l.id,
      l.name,
      l.type,
      l.niche,
      l.city,
      l.priority_score,
      l.next_step,
      l.updated_at,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      s.name as source_name,
      coalesce(nullif(trim(rr.name), ''), nullif(trim(l.refusal_reason), '')) as refusal_reason_name
    from public.leads l
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.sources s on s.id = l.source_id
    left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
    where public.hutka_normalize_stage_name(fs.name) = public.hutka_normalize_stage_name(p_stage_name)
      and (
        p_campaign_id is null
        or exists (
          select 1
          from public.campaign_leads cl
          where cl.campaign_id = p_campaign_id
            and cl.lead_id = l.id
        )
      )
  ),
  page_items as materialized (
    select f.*
    from filtered f
    order by f.updated_at desc nulls last, f.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'name', item.name,
            'type', item.type,
            'niche', item.niche,
            'city', item.city,
            'priority_score', item.priority_score,
            'next_step', item.next_step,
            'stage_name', item.stage_name,
            'source_name', item.source_name,
            'refusal_reason_name', item.refusal_reason_name,
            'tags', coalesce((
              select jsonb_agg(tag.name order by tag.name)
              from public.lead_tags lead_tag
              join public.tags tag on tag.id = lead_tag.tag_id
              where lead_tag.lead_id = item.id
            ), '[]'::jsonb)
          )
          order by item.updated_at desc nulls last, item.id
        )
        from page_items item
      ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_funnel_board_page(uuid, integer) from public;
revoke all on function public.get_funnel_stage_page(text, uuid, integer, integer) from public;
grant execute on function public.get_funnel_board_page(uuid, integer) to authenticated, service_role;
grant execute on function public.get_funnel_stage_page(text, uuid, integer, integer) to authenticated, service_role;

-- Step 49: compact report and refusal aggregates
create or replace function public.get_report_lead_aggregates()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      l.id,
      l.created_at,
      coalesce(nullif(trim(l.niche), ''), 'Не указана') as niche,
      coalesce(nullif(trim(s.name), ''), 'Не указан') as source_name,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      coalesce(l.priority_score, 0) as priority_score
    from public.leads l
    left join public.sources s on s.id = l.source_id
    left join public.funnel_stages fs on fs.id = l.stage_id
  ),
  week_buckets as materialized (
    select
      date_trunc('week', current_date)::date - (series.week_offset * 7) as period_start
    from generate_series(5, 0, -1) as series(week_offset)
  ),
  weekly as materialized (
    select
      bucket.period_start,
      count(base.id) as contacts
    from week_buckets bucket
    left join base
      on base.created_at >= bucket.period_start
      and base.created_at < bucket.period_start + interval '7 days'
    group by bucket.period_start
    order by bucket.period_start
  ),
  stages as materialized (
    select base.stage_name as name, count(*) as contacts
    from base
    group by base.stage_name
  ),
  sources as materialized (
    select base.source_name as name, count(*) as contacts
    from base
    group by base.source_name
    order by contacts desc, name
    limit 5
  ),
  niches as materialized (
    select base.niche as name, count(*) as contacts
    from base
    group by base.niche
    order by contacts desc, name
    limit 5
  ),
  niche_reaction as materialized (
    select
      base.niche as name,
      count(*) as total,
      count(*) filter (
        where base.stage_name in ('Ответил', 'Заинтересован', 'Тестирует')
      ) as reacted
    from base
    group by base.niche
    order by reacted desc, total desc, name
    limit 5
  )
  select jsonb_build_object(
    'summary',
      (
        select jsonb_build_object(
          'total', count(*),
          'new_contacts', count(*) filter (
            where base.created_at >= now() - interval '7 days'
          ),
          'interested', count(*) filter (
            where base.stage_name = 'Заинтересован'
              or base.priority_score >= 75
          ),
          'testing', count(*) filter (where base.stage_name = 'Тестирует')
        )
        from base
      ),
    'weekly',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'period_start', weekly.period_start,
            'value', weekly.contacts
          )
          order by weekly.period_start
        )
        from weekly
      ), '[]'::jsonb),
    'stages',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', stages.name, 'value', stages.contacts)
          order by stages.name
        )
        from stages
      ), '[]'::jsonb),
    'sources',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', sources.name, 'value', sources.contacts)
          order by sources.contacts desc, sources.name
        )
        from sources
      ), '[]'::jsonb),
    'niches',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('name', niches.name, 'value', niches.contacts)
          order by niches.contacts desc, niches.name
        )
        from niches
      ), '[]'::jsonb),
    'niche_reaction',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', niche_reaction.name,
            'total', niche_reaction.total,
            'reacted', niche_reaction.reacted
          )
          order by niche_reaction.reacted desc, niche_reaction.total desc, niche_reaction.name
        )
        from niche_reaction
      ), '[]'::jsonb)
  );
$$;

create or replace function public.get_refusal_analytics()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with refused as materialized (
    select
      l.id,
      l.name,
      l.type,
      l.niche,
      l.city,
      l.refusal_comment,
      coalesce(l.refused_at, l.updated_at, l.created_at) as refused_at,
      coalesce(
        nullif(trim(rr.name), ''),
        nullif(trim(l.refusal_reason), ''),
        'Причина не указана'
      ) as reason,
      coalesce(nullif(trim(rr.color), ''), 'gray') as color
    from public.leads l
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.refusal_reasons rr on rr.id = l.refusal_reason_id
    where l.refusal_reason_id is not null
      or l.refused_at is not null
      or public.hutka_normalize_stage_name(fs.name) = 'Отказ'
  ),
  reason_counts as materialized (
    select refused.reason, refused.color, count(*) as contacts
    from refused
    group by refused.reason, refused.color
  ),
  recent as materialized (
    select refused.*
    from refused
    order by refused.refused_at desc nulls last, refused.id
    limit 8
  )
  select jsonb_build_object(
    'total', (select count(*) from refused),
    'top_reasons',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'reason', reason_counts.reason,
            'count', reason_counts.contacts,
            'color', reason_counts.color
          )
          order by reason_counts.contacts desc, reason_counts.reason
        )
        from reason_counts
      ), '[]'::jsonb),
    'recent',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', recent.id,
            'name', recent.name,
            'type', recent.type,
            'niche', recent.niche,
            'city', recent.city,
            'reason', recent.reason,
            'comment', recent.refusal_comment,
            'refused_at', recent.refused_at
          )
          order by recent.refused_at desc nulls last, recent.id
        )
        from recent
      ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_report_lead_aggregates() from public;
revoke all on function public.get_refusal_analytics() from public;
grant execute on function public.get_report_lead_aggregates() to authenticated, service_role;
grant execute on function public.get_refusal_analytics() to authenticated, service_role;

-- Step 50: paginate grouped survey responses
create index if not exists survey_answers_survey_group_created_idx
  on public.survey_answers(survey_id, response_group_id, created_at desc);

create or replace function public.get_survey_response_page(
  p_survey_id uuid,
  p_offset integer default 0,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with response_groups as materialized (
    select
      coalesce(answer.response_group_id, answer.id) as group_id,
      (array_agg(answer.respondent_name order by answer.created_at desc, answer.id))[1] as respondent_name,
      (array_agg(answer.respondent_contact order by answer.created_at desc, answer.id))[1] as respondent_contact,
      max(answer.created_at) as created_at
    from public.survey_answers answer
    where answer.survey_id = p_survey_id
    group by coalesce(answer.response_group_id, answer.id)
  ),
  page_groups as materialized (
    select response_group.*
    from response_groups response_group
    order by response_group.created_at desc, response_group.group_id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from response_groups),
    'responses',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', page_group.group_id,
            'respondent_name', page_group.respondent_name,
            'respondent_contact', page_group.respondent_contact,
            'created_at', page_group.created_at,
            'answers', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'question', coalesce(question.question_text, 'Вопрос'),
                  'answer', answer.answer
                )
                order by question.order_index, answer.created_at, answer.id
              )
              from public.survey_answers answer
              left join public.survey_questions question on question.id = answer.question_id
              where answer.survey_id = p_survey_id
                and coalesce(answer.response_group_id, answer.id) = page_group.group_id
            ), '[]'::jsonb)
          )
          order by page_group.created_at desc, page_group.group_id
        )
        from page_groups page_group
      ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_survey_response_page(uuid, integer, integer) from public;
grant execute on function public.get_survey_response_page(uuid, integer, integer) to authenticated, service_role;

-- Step 51: exact campaign metrics with paginated campaign contacts
create or replace function public.get_campaign_detail_page(
  p_campaign_id uuid,
  p_offset integer default 0,
  p_limit integer default 40
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with campaign as materialized (
    select
      c.id,
      c.name,
      c.goal,
      c.channel,
      c.city,
      c.niche,
      c.budget,
      c.offer_text,
      c.status,
      c.start_date,
      c.end_date,
      c.result_notes,
      c.created_at
    from public.campaigns c
    where c.id = p_campaign_id
  ),
  contacts as materialized (
    select
      l.id,
      l.name,
      l.type,
      l.niche,
      l.city,
      l.priority_score,
      l.updated_at,
      public.hutka_normalize_stage_name(fs.name) as stage_name,
      s.name as source_name
    from public.campaign_leads cl
    join public.leads l on l.id = cl.lead_id
    left join public.funnel_stages fs on fs.id = l.stage_id
    left join public.sources s on s.id = l.source_id
    where cl.campaign_id = p_campaign_id
  ),
  page_contacts as materialized (
    select contact.*
    from contacts contact
    order by contact.updated_at desc nulls last, contact.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ),
  stage_counts as materialized (
    select contact.stage_name as name, count(*) as contacts
    from contacts contact
    group by contact.stage_name
  )
  select case
    when not exists (select 1 from campaign) then null
    else jsonb_build_object(
      'campaign',
        (select to_jsonb(campaign.*) from campaign),
      'metrics',
        (
          select jsonb_build_object(
            'contacts', count(*),
            'responses', count(*) filter (
              where contact.stage_name in ('Ответил', 'Заинтересован', 'Тестирует')
            ),
            'interested', count(*) filter (
              where contact.stage_name in ('Заинтересован', 'Тестирует')
            ),
            'testing', count(*) filter (where contact.stage_name = 'Тестирует'),
            'refused', count(*) filter (where contact.stage_name = 'Отказ')
          )
          from contacts contact
        ),
      'stage_counts',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'name', stage_count.name,
              'value', stage_count.contacts
            )
            order by stage_count.name
          )
          from stage_counts stage_count
        ), '[]'::jsonb),
      'contacts',
        coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', contact.id,
              'name', contact.name,
              'type', contact.type,
              'niche', contact.niche,
              'city', contact.city,
              'priority_score', contact.priority_score,
              'stage_name', contact.stage_name,
              'source_name', contact.source_name
            )
            order by contact.updated_at desc nulls last, contact.id
          )
          from page_contacts contact
        ), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.get_campaign_detail_page(uuid, integer, integer) from public;
grant execute on function public.get_campaign_detail_page(uuid, integer, integer) to authenticated, service_role;

-- Step 52: compact questionnaire summaries and bounded response previews per contact
create or replace function public.get_lead_questionnaire_summaries(p_lead_id uuid)
returns table (
  id uuid,
  lead_id uuid,
  title text,
  description text,
  status text,
  token text,
  created_at timestamptz,
  questions_count bigint,
  responses_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    questionnaire.id,
    questionnaire.lead_id,
    questionnaire.title,
    questionnaire.description,
    questionnaire.status,
    questionnaire.token,
    questionnaire.created_at,
    coalesce(question_count.total, 0) as questions_count,
    coalesce(response_count.total, 0) as responses_count
  from public.lead_questionnaires questionnaire
  left join lateral (
    select count(*) as total
    from public.lead_questionnaire_questions question
    where question.questionnaire_id = questionnaire.id
  ) question_count on true
  left join lateral (
    select count(distinct coalesce(answer.response_group_id, answer.id)) as total
    from public.lead_questionnaire_answers answer
    where answer.questionnaire_id = questionnaire.id
  ) response_count on true
  where questionnaire.lead_id = p_lead_id
  order by questionnaire.created_at desc
  limit 50;
$$;

create or replace function public.get_lead_questionnaire_response_preview(
  p_lead_id uuid,
  p_limit_groups integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with response_groups as materialized (
    select
      answer.questionnaire_id,
      coalesce(answer.response_group_id, answer.id) as group_id,
      (array_agg(answer.respondent_name order by answer.created_at desc, answer.id))[1] as respondent_name,
      (array_agg(answer.respondent_contact order by answer.created_at desc, answer.id))[1] as respondent_contact,
      max(answer.created_at) as created_at,
      questionnaire.title as questionnaire_title,
      questionnaire.token as questionnaire_token
    from public.lead_questionnaire_answers answer
    join public.lead_questionnaires questionnaire on questionnaire.id = answer.questionnaire_id
    where answer.lead_id = p_lead_id
    group by
      answer.questionnaire_id,
      coalesce(answer.response_group_id, answer.id),
      questionnaire.title,
      questionnaire.token
  ),
  preview_groups as materialized (
    select response_group.*
    from response_groups response_group
    order by response_group.created_at desc, response_group.group_id
    limit least(greatest(coalesce(p_limit_groups, 20), 1), 50)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', preview_group.group_id,
        'questionnaire_id', preview_group.questionnaire_id,
        'questionnaire_title', preview_group.questionnaire_title,
        'questionnaire_token', preview_group.questionnaire_token,
        'respondent_name', preview_group.respondent_name,
        'respondent_contact', preview_group.respondent_contact,
        'created_at', preview_group.created_at,
        'answers', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'question', coalesce(question.question_text, 'Вопрос'),
              'answer', answer.answer
            )
            order by question.order_index, answer.created_at, answer.id
          )
          from public.lead_questionnaire_answers answer
          left join public.lead_questionnaire_questions question on question.id = answer.question_id
          where answer.questionnaire_id = preview_group.questionnaire_id
            and coalesce(answer.response_group_id, answer.id) = preview_group.group_id
        ), '[]'::jsonb)
      )
      order by preview_group.created_at desc, preview_group.group_id
    ),
    '[]'::jsonb
  )
  from preview_groups preview_group;
$$;

revoke all on function public.get_lead_questionnaire_summaries(uuid) from public;
revoke all on function public.get_lead_questionnaire_response_preview(uuid, integer) from public;
grant execute on function public.get_lead_questionnaire_summaries(uuid) to authenticated, service_role;
grant execute on function public.get_lead_questionnaire_response_preview(uuid, integer) to authenticated, service_role;

-- Step 53: detect contact duplicates inside PostgreSQL
create or replace function public.get_contact_duplicate_groups()
returns table (
  field text,
  value text,
  contacts bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with contact_values as (
    select 'email'::text as field, lower(trim(lead.email)) as value
    from public.leads lead
    where nullif(trim(lead.email), '') is not null
    union all
    select 'phone'::text, lower(trim(lead.phone))
    from public.leads lead
    where nullif(trim(lead.phone), '') is not null
    union all
    select 'instagram'::text, lower(trim(lead.instagram))
    from public.leads lead
    where nullif(trim(lead.instagram), '') is not null
    union all
    select 'telegram'::text, lower(trim(lead.telegram))
    from public.leads lead
    where nullif(trim(lead.telegram), '') is not null
  )
  select
    contact_value.field,
    contact_value.value,
    count(*) as contacts
  from contact_values contact_value
  group by contact_value.field, contact_value.value
  having count(*) > 1
  order by contacts desc, contact_value.field, contact_value.value
  limit 20;
$$;

revoke all on function public.get_contact_duplicate_groups() from public;
grant execute on function public.get_contact_duplicate_groups() to authenticated, service_role;

-- Step 54: atomic workspace cleanup without deleting auth users or profiles.
create or replace function public.reset_workspace_data(
  p_mode text default 'work',
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_mode text := lower(trim(coalesce(p_mode, 'work')));
  workspace_tables text[] := array[
    'public.telegram_delivery_logs',
    'public.notification_reads',
    'public.saved_lead_views',
    'public.import_logs',
    'public.lead_questionnaire_answers',
    'public.lead_questionnaire_questions',
    'public.lead_questionnaires',
    'public.survey_answers',
    'public.survey_questions',
    'public.hypothesis_leads',
    'public.hypothesis_insights',
    'public.hypothesis_campaigns',
    'public.hypothesis_surveys',
    'public.insight_leads',
    'public.insight_campaigns',
    'public.insight_surveys',
    'public.campaign_leads',
    'public.lead_tags',
    'public.lead_interactions',
    'public.task_assignees',
    'public.tasks',
    'public.hypotheses',
    'public.insights',
    'public.campaigns',
    'public.surveys',
    'public.leads'
  ];
  directory_tables text[] := array[
    'public.question_pack_questions',
    'public.question_packs',
    'public.message_templates',
    'public.refusal_reasons',
    'public.tags',
    'public.sources',
    'public.funnel_stages'
  ];
  target_tables text[];
  table_name text;
  deleted_count bigint;
  deleted_counts jsonb := '{}'::jsonb;
begin
  if normalized_mode not in ('work', 'full') then
    raise exception 'Unsupported cleanup mode: %', normalized_mode
      using errcode = '22023';
  end if;

  target_tables := workspace_tables;
  if normalized_mode = 'full' then
    target_tables := target_tables || directory_tables;
  end if;

  foreach table_name in array target_tables loop
    if to_regclass(table_name) is null then
      continue;
    end if;

    execute format(
      'delete from %I.%I',
      split_part(table_name, '.', 1),
      split_part(table_name, '.', 2)
    );
    get diagnostics deleted_count = row_count;
    deleted_counts := deleted_counts || jsonb_build_object(
      split_part(table_name, '.', 2),
      deleted_count
    );
  end loop;

  if to_regclass('public.activity_logs') is not null then
    insert into public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_title,
      details
    )
    values (
      p_user_id,
      'очистил базу',
      'settings',
      'Очистка базы',
      jsonb_build_object(
        'mode',
        normalized_mode,
        'deleted',
        deleted_counts
      )
    );
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'mode',
    normalized_mode,
    'deleted',
    deleted_counts
  );
end;
$$;

revoke all on function public.reset_workspace_data(text, uuid) from public;
revoke all on function public.reset_workspace_data(text, uuid) from anon;
revoke all on function public.reset_workspace_data(text, uuid) from authenticated;
grant execute on function public.reset_workspace_data(text, uuid) to service_role;

-- Step 55: merge duplicate sources atomically inside PostgreSQL.
create or replace function public.merge_duplicate_sources(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_group record;
  keeper_id uuid;
  duplicate_ids uuid[];
  merged_count integer := 0;
  reassigned_count integer := 0;
  affected_count integer := 0;
  actor_id uuid;
begin
  select id
  into actor_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  actor_id := coalesce(actor_id, p_user_id);

  for source_group in
    select
      public.normalize_source_name(name) as normalized_name,
      array_agg(id order by created_at asc, id asc) as source_ids
    from public.sources
    where public.normalize_source_name(name) <> ''
    group by public.normalize_source_name(name)
    having count(*) > 1
  loop
    keeper_id := source_group.source_ids[1];
    duplicate_ids := source_group.source_ids[2:array_length(source_group.source_ids, 1)];

    update public.leads
    set source_id = keeper_id
    where source_id = any(duplicate_ids);
    get diagnostics affected_count = row_count;
    reassigned_count := reassigned_count + affected_count;

    delete from public.sources
    where id = any(duplicate_ids);
    get diagnostics affected_count = row_count;
    merged_count := merged_count + affected_count;

    update public.sources
    set name = source_group.normalized_name
    where id = keeper_id;
  end loop;

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_title,
    details
  )
  values (
    actor_id,
    'объединил источники',
    'source',
    'Источники',
    jsonb_build_object(
      'merged',
      merged_count,
      'reassigned_contacts',
      reassigned_count
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'merged',
    merged_count,
    'reassigned_contacts',
    reassigned_count
  );
end;
$$;

revoke all on function public.merge_duplicate_sources(uuid) from public;
revoke all on function public.merge_duplicate_sources(uuid) from anon;
grant execute on function public.merge_duplicate_sources(uuid) to authenticated, service_role;

-- Step 56: save a contact, its directories, tags, history, and activity log
-- in one RLS-aware transaction.
create index if not exists leads_email_normalized_idx
  on public.leads(lower(trim(email)))
  where nullif(trim(email), '') is not null;
create index if not exists leads_phone_normalized_idx
  on public.leads(trim(phone))
  where nullif(trim(phone), '') is not null;
create index if not exists leads_instagram_normalized_idx
  on public.leads(lower(trim(instagram)))
  where nullif(trim(instagram), '') is not null;
create index if not exists leads_telegram_normalized_idx
  on public.leads(lower(trim(telegram)))
  where nullif(trim(telegram), '') is not null;
create index if not exists sources_name_casefold_idx
  on public.sources(lower(public.normalize_source_name(name)));
create index if not exists funnel_stages_name_casefold_idx
  on public.funnel_stages(lower(trim(name)));
create index if not exists tags_name_casefold_idx
  on public.tags(lower(trim(name)));

create or replace function public.save_lead_with_tags(
  p_lead_id uuid,
  p_name text,
  p_type text,
  p_niche text,
  p_city text,
  p_phone text,
  p_telegram text,
  p_instagram text,
  p_email text,
  p_source_name text,
  p_stage_name text,
  p_stage_order integer,
  p_stage_color text,
  p_priority_score integer,
  p_notes text,
  p_next_step text,
  p_next_contact_date timestamptz,
  p_tags text[],
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_type text := lower(trim(coalesce(p_type, '')));
  normalized_source_name text;
  normalized_stage_name text := coalesce(nullif(trim(p_stage_name), ''), 'Новый');
  saved_lead_id uuid;
  resolved_source_id uuid;
  resolved_stage_id uuid;
  resolved_tag_id uuid;
  tag_name text;
  duplicate_id uuid;
  duplicate_name text;
  actor_id uuid;
  is_created boolean := p_lead_id is null;
begin
  if normalized_name = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-name');
  end if;

  if normalized_type not in ('master', 'salon', 'client', 'partner') then
    return jsonb_build_object('ok', false, 'error', 'invalid-type');
  end if;

  if coalesce(p_priority_score, 0) < 0 or coalesce(p_priority_score, 0) > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid-priority');
  end if;

  if p_lead_id is not null and not exists (
    select 1
    from public.leads lead
    where lead.id = p_lead_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select lead.id, lead.name
  into duplicate_id, duplicate_name
  from public.leads lead
  where (p_lead_id is null or lead.id <> p_lead_id)
    and (
      (
        nullif(trim(p_email), '') is not null
        and lower(trim(lead.email)) = lower(trim(p_email))
      )
      or (
        nullif(trim(p_phone), '') is not null
        and trim(lead.phone) = trim(p_phone)
      )
      or (
        nullif(trim(p_instagram), '') is not null
        and lower(trim(lead.instagram)) = lower(trim(p_instagram))
      )
      or (
        nullif(trim(p_telegram), '') is not null
        and lower(trim(lead.telegram)) = lower(trim(p_telegram))
      )
    )
  order by lead.created_at asc, lead.id asc
  limit 1;

  if duplicate_id is not null then
    return jsonb_build_object(
      'ok',
      false,
      'error',
      'duplicate-contact',
      'duplicate_id',
      duplicate_id,
      'duplicate_name',
      duplicate_name
    );
  end if;

  normalized_source_name := public.normalize_source_name(
    coalesce(nullif(trim(p_source_name), ''), 'Не указан')
  );
  if normalized_source_name = '' then
    normalized_source_name := 'Не указан';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('source:' || lower(normalized_source_name), 0)
  );

  select source.id
  into resolved_source_id
  from public.sources source
  where lower(public.normalize_source_name(source.name)) = lower(normalized_source_name)
  order by source.created_at asc, source.id asc
  limit 1;

  if resolved_source_id is null then
    begin
      insert into public.sources (name, type)
      values (normalized_source_name, 'manual')
      returning id into resolved_source_id;
    exception
      when unique_violation then
        select source.id
        into resolved_source_id
        from public.sources source
        where lower(public.normalize_source_name(source.name)) = lower(normalized_source_name)
        order by source.created_at asc, source.id asc
        limit 1;
    end;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('stage:' || lower(normalized_stage_name), 0)
  );

  select stage.id
  into resolved_stage_id
  from public.funnel_stages stage
  where lower(trim(stage.name)) = lower(normalized_stage_name)
  order by stage.created_at asc, stage.id asc
  limit 1;

  if resolved_stage_id is null then
    insert into public.funnel_stages (name, type, order_index, color)
    values (
      normalized_stage_name,
      'master',
      coalesce(p_stage_order, 0),
      coalesce(nullif(trim(p_stage_color), ''), 'purple')
    )
    returning id into resolved_stage_id;
  end if;

  if is_created then
    insert into public.leads (
      name,
      type,
      niche,
      city,
      phone,
      telegram,
      instagram,
      email,
      source_id,
      stage_id,
      priority_score,
      notes,
      next_step,
      next_contact_date
    )
    values (
      normalized_name,
      normalized_type,
      nullif(trim(p_niche), ''),
      nullif(trim(p_city), ''),
      nullif(trim(p_phone), ''),
      nullif(trim(p_telegram), ''),
      nullif(trim(p_instagram), ''),
      nullif(trim(p_email), ''),
      resolved_source_id,
      resolved_stage_id,
      coalesce(p_priority_score, 0),
      nullif(trim(p_notes), ''),
      nullif(trim(p_next_step), ''),
      p_next_contact_date
    )
    returning id into saved_lead_id;
  else
    update public.leads
    set
      name = normalized_name,
      type = normalized_type,
      niche = nullif(trim(p_niche), ''),
      city = nullif(trim(p_city), ''),
      phone = nullif(trim(p_phone), ''),
      telegram = nullif(trim(p_telegram), ''),
      instagram = nullif(trim(p_instagram), ''),
      email = nullif(trim(p_email), ''),
      source_id = resolved_source_id,
      stage_id = resolved_stage_id,
      priority_score = coalesce(p_priority_score, 0),
      notes = nullif(trim(p_notes), ''),
      next_step = nullif(trim(p_next_step), ''),
      next_contact_date = p_next_contact_date,
      updated_at = now()
    where id = p_lead_id
    returning id into saved_lead_id;

    if saved_lead_id is null then
      return jsonb_build_object('ok', false, 'error', 'contact-not-found');
    end if;
  end if;

  delete from public.lead_tags
  where lead_id = saved_lead_id;

  for tag_name in
    select min(trim(input_tag))
    from unnest(coalesce(p_tags, array[]::text[])) as input_tag
    where nullif(trim(input_tag), '') is not null
    group by lower(trim(input_tag))
  loop
    resolved_tag_id := null;

    perform pg_advisory_xact_lock(
      hashtextextended('tag:' || lower(tag_name), 0)
    );

    select tag.id
    into resolved_tag_id
    from public.tags tag
    where lower(trim(tag.name)) = lower(tag_name)
    order by tag.created_at asc, tag.id asc
    limit 1;

    if resolved_tag_id is null then
      begin
        insert into public.tags (name, color)
        values (tag_name, 'purple')
        returning id into resolved_tag_id;
      exception
        when unique_violation then
          select tag.id
          into resolved_tag_id
          from public.tags tag
          where tag.name = tag_name
          limit 1;
      end;
    end if;

    if resolved_tag_id is not null then
      insert into public.lead_tags (lead_id, tag_id)
      values (saved_lead_id, resolved_tag_id)
      on conflict do nothing;
    end if;
  end loop;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  insert into public.lead_interactions (
    lead_id,
    type,
    channel,
    text,
    result,
    created_by
  )
  values (
    saved_lead_id,
    case when is_created then 'note' else 'status_change' end,
    case when is_created then normalized_source_name else 'Hutka' end,
    case
      when is_created then 'Контакт добавлен в Hutka'
      else format('Контакт обновлен. Стадия: %s', normalized_stage_name)
    end,
    case when is_created then 'created' else 'updated' end,
    actor_id
  );

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    details
  )
  values (
    actor_id,
    case when is_created then 'создал контакт' else 'изменил контакт' end,
    'contact',
    saved_lead_id,
    normalized_name,
    jsonb_build_object(
      'source',
      normalized_source_name,
      'stage',
      normalized_stage_name,
      'next_step',
      nullif(trim(p_next_step), ''),
      'next_contact_date',
      p_next_contact_date
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'lead_id',
    saved_lead_id,
    'created',
    is_created
  );
end;
$$;

revoke all on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) from public;
revoke all on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) from anon;
grant execute on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) to authenticated, service_role;

-- Step 57: create a task, assignees, contact history, and activity log
-- in one RLS-aware transaction.
create or replace function public.create_task_with_assignees(
  p_title text,
  p_lead_id uuid,
  p_description text,
  p_due_date timestamptz,
  p_priority text,
  p_assignee_profile_ids uuid[],
  p_assignee_roles text[],
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_priority text := lower(trim(coalesce(p_priority, 'none')));
  normalized_profile_ids uuid[] := coalesce(p_assignee_profile_ids, array[]::uuid[]);
  normalized_roles text[] := coalesce(p_assignee_roles, array[]::text[]);
  saved_task_id uuid;
  lead_name text;
  actor_id uuid;
begin
  if normalized_title = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-task-title');
  end if;

  if normalized_priority not in ('none', 'low', 'medium', 'high', 'urgent') then
    return jsonb_build_object('ok', false, 'error', 'invalid-priority');
  end if;

  if cardinality(normalized_profile_ids) <> cardinality(normalized_roles) then
    return jsonb_build_object('ok', false, 'error', 'invalid-assignees');
  end if;

  if cardinality(normalized_profile_ids) <> (
    select count(distinct assignment.profile_id)
    from unnest(normalized_profile_ids) as assignment(profile_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid-assignees');
  end if;

  if p_lead_id is not null then
    select lead.name
    into lead_name
    from public.leads lead
    where lead.id = p_lead_id;

    if lead_name is null then
      return jsonb_build_object('ok', false, 'error', 'lead-not-found');
    end if;
  end if;

  if exists (
    select 1
    from unnest(normalized_profile_ids, normalized_roles)
      as assignment(profile_id, assignee_role)
    left join public.profiles profile
      on profile.id = assignment.profile_id
    where profile.id is null
      or assignment.assignee_role is null
      or assignment.assignee_role not in ('responsible', 'executor', 'co_executor')
  ) then
    return jsonb_build_object('ok', false, 'error', 'task-assignee-not-found');
  end if;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  insert into public.tasks (
    title,
    lead_id,
    description,
    due_date,
    priority,
    status,
    created_by
  )
  values (
    normalized_title,
    p_lead_id,
    nullif(trim(p_description), ''),
    p_due_date,
    normalized_priority,
    'todo',
    actor_id
  )
  returning id into saved_task_id;

  if cardinality(normalized_profile_ids) > 0 then
    insert into public.task_assignees (task_id, profile_id, role)
    select
      saved_task_id,
      assignment.profile_id,
      assignment.assignee_role
    from unnest(normalized_profile_ids, normalized_roles)
      as assignment(profile_id, assignee_role);
  end if;

  if p_lead_id is not null then
    insert into public.lead_interactions (
      lead_id,
      type,
      channel,
      text,
      result,
      created_by
    )
    values (
      p_lead_id,
      'note',
      'Hutka',
      format('Создана задача: %s', normalized_title),
      'task_created',
      actor_id
    );
  end if;

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    details
  )
  values (
    actor_id,
    'создал задачу',
    'task',
    saved_task_id,
    normalized_title,
    jsonb_build_object(
      'lead_id',
      p_lead_id,
      'due_date',
      p_due_date,
      'priority',
      normalized_priority,
      'assignees',
      cardinality(normalized_profile_ids)
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'task_id',
    saved_task_id,
    'lead_name',
    lead_name
  );
end;
$$;

revoke all on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) from public;
revoke all on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) from anon;
grant execute on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) to authenticated, service_role;

-- Step 58: schedule a contact action and its task atomically.
create or replace function public.schedule_lead_action(
  p_lead_id uuid,
  p_next_step text,
  p_next_contact_date timestamptz,
  p_comment text,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_next_step text := trim(coalesce(p_next_step, ''));
  lead_name text;
  open_task_id uuid;
  saved_task_id uuid;
  actor_id uuid;
  is_created boolean := false;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  if normalized_next_step = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-next-action');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('lead-action:' || p_lead_id::text, 0)
  );

  select lead.name
  into lead_name
  from public.leads lead
  where lead.id = p_lead_id;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select task.id
  into open_task_id
  from public.tasks task
  where task.lead_id = p_lead_id
    and task.status in ('todo', 'in_progress')
  order by task.created_at desc, task.id desc
  limit 1
  for update;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  update public.leads
  set
    next_step = normalized_next_step,
    next_contact_date = p_next_contact_date,
    updated_at = now()
  where id = p_lead_id;

  if open_task_id is not null then
    update public.tasks
    set
      title = normalized_next_step,
      description = nullif(trim(p_comment), ''),
      due_date = p_next_contact_date,
      updated_at = now()
    where id = open_task_id
    returning id into saved_task_id;
  else
    insert into public.tasks (
      lead_id,
      title,
      description,
      due_date,
      priority,
      status,
      created_by
    )
    values (
      p_lead_id,
      normalized_next_step,
      nullif(trim(p_comment), ''),
      p_next_contact_date,
      'none',
      'todo',
      actor_id
    )
    returning id into saved_task_id;

    is_created := true;
  end if;

  insert into public.lead_interactions (
    lead_id,
    type,
    channel,
    text,
    result,
    created_by
  )
  values (
    p_lead_id,
    'note',
    'Hutka',
    format(
      'Запланировано действие: %s%s%s',
      normalized_next_step,
      case
        when p_next_contact_date is null then ''
        else format(' · дата %s', p_next_contact_date)
      end,
      case
        when nullif(trim(p_comment), '') is null then ''
        else format(' · %s', trim(p_comment))
      end
    ),
    'next_action_planned',
    actor_id
  );

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    details
  )
  values (
    actor_id,
    case when is_created then 'создал задачу' else 'изменил задачу' end,
    'task',
    saved_task_id,
    normalized_next_step,
    jsonb_build_object(
      'contact_id',
      p_lead_id,
      'contact',
      lead_name,
      'due_date',
      p_next_contact_date,
      'from_next_action',
      true
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'task_id',
    saved_task_id,
    'created',
    is_created
  );
end;
$$;

revoke all on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) from public;
revoke all on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) from anon;
grant execute on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) to authenticated, service_role;

-- Step 59: move a contact between funnel stages atomically.
create or replace function public.move_lead_to_stage(
  p_lead_id uuid,
  p_stage_id uuid,
  p_stage_name text,
  p_refusal_reason text,
  p_campaign_id text,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_stage_name text := public.hutka_normalize_stage_name(p_stage_name);
  normalized_refusal_reason text := nullif(trim(p_refusal_reason), '');
  resolved_stage_id uuid;
  lead_name text;
  actor_id uuid;
  stage_order integer;
  stage_color text;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('funnel-lead:' || p_lead_id::text, 0)
  );

  if p_stage_id is not null then
    select
      stage.id,
      public.hutka_normalize_stage_name(stage.name)
    into resolved_stage_id, normalized_stage_name
    from public.funnel_stages stage
    where stage.id = p_stage_id;
  end if;

  if resolved_stage_id is null then
    if nullif(trim(p_stage_name), '') is null then
      return jsonb_build_object('ok', false, 'error', 'stage-not-found');
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('funnel-stage:' || lower(normalized_stage_name), 0)
    );

    select stage.id
    into resolved_stage_id
    from public.funnel_stages stage
    where public.hutka_normalize_stage_name(stage.name) = normalized_stage_name
    order by stage.order_index asc, stage.created_at asc, stage.id asc
    limit 1;

    if resolved_stage_id is null then
      stage_order := case normalized_stage_name
        when 'Новый' then 1
        when 'Написали' then 2
        when 'Ответил' then 3
        when 'Заинтересован' then 4
        when 'Тестирует' then 5
        when 'Пауза' then 6
        when 'Отказ' then 7
        else 99
      end;
      stage_color := case normalized_stage_name
        when 'Новый' then 'gray'
        when 'Написали' then 'purple'
        when 'Ответил' then 'blue'
        when 'Заинтересован' then 'yellow'
        when 'Тестирует' then 'green'
        when 'Пауза' then 'gray'
        when 'Отказ' then 'red'
        else 'gray'
      end;

      insert into public.funnel_stages (name, type, order_index, color)
      values (normalized_stage_name, 'master', stage_order, stage_color)
      returning id into resolved_stage_id;
    end if;
  end if;

  if normalized_stage_name = 'Отказ' and normalized_refusal_reason is null then
    return jsonb_build_object('ok', false, 'error', 'refusal-required');
  end if;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  update public.leads
  set
    stage_id = resolved_stage_id,
    refusal_reason_id = null,
    refusal_reason = case when normalized_stage_name = 'Отказ' then normalized_refusal_reason else null end,
    refusal_comment = case when normalized_stage_name = 'Отказ' then normalized_refusal_reason else null end,
    refused_at = case when normalized_stage_name = 'Отказ' then now() else null end,
    updated_at = now()
  where id = p_lead_id
  returning name into lead_name;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'lead-not-found');
  end if;

  insert into public.lead_interactions (
    lead_id,
    type,
    channel,
    text,
    result,
    created_by
  )
  values (
    p_lead_id,
    'status_change',
    'Hutka',
    case
      when normalized_stage_name = 'Отказ'
        then format('Контакт перемещен в отказ. Причина: %s', normalized_refusal_reason)
      when normalized_stage_name = 'Тестирует'
        then 'Важное событие: контакт начал тестирование.'
      else format('Контакт перемещен в стадию: %s', normalized_stage_name)
    end,
    'stage_updated',
    actor_id
  );

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    details
  )
  values (
    actor_id,
    'перетащил контакт в воронке',
    'contact',
    p_lead_id,
    lead_name,
    jsonb_build_object(
      'stage',
      normalized_stage_name,
      'campaign_id',
      nullif(trim(p_campaign_id), ''),
      'refusal_reason',
      normalized_refusal_reason
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'lead_id',
    p_lead_id,
    'stage_id',
    resolved_stage_id,
    'stage_name',
    normalized_stage_name
  );
end;
$$;

revoke all on function public.move_lead_to_stage(
  uuid, uuid, text, text, text, uuid
) from public;
revoke all on function public.move_lead_to_stage(
  uuid, uuid, text, text, text, uuid
) from anon;
grant execute on function public.move_lead_to_stage(
  uuid, uuid, text, text, text, uuid
) to authenticated, service_role;

-- Step 60: create personal contact questions atomically.
create or replace function public.create_lead_questionnaire_with_questions(
  p_lead_id uuid,
  p_title text,
  p_description text,
  p_token text,
  p_public_url text,
  p_source text,
  p_source_title text,
  p_questions jsonb,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  lead_name text;
  normalized_title text;
  normalized_token text := trim(coalesce(p_token, ''));
  normalized_public_url text := coalesce(
    nullif(trim(p_public_url), ''),
    '/q/' || trim(coalesce(p_token, ''))
  );
  normalized_source text := lower(trim(coalesce(p_source, 'manual')));
  normalized_questions jsonb := coalesce(p_questions, '[]'::jsonb);
  questionnaire_id uuid;
  questionnaire_created_at timestamptz;
  actor_id uuid;
  questions_count integer;
  interaction_text text;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-contact');
  end if;

  if normalized_token = '' then
    return jsonb_build_object('ok', false, 'error', 'questionnaire-token-required');
  end if;

  if jsonb_typeof(normalized_questions) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'questions-required');
  end if;

  select count(*)
  into questions_count
  from jsonb_array_elements(normalized_questions) question
  where nullif(trim(question ->> 'text'), '') is not null;

  if questions_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'questions-required');
  end if;

  select lead.name
  into lead_name
  from public.leads lead
  where lead.id = p_lead_id;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  normalized_title := coalesce(
    nullif(trim(p_title), ''),
    format('Вопросы для %s', lead_name)
  );

  insert into public.lead_questionnaires (
    lead_id,
    title,
    description,
    status,
    token,
    created_by
  )
  values (
    p_lead_id,
    normalized_title,
    nullif(trim(p_description), ''),
    'active',
    normalized_token,
    actor_id
  )
  returning id, created_at
  into questionnaire_id, questionnaire_created_at;

  insert into public.lead_questionnaire_questions (
    questionnaire_id,
    question_text,
    question_type,
    options,
    required,
    order_index
  )
  select
    questionnaire_id,
    trim(question.value ->> 'text'),
    coalesce(nullif(trim(question.value ->> 'type'), ''), 'short_text'),
    case
      when jsonb_typeof(question.value -> 'options') = 'array'
        then question.value -> 'options'
      else '[]'::jsonb
    end,
    coalesce((question.value ->> 'required')::boolean, false),
    question.ordinality::integer
  from jsonb_array_elements(normalized_questions)
    with ordinality as question(value, ordinality)
  where nullif(trim(question.value ->> 'text'), '') is not null;

  interaction_text := case
    when normalized_source = 'question_pack'
      then format(
        'Созданы вопросы для контакта из готового набора «%s»: %s',
        coalesce(nullif(trim(p_source_title), ''), normalized_title),
        normalized_public_url
      )
    else format(
      'Созданы вопросы для контакта «%s»: %s',
      normalized_title,
      normalized_public_url
    )
  end;

  insert into public.lead_interactions (
    lead_id,
    type,
    channel,
    text,
    result,
    created_by
  )
  values (
    p_lead_id,
    'survey_sent',
    'Hutka',
    interaction_text,
    case
      when normalized_source = 'question_pack' then 'lead_questionnaire_pack_created'
      else 'lead_questionnaire_created'
    end,
    actor_id
  );

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    details
  )
  values (
    actor_id,
    'создал анкету',
    'lead_questionnaire',
    questionnaire_id,
    normalized_title,
    jsonb_build_object(
      'lead_id',
      p_lead_id,
      'source',
      normalized_source,
      'questions',
      questions_count
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'questionnaire_id',
    questionnaire_id,
    'lead_id',
    p_lead_id,
    'lead_name',
    lead_name,
    'title',
    normalized_title,
    'description',
    nullif(trim(p_description), ''),
    'status',
    'active',
    'token',
    normalized_token,
    'questions_count',
    questions_count,
    'created_at',
    questionnaire_created_at
  );
end;
$$;

revoke all on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) from public;
revoke all on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) from anon;
grant execute on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) to authenticated, service_role;

-- Step 61: set or clear a contact refusal atomically.
create or replace function public.update_lead_refusal(
  p_lead_id uuid,
  p_mode text,
  p_reason_id uuid,
  p_reason text,
  p_comment text,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_mode text := lower(trim(coalesce(p_mode, 'mark')));
  normalized_reason text := nullif(trim(p_reason), '');
  normalized_comment text := nullif(trim(p_comment), '');
  resolved_reason_id uuid;
  selected_reason text;
  refusal_stage_id uuid;
  lead_name text;
  actor_id uuid;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  if normalized_mode not in ('mark', 'clear') then
    return jsonb_build_object('ok', false, 'error', 'refusal-save-failed');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('lead-refusal:' || p_lead_id::text, 0)
  );

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  if normalized_mode = 'mark' then
    if p_reason_id is not null then
      select reason.id, reason.name
      into resolved_reason_id, selected_reason
      from public.refusal_reasons reason
      where reason.id = p_reason_id;

      if selected_reason is not null then
        normalized_reason := selected_reason;
      else
        resolved_reason_id := null;
      end if;
    end if;

    if normalized_reason is null then
      return jsonb_build_object('ok', false, 'error', 'missing-refusal-reason');
    end if;

    perform pg_advisory_xact_lock(hashtextextended('funnel-stage:Отказ', 0));

    select stage.id
    into refusal_stage_id
    from public.funnel_stages stage
    where public.hutka_normalize_stage_name(stage.name) = 'Отказ'
    order by stage.order_index asc, stage.created_at asc, stage.id asc
    limit 1;

    if refusal_stage_id is null then
      insert into public.funnel_stages (name, type, order_index, color)
      values ('Отказ', 'master', 7, 'red')
      returning id into refusal_stage_id;
    end if;

    update public.leads
    set
      stage_id = refusal_stage_id,
      refusal_reason_id = resolved_reason_id,
      refusal_reason = normalized_reason,
      refusal_comment = normalized_comment,
      refused_at = now(),
      updated_at = now()
    where id = p_lead_id
    returning name into lead_name;

    if lead_name is null then
      return jsonb_build_object('ok', false, 'error', 'contact-not-found');
    end if;

    insert into public.lead_interactions (
      lead_id, type, channel, text, result, created_by
    )
    values (
      p_lead_id,
      'status_change',
      'Hutka',
      format(
        'Контакт переведен в отказ. Причина: %s%s',
        normalized_reason,
        case when normalized_comment is null then '' else format('. Комментарий: %s', normalized_comment) end
      ),
      'refused',
      actor_id
    );

    insert into public.activity_logs (
      user_id, action, entity_type, entity_id, entity_title, details
    )
    values (
      actor_id,
      'зафиксировал отказ',
      'contact',
      p_lead_id,
      lead_name,
      jsonb_build_object('reason', normalized_reason, 'comment', normalized_comment)
    );

    return jsonb_build_object(
      'ok', true,
      'reason', normalized_reason,
      'comment', normalized_comment,
      'refused_at', now()
    );
  end if;

  update public.leads
  set
    refusal_reason_id = null,
    refusal_reason = null,
    refusal_comment = null,
    refused_at = null,
    updated_at = now()
  where id = p_lead_id
  returning name into lead_name;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  insert into public.lead_interactions (
    lead_id, type, channel, text, result, created_by
  )
  values (
    p_lead_id,
    'note',
    'Hutka',
    'Причина отказа очищена из карточки контакта.',
    'refusal_cleared',
    actor_id
  );

  insert into public.activity_logs (
    user_id, action, entity_type, entity_id, entity_title, details
  )
  values (
    actor_id,
    'очистил причину отказа',
    'contact',
    p_lead_id,
    lead_name,
    '{}'::jsonb
  );

  return jsonb_build_object('ok', true, 'cleared', true);
end;
$$;

revoke all on function public.update_lead_refusal(
  uuid, text, uuid, text, text, uuid
) from public;
revoke all on function public.update_lead_refusal(
  uuid, text, uuid, text, text, uuid
) from anon;
grant execute on function public.update_lead_refusal(
  uuid, text, uuid, text, text, uuid
) to authenticated, service_role;

-- Step 62: survey builder. The transactional writer lives in
-- supabase/step62-survey-builder.sql for existing workspaces.
alter table public.surveys add column if not exists survey_key text;
alter table public.surveys add column if not exists schema_version text not null default '1.0';
alter table public.surveys add column if not exists version integer not null default 1;
alter table public.surveys add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists start_screen jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists completion_screen jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists updated_at timestamptz not null default now();
alter table public.surveys add column if not exists published_at timestamptz;

create table if not exists public.survey_sections (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  visibility jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, key)
);

alter table public.survey_questions add column if not exists key text;
alter table public.survey_questions add column if not exists section_id uuid references public.survey_sections(id) on delete set null;
alter table public.survey_questions add column if not exists description text;
alter table public.survey_questions add column if not exists visibility jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists options_source jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists validation jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists contact_mapping jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.survey_classification_rules (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  key text not null,
  title text not null,
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, key)
);

create table if not exists public.survey_versions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  version integer not null,
  definition jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (survey_id, version)
);

create table if not exists public.survey_response_sessions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  survey_version integer not null default 1,
  response_token text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  respondent_name text,
  respondent_contact text,
  answers jsonb not null default '{}'::jsonb,
  inactive_answers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.survey_answers add column if not exists response_session_id uuid references public.survey_response_sessions(id) on delete set null;
alter table public.survey_answers add column if not exists question_key text;
alter table public.survey_answers add column if not exists is_active boolean not null default true;

update public.surveys set survey_key = coalesce(nullif(survey_key, ''), 'legacy_' || replace(id::text, '-', '')) where survey_key is null or survey_key = '';
update public.survey_questions set key = coalesce(nullif(key, ''), 'legacy_' || replace(id::text, '-', '')) where key is null or key = '';
create unique index if not exists surveys_survey_key_unique_idx on public.surveys(lower(survey_key)) where survey_key is not null;
create unique index if not exists surveys_slug_unique_idx on public.surveys(lower(slug)) where slug is not null;
create unique index if not exists survey_questions_survey_key_unique_idx on public.survey_questions(survey_id, key) where key is not null;
create index if not exists survey_sections_survey_order_idx on public.survey_sections(survey_id, order_index);
create index if not exists survey_questions_section_order_idx on public.survey_questions(section_id, order_index);
create index if not exists survey_response_sessions_survey_status_idx on public.survey_response_sessions(survey_id, status, updated_at desc);
create index if not exists survey_answers_session_idx on public.survey_answers(response_session_id) where response_session_id is not null;

alter table public.survey_sections enable row level security;
alter table public.survey_classification_rules enable row level security;
alter table public.survey_versions enable row level security;
alter table public.survey_response_sessions enable row level security;

do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array['survey_sections', 'survey_classification_rules', 'survey_versions', 'survey_response_sessions'] loop
    execute format('drop policy if exists %I on public.%I', 'Authenticated users can read ' || tbl, tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Authenticated users can read ' || tbl, tbl);
    foreach action in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      if action = 'insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      elsif action = 'update' then
        execute format('create policy %I on public.%I for update to authenticated using (public.current_profile_role() in (''admin'', ''marketer'')) with check (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      else
        execute format('create policy %I on public.%I for delete to authenticated using (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      end if;
    end loop;
  end loop;
end $$;
