-- Hutka cleanup script.
-- Deletes workspace/demo data but keeps Supabase Auth users, public.profiles and app_settings.
-- Run in Supabase SQL Editor when you want a clean start before real work.

begin;

truncate table if exists
  public.notification_reads,
  public.saved_lead_views,
  public.import_logs,
  public.lead_questionnaire_answers,
  public.lead_questionnaire_questions,
  public.lead_questionnaires,
  public.survey_answers,
  public.survey_questions,
  public.hypothesis_leads,
  public.hypothesis_insights,
  public.hypothesis_campaigns,
  public.hypothesis_surveys,
  public.insight_leads,
  public.insight_campaigns,
  public.insight_surveys,
  public.campaign_leads,
  public.lead_tags,
  public.lead_interactions,
  public.tasks,
  public.hypotheses,
  public.insights,
  public.campaigns,
  public.surveys,
  public.leads
restart identity cascade;

-- Optional hard reset of directories and templates.
-- Uncomment this block only if you also want to remove question packs, message templates, refusal reasons, tags, sources and funnel stages.
-- truncate table if exists
--   public.question_pack_questions,
--   public.question_packs,
--   public.message_templates,
--   public.refusal_reasons,
--   public.tags,
--   public.sources,
--   public.funnel_stages
-- restart identity cascade;

commit;
