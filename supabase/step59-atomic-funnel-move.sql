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
