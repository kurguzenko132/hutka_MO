-- Hutka step 51: exact campaign metrics with paginated campaign contacts.
-- The function runs with caller permissions, preserving existing RLS.

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
