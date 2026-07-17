-- Step 58: schedule a contact action and its task atomically.

create or replace function public.schedule_lead_action(
  p_lead_id uuid,
  p_next_step text,
  p_next_contact_date timestamptz,
  p_comment text,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_next_step text := trim(coalesce(p_next_step, ''));
  lead_name text;
  open_task_id uuid;
  saved_task_id uuid;
  actor_id uuid;
  is_created boolean := false;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  if normalized_next_step = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-next-action');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('lead-action:' || p_lead_id::text, 0)
  );

  select lead.name
  into lead_name
  from public.leads lead
  where lead.id = p_lead_id;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select task.id
  into open_task_id
  from public.tasks task
  where task.lead_id = p_lead_id
    and task.status in ('todo', 'in_progress')
  order by task.created_at desc, task.id desc
  limit 1
  for update;

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
    next_step = normalized_next_step,
    next_contact_date = p_next_contact_date,
    updated_at = now()
  where id = p_lead_id;

  if open_task_id is not null then
    update public.tasks
    set
      title = normalized_next_step,
      description = nullif(trim(p_comment), ''),
      due_date = p_next_contact_date,
      updated_at = now()
    where id = open_task_id
    returning id into saved_task_id;
  else
    insert into public.tasks (
      lead_id,
      title,
      description,
      due_date,
      priority,
      status,
      created_by
    )
    values (
      p_lead_id,
      normalized_next_step,
      nullif(trim(p_comment), ''),
      p_next_contact_date,
      'none',
      'todo',
      actor_id
    )
    returning id into saved_task_id;

    is_created := true;
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
    'note',
    'Hutka',
    format(
      'Запланировано действие: %s%s%s',
      normalized_next_step,
      case
        when p_next_contact_date is null then ''
        else format(' · дата %s', p_next_contact_date)
      end,
      case
        when nullif(trim(p_comment), '') is null then ''
        else format(' · %s', trim(p_comment))
      end
    ),
    'next_action_planned',
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
    case when is_created then 'создал задачу' else 'изменил задачу' end,
    'task',
    saved_task_id,
    normalized_next_step,
    jsonb_build_object(
      'contact_id',
      p_lead_id,
      'contact',
      lead_name,
      'due_date',
      p_next_contact_date,
      'from_next_action',
      true
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'task_id',
    saved_task_id,
    'created',
    is_created
  );
end;
$$;

revoke all on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) from public;
revoke all on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) from anon;
grant execute on function public.schedule_lead_action(
  uuid, text, timestamptz, text, uuid
) to authenticated, service_role;
