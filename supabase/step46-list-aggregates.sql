-- Hutka step 46: compact aggregates for campaign and survey lists.
-- These functions avoid transferring every related contact and answer just to count them.

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
