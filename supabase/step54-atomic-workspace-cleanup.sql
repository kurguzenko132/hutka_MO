-- Step 54: atomic workspace cleanup without deleting auth users or profiles.

create or replace function public.reset_workspace_data(
  p_mode text default 'work',
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_mode text := lower(trim(coalesce(p_mode, 'work')));
  workspace_tables text[] := array[
    'public.telegram_delivery_logs',
    'public.notification_reads',
    'public.saved_lead_views',
    'public.import_logs',
    'public.lead_questionnaire_answers',
    'public.lead_questionnaire_questions',
    'public.lead_questionnaires',
    'public.survey_answers',
    'public.survey_questions',
    'public.hypothesis_leads',
    'public.hypothesis_insights',
    'public.hypothesis_campaigns',
    'public.hypothesis_surveys',
    'public.insight_leads',
    'public.insight_campaigns',
    'public.insight_surveys',
    'public.campaign_leads',
    'public.lead_tags',
    'public.lead_interactions',
    'public.task_assignees',
    'public.tasks',
    'public.hypotheses',
    'public.insights',
    'public.campaigns',
    'public.surveys',
    'public.leads'
  ];
  directory_tables text[] := array[
    'public.question_pack_questions',
    'public.question_packs',
    'public.message_templates',
    'public.refusal_reasons',
    'public.tags',
    'public.sources',
    'public.funnel_stages'
  ];
  target_tables text[];
  table_name text;
  deleted_count bigint;
  deleted_counts jsonb := '{}'::jsonb;
begin
  if normalized_mode not in ('work', 'full') then
    raise exception 'Unsupported cleanup mode: %', normalized_mode
      using errcode = '22023';
  end if;

  target_tables := workspace_tables;
  if normalized_mode = 'full' then
    target_tables := target_tables || directory_tables;
  end if;

  foreach table_name in array target_tables loop
    if to_regclass(table_name) is null then
      continue;
    end if;

    execute format(
      'delete from %I.%I',
      split_part(table_name, '.', 1),
      split_part(table_name, '.', 2)
    );
    get diagnostics deleted_count = row_count;
    deleted_counts := deleted_counts || jsonb_build_object(
      split_part(table_name, '.', 2),
      deleted_count
    );
  end loop;

  if to_regclass('public.activity_logs') is not null then
    insert into public.activity_logs (
      user_id,
      action,
      entity_type,
      entity_title,
      details
    )
    values (
      p_user_id,
      'очистил базу',
      'settings',
      'Очистка базы',
      jsonb_build_object(
        'mode',
        normalized_mode,
        'deleted',
        deleted_counts
      )
    );
  end if;

  return jsonb_build_object(
    'ok',
    true,
    'mode',
    normalized_mode,
    'deleted',
    deleted_counts
  );
end;
$$;

revoke all on function public.reset_workspace_data(text, uuid) from public;
revoke all on function public.reset_workspace_data(text, uuid) from anon;
revoke all on function public.reset_workspace_data(text, uuid) from authenticated;
grant execute on function public.reset_workspace_data(text, uuid) to service_role;
