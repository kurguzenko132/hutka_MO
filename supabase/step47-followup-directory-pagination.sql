-- Hutka step 47: classify, count and paginate "What to do" recommendations in PostgreSQL.
-- The function runs with caller permissions, so existing RLS remains authoritative.

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
