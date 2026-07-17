-- Step 55: merge duplicate sources atomically inside PostgreSQL.

create or replace function public.merge_duplicate_sources(
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_group record;
  keeper_id uuid;
  duplicate_ids uuid[];
  merged_count integer := 0;
  reassigned_count integer := 0;
  affected_count integer := 0;
  actor_id uuid;
begin
  select id
  into actor_id
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  actor_id := coalesce(actor_id, p_user_id);

  for source_group in
    select
      public.normalize_source_name(name) as normalized_name,
      array_agg(id order by created_at asc, id asc) as source_ids
    from public.sources
    where public.normalize_source_name(name) <> ''
    group by public.normalize_source_name(name)
    having count(*) > 1
  loop
    keeper_id := source_group.source_ids[1];
    duplicate_ids := source_group.source_ids[2:array_length(source_group.source_ids, 1)];

    update public.leads
    set source_id = keeper_id
    where source_id = any(duplicate_ids);
    get diagnostics affected_count = row_count;
    reassigned_count := reassigned_count + affected_count;

    delete from public.sources
    where id = any(duplicate_ids);
    get diagnostics affected_count = row_count;
    merged_count := merged_count + affected_count;

    update public.sources
    set name = source_group.normalized_name
    where id = keeper_id;
  end loop;

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_title,
    details
  )
  values (
    actor_id,
    'объединил источники',
    'source',
    'Источники',
    jsonb_build_object(
      'merged',
      merged_count,
      'reassigned_contacts',
      reassigned_count
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'merged',
    merged_count,
    'reassigned_contacts',
    reassigned_count
  );
end;
$$;

revoke all on function public.merge_duplicate_sources(uuid) from public;
revoke all on function public.merge_duplicate_sources(uuid) from anon;
grant execute on function public.merge_duplicate_sources(uuid) to authenticated, service_role;
