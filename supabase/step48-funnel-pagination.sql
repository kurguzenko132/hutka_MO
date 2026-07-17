-- Hutka step 48: exact funnel aggregates with bounded cards per stage.
-- Both functions run with caller permissions, so existing RLS remains authoritative.

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
