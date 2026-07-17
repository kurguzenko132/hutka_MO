-- Step 57: create a task, assignees, contact history, and activity log
-- in one RLS-aware transaction.

create or replace function public.create_task_with_assignees(
  p_title text,
  p_lead_id uuid,
  p_description text,
  p_due_date timestamptz,
  p_priority text,
  p_assignee_profile_ids uuid[],
  p_assignee_roles text[],
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_priority text := lower(trim(coalesce(p_priority, 'none')));
  normalized_profile_ids uuid[] := coalesce(p_assignee_profile_ids, array[]::uuid[]);
  normalized_roles text[] := coalesce(p_assignee_roles, array[]::text[]);
  saved_task_id uuid;
  lead_name text;
  actor_id uuid;
begin
  if normalized_title = '' then
    return jsonb_build_object('ok', false, 'error', 'missing-task-title');
  end if;

  if normalized_priority not in ('none', 'low', 'medium', 'high', 'urgent') then
    return jsonb_build_object('ok', false, 'error', 'invalid-priority');
  end if;

  if cardinality(normalized_profile_ids) <> cardinality(normalized_roles) then
    return jsonb_build_object('ok', false, 'error', 'invalid-assignees');
  end if;

  if cardinality(normalized_profile_ids) <> (
    select count(distinct assignment.profile_id)
    from unnest(normalized_profile_ids) as assignment(profile_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid-assignees');
  end if;

  if p_lead_id is not null then
    select lead.name
    into lead_name
    from public.leads lead
    where lead.id = p_lead_id;

    if lead_name is null then
      return jsonb_build_object('ok', false, 'error', 'lead-not-found');
    end if;
  end if;

  if exists (
    select 1
    from unnest(normalized_profile_ids, normalized_roles)
      as assignment(profile_id, assignee_role)
    left join public.profiles profile
      on profile.id = assignment.profile_id
    where profile.id is null
      or assignment.assignee_role is null
      or assignment.assignee_role not in ('responsible', 'executor', 'co_executor')
  ) then
    return jsonb_build_object('ok', false, 'error', 'task-assignee-not-found');
  end if;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  insert into public.tasks (
    title,
    lead_id,
    description,
    due_date,
    priority,
    status,
    created_by
  )
  values (
    normalized_title,
    p_lead_id,
    nullif(trim(p_description), ''),
    p_due_date,
    normalized_priority,
    'todo',
    actor_id
  )
  returning id into saved_task_id;

  if cardinality(normalized_profile_ids) > 0 then
    insert into public.task_assignees (task_id, profile_id, role)
    select
      saved_task_id,
      assignment.profile_id,
      assignment.assignee_role
    from unnest(normalized_profile_ids, normalized_roles)
      as assignment(profile_id, assignee_role);
  end if;

  if p_lead_id is not null then
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
      format('Создана задача: %s', normalized_title),
      'task_created',
      actor_id
    );
  end if;

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
    'создал задачу',
    'task',
    saved_task_id,
    normalized_title,
    jsonb_build_object(
      'lead_id',
      p_lead_id,
      'due_date',
      p_due_date,
      'priority',
      normalized_priority,
      'assignees',
      cardinality(normalized_profile_ids)
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'task_id',
    saved_task_id,
    'lead_name',
    lead_name
  );
end;
$$;

revoke all on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) from public;
revoke all on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) from anon;
grant execute on function public.create_task_with_assignees(
  text, uuid, text, timestamptz, text, uuid[], text[], uuid
) to authenticated, service_role;
