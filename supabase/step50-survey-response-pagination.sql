-- Hutka step 50: paginate grouped survey responses without transferring the full answer history.
-- The function runs with caller permissions, preserving existing RLS.

create index if not exists survey_answers_survey_group_created_idx
  on public.survey_answers(survey_id, response_group_id, created_at desc);

create or replace function public.get_survey_response_page(
  p_survey_id uuid,
  p_offset integer default 0,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with response_groups as materialized (
    select
      coalesce(answer.response_group_id, answer.id) as group_id,
      (array_agg(answer.respondent_name order by answer.created_at desc, answer.id))[1] as respondent_name,
      (array_agg(answer.respondent_contact order by answer.created_at desc, answer.id))[1] as respondent_contact,
      max(answer.created_at) as created_at
    from public.survey_answers answer
    where answer.survey_id = p_survey_id
    group by coalesce(answer.response_group_id, answer.id)
  ),
  page_groups as materialized (
    select response_group.*
    from response_groups response_group
    order by response_group.created_at desc, response_group.group_id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from response_groups),
    'responses',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', page_group.group_id,
            'respondent_name', page_group.respondent_name,
            'respondent_contact', page_group.respondent_contact,
            'created_at', page_group.created_at,
            'answers', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'question', coalesce(question.question_text, 'Вопрос'),
                  'answer', answer.answer
                )
                order by question.order_index, answer.created_at, answer.id
              )
              from public.survey_answers answer
              left join public.survey_questions question on question.id = answer.question_id
              where answer.survey_id = p_survey_id
                and coalesce(answer.response_group_id, answer.id) = page_group.group_id
            ), '[]'::jsonb)
          )
          order by page_group.created_at desc, page_group.group_id
        )
        from page_groups page_group
      ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_survey_response_page(uuid, integer, integer) from public;
grant execute on function public.get_survey_response_page(uuid, integer, integer) to authenticated, service_role;
