-- Hutka step 42: indexes for frequent workspace reads and actions.
-- Safe to run repeatedly. This migration does not rename columns or views.

create index if not exists leads_source_id_idx
  on public.leads(source_id);
create index if not exists leads_created_at_idx
  on public.leads(created_at desc);
create index if not exists leads_name_idx
  on public.leads(name);
create index if not exists leads_priority_updated_idx
  on public.leads(priority_score desc, updated_at desc);
create index if not exists leads_next_contact_date_idx
  on public.leads(next_contact_date)
  where next_contact_date is not null;
create index if not exists leads_city_idx
  on public.leads(city)
  where city is not null and city <> '';
create index if not exists leads_niche_idx
  on public.leads(niche)
  where niche is not null and niche <> '';

create index if not exists lead_interactions_lead_created_idx
  on public.lead_interactions(lead_id, created_at desc);

create index if not exists tasks_open_due_date_idx
  on public.tasks(due_date)
  where status in ('todo', 'in_progress') and due_date is not null;
create index if not exists tasks_open_lead_created_idx
  on public.tasks(lead_id, created_at desc)
  where status in ('todo', 'in_progress');

create index if not exists survey_answers_created_at_idx
  on public.survey_answers(created_at desc);
create index if not exists survey_answers_survey_created_idx
  on public.survey_answers(survey_id, created_at desc);
create index if not exists survey_questions_survey_order_idx
  on public.survey_questions(survey_id, order_index);
create index if not exists survey_answers_response_group_idx
  on public.survey_answers(response_group_id)
  where response_group_id is not null;

create index if not exists lead_questionnaires_status_created_idx
  on public.lead_questionnaires(status, created_at desc);
