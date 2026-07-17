-- Step 56: save a contact, its directories, tags, history, and activity log
-- in one RLS-aware transaction.

create index if not exists leads_email_normalized_idx
  on public.leads(lower(trim(email)))
  where nullif(trim(email), '') is not null;
create index if not exists leads_phone_normalized_idx
  on public.leads(trim(phone))
  where nullif(trim(phone), '') is not null;
create index if not exists leads_instagram_normalized_idx
  on public.leads(lower(trim(instagram)))
  where nullif(trim(instagram), '') is not null;
create index if not exists leads_telegram_normalized_idx
  on public.leads(lower(trim(telegram)))
  where nullif(trim(telegram), '') is not null;
create index if not exists sources_name_casefold_idx
  on public.sources(lower(public.normalize_source_name(name)));
create index if not exists funnel_stages_name_casefold_idx
  on public.funnel_stages(lower(trim(name)));
create index if not exists tags_name_casefold_idx
  on public.tags(lower(trim(name)));

create or replace function public.save_lead_with_tags(
  p_lead_id uuid,
  p_name text,
  p_type text,
  p_niche text,
  p_city text,
  p_phone text,
  p_telegram text,
  p_instagram text,
  p_email text,
  p_source_name text,
  p_stage_name text,
  p_stage_order integer,
  p_stage_color text,
  p_priority_score integer,
  p_notes text,
  p_next_step text,
  p_next_contact_date timestamptz,
  p_tags text[],
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_type text := lower(trim(coalesce(p_type, '')));
  normalized_source_name text;
  normalized_stage_name text := coalesce(nullif(trim(p_stage_name), ''), 'Новый');
  saved_lead_id uuid;
  resolved_source_id uuid;
  resolved_stage_id uuid;
  resolved_tag_id uuid;
  tag_name text;
  duplicate_id uuid;
  duplicate_name text;
  actor_id uuid;
  is_created boolean := p_lead_id is null;
begin
  if normalized_name = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-name');
  end if;

  if normalized_type not in ('master', 'salon', 'client', 'partner') then
    return jsonb_build_object('ok', false, 'error', 'invalid-type');
  end if;

  if coalesce(p_priority_score, 0) < 0 or coalesce(p_priority_score, 0) > 100 then
    return jsonb_build_object('ok', false, 'error', 'invalid-priority');
  end if;

  if p_lead_id is not null and not exists (
    select 1
    from public.leads lead
    where lead.id = p_lead_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select lead.id, lead.name
  into duplicate_id, duplicate_name
  from public.leads lead
  where (p_lead_id is null or lead.id <> p_lead_id)
    and (
      (
        nullif(trim(p_email), '') is not null
        and lower(trim(lead.email)) = lower(trim(p_email))
      )
      or (
        nullif(trim(p_phone), '') is not null
        and trim(lead.phone) = trim(p_phone)
      )
      or (
        nullif(trim(p_instagram), '') is not null
        and lower(trim(lead.instagram)) = lower(trim(p_instagram))
      )
      or (
        nullif(trim(p_telegram), '') is not null
        and lower(trim(lead.telegram)) = lower(trim(p_telegram))
      )
    )
  order by lead.created_at asc, lead.id asc
  limit 1;

  if duplicate_id is not null then
    return jsonb_build_object(
      'ok',
      false,
      'error',
      'duplicate-contact',
      'duplicate_id',
      duplicate_id,
      'duplicate_name',
      duplicate_name
    );
  end if;

  normalized_source_name := public.normalize_source_name(
    coalesce(nullif(trim(p_source_name), ''), 'Не указан')
  );
  if normalized_source_name = '' then
    normalized_source_name := 'Не указан';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('source:' || lower(normalized_source_name), 0)
  );

  select source.id
  into resolved_source_id
  from public.sources source
  where lower(public.normalize_source_name(source.name)) = lower(normalized_source_name)
  order by source.created_at asc, source.id asc
  limit 1;

  if resolved_source_id is null then
    begin
      insert into public.sources (name, type)
      values (normalized_source_name, 'manual')
      returning id into resolved_source_id;
    exception
      when unique_violation then
        select source.id
        into resolved_source_id
        from public.sources source
        where lower(public.normalize_source_name(source.name)) = lower(normalized_source_name)
        order by source.created_at asc, source.id asc
        limit 1;
    end;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('stage:' || lower(normalized_stage_name), 0)
  );

  select stage.id
  into resolved_stage_id
  from public.funnel_stages stage
  where lower(trim(stage.name)) = lower(normalized_stage_name)
  order by stage.created_at asc, stage.id asc
  limit 1;

  if resolved_stage_id is null then
    insert into public.funnel_stages (name, type, order_index, color)
    values (
      normalized_stage_name,
      'master',
      coalesce(p_stage_order, 0),
      coalesce(nullif(trim(p_stage_color), ''), 'purple')
    )
    returning id into resolved_stage_id;
  end if;

  if is_created then
    insert into public.leads (
      name,
      type,
      niche,
      city,
      phone,
      telegram,
      instagram,
      email,
      source_id,
      stage_id,
      priority_score,
      notes,
      next_step,
      next_contact_date
    )
    values (
      normalized_name,
      normalized_type,
      nullif(trim(p_niche), ''),
      nullif(trim(p_city), ''),
      nullif(trim(p_phone), ''),
      nullif(trim(p_telegram), ''),
      nullif(trim(p_instagram), ''),
      nullif(trim(p_email), ''),
      resolved_source_id,
      resolved_stage_id,
      coalesce(p_priority_score, 0),
      nullif(trim(p_notes), ''),
      nullif(trim(p_next_step), ''),
      p_next_contact_date
    )
    returning id into saved_lead_id;
  else
    update public.leads
    set
      name = normalized_name,
      type = normalized_type,
      niche = nullif(trim(p_niche), ''),
      city = nullif(trim(p_city), ''),
      phone = nullif(trim(p_phone), ''),
      telegram = nullif(trim(p_telegram), ''),
      instagram = nullif(trim(p_instagram), ''),
      email = nullif(trim(p_email), ''),
      source_id = resolved_source_id,
      stage_id = resolved_stage_id,
      priority_score = coalesce(p_priority_score, 0),
      notes = nullif(trim(p_notes), ''),
      next_step = nullif(trim(p_next_step), ''),
      next_contact_date = p_next_contact_date,
      updated_at = now()
    where id = p_lead_id
    returning id into saved_lead_id;

    if saved_lead_id is null then
      return jsonb_build_object('ok', false, 'error', 'contact-not-found');
    end if;
  end if;

  delete from public.lead_tags
  where lead_id = saved_lead_id;

  for tag_name in
    select min(trim(input_tag))
    from unnest(coalesce(p_tags, array[]::text[])) as input_tag
    where nullif(trim(input_tag), '') is not null
    group by lower(trim(input_tag))
  loop
    resolved_tag_id := null;

    perform pg_advisory_xact_lock(
      hashtextextended('tag:' || lower(tag_name), 0)
    );

    select tag.id
    into resolved_tag_id
    from public.tags tag
    where lower(trim(tag.name)) = lower(tag_name)
    order by tag.created_at asc, tag.id asc
    limit 1;

    if resolved_tag_id is null then
      begin
        insert into public.tags (name, color)
        values (tag_name, 'purple')
        returning id into resolved_tag_id;
      exception
        when unique_violation then
          select tag.id
          into resolved_tag_id
          from public.tags tag
          where tag.name = tag_name
          limit 1;
      end;
    end if;

    if resolved_tag_id is not null then
      insert into public.lead_tags (lead_id, tag_id)
      values (saved_lead_id, resolved_tag_id)
      on conflict do nothing;
    end if;
  end loop;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
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
    saved_lead_id,
    case when is_created then 'note' else 'status_change' end,
    case when is_created then normalized_source_name else 'Hutka' end,
    case
      when is_created then 'Контакт добавлен в Hutka'
      else format('Контакт обновлен. Стадия: %s', normalized_stage_name)
    end,
    case when is_created then 'created' else 'updated' end,
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
    case when is_created then 'создал контакт' else 'изменил контакт' end,
    'contact',
    saved_lead_id,
    normalized_name,
    jsonb_build_object(
      'source',
      normalized_source_name,
      'stage',
      normalized_stage_name,
      'next_step',
      nullif(trim(p_next_step), ''),
      'next_contact_date',
      p_next_contact_date
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'lead_id',
    saved_lead_id,
    'created',
    is_created
  );
end;
$$;

revoke all on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) from public;
revoke all on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) from anon;
grant execute on function public.save_lead_with_tags(
  uuid, text, text, text, text, text, text, text, text, text, text,
  integer, text, integer, text, text, timestamptz, text[], uuid
) to authenticated, service_role;
