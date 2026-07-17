-- Hutka step 49: compact report and refusal aggregates.
-- Functions run with caller permissions, preserving existing RLS.

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
