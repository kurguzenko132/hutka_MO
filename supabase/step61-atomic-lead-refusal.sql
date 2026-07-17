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
