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
  ('Найден', 'master', 1, 'gray'),
  ('Написал', 'master', 2, 'purple'),
  ('Ответил', 'master', 3, 'blue'),
  ('Опрос', 'master', 4, 'yellow'),
  ('Тест', 'master', 5, 'green'),
  ('Активен', 'master', 6, 'green'),
  ('Отказ', 'master', 7, 'red')
on conflict do nothing;

insert into public.tags (name, color) values
  ('Нужны клиенты', 'pink'),
  ('Нет CRM', 'purple'),
  ('Пустые окна', 'yellow'),
  ('Готов тестировать', 'green'),
  ('Салон', 'blue'),
  ('Вернуться позже', 'gray'),
  ('Горячий лид', 'red')
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
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','insights','hypotheses'
  ] loop
    policy_name := 'Authenticated users can manage ' || tbl;
    execute format('drop policy if exists %I on public.%I', policy_name, tbl);
  end loop;
end $$;


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
  count(cl.lead_id) filter (where fs.name in ('Ответил', 'Опрос', 'Заинтересован', 'Тест', 'Активен'))::int as responses,
  count(cl.lead_id) filter (where fs.name in ('Опрос', 'Тест', 'Активен'))::int as surveys,
  count(cl.lead_id) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)::int as participants
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
alter table public.hypotheses add column if not exists category text default 'Гипотеза';
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
  count(*) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)::int as ready_to_pilot,
  count(*) filter (where fs.name = 'Активен')::int as active_participants,
  (select count(*) from public.survey_answers)::int as survey_answers,
  (select count(*) from public.tasks where status != 'done' and due_date < now())::int as overdue_tasks,
  (select count(*) from public.campaigns where status = 'active')::int as active_campaigns,
  (select count(*) from public.insights where status = 'accepted')::int as accepted_insights,
  (select count(*) from public.hypotheses where status in ('new', 'testing', 'needs_data'))::int as hypotheses_in_check
from public.leads l
left join public.funnel_stages fs on fs.id = l.stage_id;

create or replace view public.view_report_stage_distribution as
select
  coalesce(fs.name, 'Найден') as stage,
  count(l.id)::int as contacts
from public.leads l
left join public.funnel_stages fs on fs.id = l.stage_id
group by coalesce(fs.name, 'Найден')
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
    count(l.id) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)::int as ready_to_pilot,
    count(l.id) filter (where fs.name = 'Активен')::int as active_participants,
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
  count(l.id) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)::int as ready_to_pilot,
  count(l.id) filter (where fs.name = 'Активен')::int as active_participants,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts,
  least(
    100,
    greatest(
      0,
      round(
        (case when count(l.id) >= 25 then 35 else count(l.id) * 1.4 end) +
        (count(l.id) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)) * 4 +
        (count(l.id) filter (where fs.name = 'Активен')) * 6 +
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
  ('Найден', 'master', 1, 'gray'),
  ('Написал', 'master', 2, 'purple'),
  ('Ответил', 'master', 3, 'blue'),
  ('Опрос', 'master', 4, 'yellow'),
  ('Заинтересован', 'master', 5, 'pink'),
  ('Тест', 'master', 6, 'green'),
  ('Активен', 'master', 7, 'green'),
  ('Отказ', 'master', 8, 'red')
on conflict (name, type) do update set
  order_index = excluded.order_index,
  color = excluded.color;

create or replace view public.view_funnel_stage_summary as
select
  fs.id,
  fs.name,
  fs.type,
  fs.color,
  fs.order_index,
  count(l.id)::int as contacts,
  count(l.id) filter (where l.priority_score >= 75)::int as hot_contacts,
  count(l.id) filter (where fs.name in ('Тест', 'Активен') or l.priority_score >= 75)::int as ready_to_pilot,
  count(l.id) filter (where fs.name = 'Активен')::int as active_participants
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

create index if not exists sources_name_idx on public.sources(name);
create index if not exists sources_type_idx on public.sources(type);
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
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','insights','hypotheses',
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
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','insights','hypotheses',
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
    'surveys','survey_questions','survey_answers','campaigns','campaign_leads','insights','hypotheses',
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
  ('master-discovery', 'Диагностика индивидуального мастера', 'Мастер: диагностика', 'Базовый пакет, чтобы быстро понять нишу, запись, клиентов, боли и готовность к пилоту.', 'master', 'старт', 'active'),
  ('master-map-profile', 'Профиль мастера для карты', 'Мастер: профиль на карте', 'Пак для сбора данных, которые нужны для карточки мастера на карте: услуги, цены, фото, адрес, расписание.', 'master', 'карта', 'active'),
  ('salon-discovery', 'Диагностика салона', 'Салон: диагностика', 'Пак для салона: команда, запись, администраторы, текущая CRM, проблемы и интерес к карте.', 'salon', 'b2b', 'active'),
  ('pilot-feedback', 'Обратная связь после пилота', 'Фидбек после теста', 'Пак после тестирования: что понятно, что мешает, чего не хватило, готовность пользоваться дальше.', 'any', 'фидбек', 'active'),
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
    '{{first_name}}, спасибо! Вот короткая анкета — она поможет понять, как вам может быть полезна Hutka и что нужно учесть в пилоте:\n\n{{questionnaire_link}}\n\nОтветы займут 2–4 минуты.',
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
    'Приглашение в пилот',
    'Пригласить в пилот',
    'Сообщение, когда контакт подходит для раннего тестирования.',
    'any',
    'pilot',
    'any',
    'active',
    '{{first_name}}, по вашим ответам вижу, что вы хорошо подходите для первой пилотной группы Hutka. Предлагаю подключить вас к раннему тесту: поможем оформить профиль, посмотрим, как работает карта и какие заявки можно получать. Вам удобно обсудить детали?',
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
    'Фидбек после пилота',
    'Сообщение для сбора обратной связи после пилота.',
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
