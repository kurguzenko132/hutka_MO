-- Hutka step 52: compact questionnaire summaries and bounded response previews per contact.
-- Functions run with caller permissions, preserving existing RLS.

create or replace function public.get_lead_questionnaire_summaries(p_lead_id uuid)
returns table (
  id uuid,
  lead_id uuid,
  title text,
  description text,
  status text,
  token text,
  created_at timestamptz,
  questions_count bigint,
  responses_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    questionnaire.id,
    questionnaire.lead_id,
    questionnaire.title,
    questionnaire.description,
    questionnaire.status,
    questionnaire.token,
    questionnaire.created_at,
    coalesce(question_count.total, 0) as questions_count,
    coalesce(response_count.total, 0) as responses_count
  from public.lead_questionnaires questionnaire
  left join lateral (
    select count(*) as total
    from public.lead_questionnaire_questions question
    where question.questionnaire_id = questionnaire.id
  ) question_count on true
  left join lateral (
    select count(distinct coalesce(answer.response_group_id, answer.id)) as total
    from public.lead_questionnaire_answers answer
    where answer.questionnaire_id = questionnaire.id
  ) response_count on true
  where questionnaire.lead_id = p_lead_id
  order by questionnaire.created_at desc
  limit 50;
$$;

create or replace function public.get_lead_questionnaire_response_preview(
  p_lead_id uuid,
  p_limit_groups integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with response_groups as materialized (
    select
      answer.questionnaire_id,
      coalesce(answer.response_group_id, answer.id) as group_id,
      (array_agg(answer.respondent_name order by answer.created_at desc, answer.id))[1] as respondent_name,
      (array_agg(answer.respondent_contact order by answer.created_at desc, answer.id))[1] as respondent_contact,
      max(answer.created_at) as created_at,
      questionnaire.title as questionnaire_title,
      questionnaire.token as questionnaire_token
    from public.lead_questionnaire_answers answer
    join public.lead_questionnaires questionnaire on questionnaire.id = answer.questionnaire_id
    where answer.lead_id = p_lead_id
    group by
      answer.questionnaire_id,
      coalesce(answer.response_group_id, answer.id),
      questionnaire.title,
      questionnaire.token
  ),
  preview_groups as materialized (
    select response_group.*
    from response_groups response_group
    order by response_group.created_at desc, response_group.group_id
    limit least(greatest(coalesce(p_limit_groups, 20), 1), 50)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', preview_group.group_id,
        'questionnaire_id', preview_group.questionnaire_id,
        'questionnaire_title', preview_group.questionnaire_title,
        'questionnaire_token', preview_group.questionnaire_token,
        'respondent_name', preview_group.respondent_name,
        'respondent_contact', preview_group.respondent_contact,
        'created_at', preview_group.created_at,
        'answers', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'question', coalesce(question.question_text, 'Вопрос'),
              'answer', answer.answer
            )
            order by question.order_index, answer.created_at, answer.id
          )
          from public.lead_questionnaire_answers answer
          left join public.lead_questionnaire_questions question on question.id = answer.question_id
          where answer.questionnaire_id = preview_group.questionnaire_id
            and coalesce(answer.response_group_id, answer.id) = preview_group.group_id
        ), '[]'::jsonb)
      )
      order by preview_group.created_at desc, preview_group.group_id
    ),
    '[]'::jsonb
  )
  from preview_groups preview_group;
$$;

revoke all on function public.get_lead_questionnaire_summaries(uuid) from public;
revoke all on function public.get_lead_questionnaire_response_preview(uuid, integer) from public;
grant execute on function public.get_lead_questionnaire_summaries(uuid) to authenticated, service_role;
grant execute on function public.get_lead_questionnaire_response_preview(uuid, integer) to authenticated, service_role;
