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
  priority text default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
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

-- Enable RLS. Add stricter policies before production if needed.
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

-- MVP policy: authenticated users can read/write workspace data.
-- For production, replace with role-based policies.
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
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', policy_name, tbl);
  end loop;
end $$;
