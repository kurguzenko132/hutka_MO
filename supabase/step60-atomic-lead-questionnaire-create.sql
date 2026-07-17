-- Step 60: create personal contact questions atomically.

create or replace function public.create_lead_questionnaire_with_questions(
  p_lead_id uuid,
  p_title text,
  p_description text,
  p_token text,
  p_public_url text,
  p_source text,
  p_source_title text,
  p_questions jsonb,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  lead_name text;
  normalized_title text;
  normalized_token text := trim(coalesce(p_token, ''));
  normalized_public_url text := coalesce(
    nullif(trim(p_public_url), ''),
    '/q/' || trim(coalesce(p_token, ''))
  );
  normalized_source text := lower(trim(coalesce(p_source, 'manual')));
  normalized_questions jsonb := coalesce(p_questions, '[]'::jsonb);
  questionnaire_id uuid;
  questionnaire_created_at timestamptz;
  actor_id uuid;
  questions_count integer;
  interaction_text text;
begin
  if p_lead_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing-contact');
  end if;

  if normalized_token = '' then
    return jsonb_build_object('ok', false, 'error', 'questionnaire-token-required');
  end if;

  if jsonb_typeof(normalized_questions) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'questions-required');
  end if;

  select count(*)
  into questions_count
  from jsonb_array_elements(normalized_questions) question
  where nullif(trim(question ->> 'text'), '') is not null;

  if questions_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'questions-required');
  end if;

  select lead.name
  into lead_name
  from public.leads lead
  where lead.id = p_lead_id;

  if lead_name is null then
    return jsonb_build_object('ok', false, 'error', 'contact-not-found');
  end if;

  select profile.id
  into actor_id
  from public.profiles profile
  where profile.user_id = auth.uid()
  limit 1;

  if actor_id is null and auth.role() = 'service_role' then
    actor_id := p_actor_profile_id;
  end if;

  normalized_title := coalesce(
    nullif(trim(p_title), ''),
    format('Вопросы для %s', lead_name)
  );

  insert into public.lead_questionnaires (
    lead_id,
    title,
    description,
    status,
    token,
    created_by
  )
  values (
    p_lead_id,
    normalized_title,
    nullif(trim(p_description), ''),
    'active',
    normalized_token,
    actor_id
  )
  returning id, created_at
  into questionnaire_id, questionnaire_created_at;

  insert into public.lead_questionnaire_questions (
    questionnaire_id,
    question_text,
    question_type,
    options,
    required,
    order_index
  )
  select
    questionnaire_id,
    trim(question.value ->> 'text'),
    coalesce(nullif(trim(question.value ->> 'type'), ''), 'short_text'),
    case
      when jsonb_typeof(question.value -> 'options') = 'array'
        then question.value -> 'options'
      else '[]'::jsonb
    end,
    coalesce((question.value ->> 'required')::boolean, false),
    question.ordinality::integer
  from jsonb_array_elements(normalized_questions)
    with ordinality as question(value, ordinality)
  where nullif(trim(question.value ->> 'text'), '') is not null;

  interaction_text := case
    when normalized_source = 'question_pack'
      then format(
        'Созданы вопросы для контакта из готового набора «%s»: %s',
        coalesce(nullif(trim(p_source_title), ''), normalized_title),
        normalized_public_url
      )
    else format(
      'Созданы вопросы для контакта «%s»: %s',
      normalized_title,
      normalized_public_url
    )
  end;

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
    'survey_sent',
    'Hutka',
    interaction_text,
    case
      when normalized_source = 'question_pack' then 'lead_questionnaire_pack_created'
      else 'lead_questionnaire_created'
    end,
    actor_id
  );

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
    'создал анкету',
    'lead_questionnaire',
    questionnaire_id,
    normalized_title,
    jsonb_build_object(
      'lead_id',
      p_lead_id,
      'source',
      normalized_source,
      'questions',
      questions_count
    )
  );

  return jsonb_build_object(
    'ok',
    true,
    'questionnaire_id',
    questionnaire_id,
    'lead_id',
    p_lead_id,
    'lead_name',
    lead_name,
    'title',
    normalized_title,
    'description',
    nullif(trim(p_description), ''),
    'status',
    'active',
    'token',
    normalized_token,
    'questions_count',
    questions_count,
    'created_at',
    questionnaire_created_at
  );
end;
$$;

revoke all on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) from public;
revoke all on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) from anon;
grant execute on function public.create_lead_questionnaire_with_questions(
  uuid, text, text, text, text, text, text, jsonb, uuid
) to authenticated, service_role;
