-- Hutka step 43: database pagination and metadata for the contact directory.
-- Functions run with the caller permissions, so existing RLS remains authoritative.

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
