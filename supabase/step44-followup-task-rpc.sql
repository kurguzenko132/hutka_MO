-- Hutka step 44: atomic task creation from the "What to do" workspace.
-- The function runs with caller permissions, so existing RLS remains authoritative.

create index if not exists tasks_open_lead_title_idx
  on public.tasks(lead_id, title)
  where status in ('todo', 'in_progress');

create or replace function public.create_followup_task(
  p_lead_id uuid,
  p_title text,
  p_description text default null,
  p_due_date timestamptz default null,
  p_priority text default 'medium',
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_task_id uuid;
  new_task_id uuid;
  normalized_title text := nullif(trim(p_title), '');
  normalized_priority text := case
    when p_priority in ('none', 'low', 'medium', 'high', 'urgent') then p_priority
    else 'medium'
  end;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-lead');
  end if;

  if normalized_title is null then
    return jsonb_build_object('ok', false, 'error', 'missing-followup-data');
  end if;

  if not exists (
    select 1
    from public.leads
    where id = p_lead_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'lead-not-found');
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_lead_id::text),
    hashtext(lower(normalized_title))
  );

  select id
  into existing_task_id
  from public.tasks
  where lead_id = p_lead_id
    and title = normalized_title
    and status in ('todo', 'in_progress')
  order by created_at desc
  limit 1;

  if existing_task_id is not null then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'task_id', existing_task_id
    );
  end if;

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
    normalized_title,
    nullif(trim(coalesce(p_description, '')), ''),
    p_due_date,
    normalized_priority,
    'todo',
    p_created_by
  )
  returning id into new_task_id;

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
    'Автоматически создана задача по рекомендации: ' || normalized_title,
    'auto_followup_task_created',
    p_created_by
  );

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'task_id', new_task_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'followup-task-failed'
    );
end;
$$;

revoke all on function public.create_followup_task(uuid, text, text, timestamptz, text, uuid) from public;
grant execute on function public.create_followup_task(uuid, text, text, timestamptz, text, uuid) to authenticated, service_role;
