-- Hutka step 45: database pagination and exact counters for the task workspace.
-- The function runs with caller permissions, so existing RLS remains authoritative.

create or replace function public.get_task_directory_page(
  p_q text default null,
  p_status text default 'active',
  p_priority text default null,
  p_due text default null,
  p_lead_id text default null,
  p_profile_id text default null,
  p_offset integer default 0,
  p_limit integer default 40
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select
      t.id,
      t.title,
      t.description,
      t.due_date,
      t.priority,
      t.status,
      t.created_at,
      l.id as lead_id,
      l.name as lead_name,
      coalesce(assignee_data.assignees, '[]'::jsonb) as assignees,
      coalesce(assignee_data.search_text, '') as assignee_search
    from public.tasks t
    left join public.leads l on l.id = t.lead_id
    left join lateral (
      select
        jsonb_agg(
          jsonb_build_object(
            'role', ta.role,
            'profiles', jsonb_build_object(
              'id', p.id,
              'full_name', p.full_name,
              'email', p.email,
              'job_title', p.job_title,
              'avatar_url', p.avatar_url
            )
          )
          order by
            case ta.role when 'responsible' then 1 when 'executor' then 2 else 3 end,
            coalesce(nullif(trim(p.full_name), ''), p.email)
        ) as assignees,
        string_agg(
          concat_ws(' ', p.full_name, p.email, p.job_title, ta.role),
          ' '
        ) as search_text
      from public.task_assignees ta
      join public.profiles p on p.id = ta.profile_id
      where ta.task_id = t.id
    ) assignee_data on true
  ),
  filtered as materialized (
    select *
    from base b
    where
      (
        nullif(trim(p_status), '') is null
        or (
          lower(trim(p_status)) = 'active'
          and b.status in ('todo', 'in_progress')
        )
        or (
          lower(trim(p_status)) <> 'active'
          and b.status = lower(trim(p_status))
        )
      )
      and (
        nullif(trim(p_priority), '') is null
        or b.priority = lower(trim(p_priority))
      )
      and (
        nullif(trim(p_lead_id), '') is null
        or b.lead_id::text = trim(p_lead_id)
      )
      and (
        nullif(trim(p_profile_id), '') is null
        or exists (
          select 1
          from public.task_assignees selected_assignee
          where selected_assignee.task_id = b.id
            and selected_assignee.profile_id::text = trim(p_profile_id)
        )
      )
      and (
        nullif(trim(p_due), '') is null
        or (
          lower(trim(p_due)) = 'overdue'
          and b.due_date < date_trunc('day', now())
        )
        or (
          lower(trim(p_due)) = 'today'
          and b.due_date >= date_trunc('day', now())
          and b.due_date < date_trunc('day', now()) + interval '1 day'
        )
        or (
          lower(trim(p_due)) = 'week'
          and b.due_date >= date_trunc('day', now()) + interval '1 day'
          and b.due_date < date_trunc('day', now()) + interval '7 days'
        )
        or (
          lower(trim(p_due)) = 'later'
          and b.due_date >= date_trunc('day', now()) + interval '7 days'
        )
        or (
          lower(trim(p_due)) = 'no_date'
          and b.due_date is null
        )
      )
      and (
        nullif(trim(p_q), '') is null
        or concat_ws(
          ' ',
          b.title,
          b.description,
          b.lead_name,
          b.priority,
          b.status,
          b.assignee_search
        ) ilike '%' || trim(p_q) || '%'
      )
  ),
  paged as (
    select *
    from filtered
    order by due_date asc nulls last, created_at desc, id desc
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'summary', (
      select jsonb_build_object(
        'total', count(*),
        'overdue', count(*) filter (
          where status in ('todo', 'in_progress')
            and due_date < date_trunc('day', now())
        ),
        'today', count(*) filter (
          where status in ('todo', 'in_progress')
            and due_date >= date_trunc('day', now())
            and due_date < date_trunc('day', now()) + interval '1 day'
        ),
        'urgent', count(*) filter (where priority = 'urgent'),
        'done', count(*) filter (where status = 'done')
      )
      from filtered
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'description', p.description,
          'due_date', p.due_date,
          'priority', p.priority,
          'status', p.status,
          'created_at', p.created_at,
          'leads', case
            when p.lead_id is null then null
            else jsonb_build_object('id', p.lead_id, 'name', p.lead_name)
          end,
          'assignees', p.assignees
        )
        order by p.due_date asc nulls last, p.created_at desc, p.id desc
      )
      from paged p
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_task_directory_page(text, text, text, text, text, text, integer, integer) from public;
grant execute on function public.get_task_directory_page(text, text, text, text, text, text, integer, integer) to authenticated, service_role;
