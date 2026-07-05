-- Hutka cleanup script.
-- Deletes workspace/demo data but keeps Supabase Auth users, public.profiles and app_settings.
-- Run in Supabase SQL Editor when you want a clean start before real work.

do $$
declare
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
  existing_tables text[];
begin
  select array_agg(table_name)
  into existing_tables
  from unnest(workspace_tables) as table_name
  where to_regclass(table_name) is not null;

  if existing_tables is not null and array_length(existing_tables, 1) > 0 then
    execute 'truncate table ' || array_to_string(existing_tables, ', ') || ' restart identity cascade';
  end if;

  if to_regclass('public.activity_logs') is not null then
    insert into public.activity_logs (action, entity_type, entity_title, details)
    values ('очистил базу', 'settings', 'Очистка базы', jsonb_build_object('mode', 'workspace_data'));
  end if;
end $$;

-- Optional hard reset of directories and templates.
-- Run only if you also want to remove question packs, message templates, refusal reasons, tags, sources and funnel stages.
-- do $$
-- declare
--   dictionary_tables text[] := array[
--     'public.question_pack_questions',
--     'public.question_packs',
--     'public.message_templates',
--     'public.refusal_reasons',
--     'public.tags',
--     'public.sources',
--     'public.funnel_stages'
--   ];
--   existing_tables text[];
-- begin
--   select array_agg(table_name)
--   into existing_tables
--   from unnest(dictionary_tables) as table_name
--   where to_regclass(table_name) is not null;
--
--   if existing_tables is not null and array_length(existing_tables, 1) > 0 then
--     execute 'truncate table ' || array_to_string(existing_tables, ', ') || ' restart identity cascade';
--   end if;
-- end $$;
