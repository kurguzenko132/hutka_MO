-- Step 62: full survey builder with stable keys, branching and resumable answers.

alter table public.surveys add column if not exists survey_key text;
alter table public.surveys add column if not exists schema_version text not null default '1.0';
alter table public.surveys add column if not exists version integer not null default 1;
alter table public.surveys add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists start_screen jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists completion_screen jsonb not null default '{}'::jsonb;
alter table public.surveys add column if not exists updated_at timestamptz not null default now();
alter table public.surveys add column if not exists published_at timestamptz;

update public.surveys
set survey_key = coalesce(nullif(survey_key, ''), 'legacy_' || replace(id::text, '-', ''))
where survey_key is null or survey_key = '';

create unique index if not exists surveys_survey_key_unique_idx
  on public.surveys(lower(survey_key)) where survey_key is not null;
create unique index if not exists surveys_slug_unique_idx
  on public.surveys(lower(slug)) where slug is not null;

create table if not exists public.survey_sections (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  visibility jsonb not null default '{}'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, key)
);

alter table public.survey_questions add column if not exists key text;
alter table public.survey_questions add column if not exists section_id uuid references public.survey_sections(id) on delete set null;
alter table public.survey_questions add column if not exists description text;
alter table public.survey_questions add column if not exists visibility jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists options_source jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists validation jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists contact_mapping jsonb not null default '{}'::jsonb;
alter table public.survey_questions add column if not exists updated_at timestamptz not null default now();

update public.survey_questions
set key = coalesce(nullif(key, ''), 'legacy_' || replace(id::text, '-', ''))
where key is null or key = '';

create unique index if not exists survey_questions_survey_key_unique_idx
  on public.survey_questions(survey_id, key) where key is not null;
create index if not exists survey_sections_survey_order_idx
  on public.survey_sections(survey_id, order_index);
create index if not exists survey_questions_section_order_idx
  on public.survey_questions(section_id, order_index);

create table if not exists public.survey_classification_rules (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  key text not null,
  title text not null,
  priority integer not null default 100,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, key)
);

create table if not exists public.survey_versions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  version integer not null,
  definition jsonb not null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (survey_id, version)
);

create table if not exists public.survey_response_sessions (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  survey_version integer not null default 1,
  response_token text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  respondent_name text,
  respondent_contact text,
  answers jsonb not null default '{}'::jsonb,
  inactive_answers jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.survey_answers add column if not exists response_session_id uuid references public.survey_response_sessions(id) on delete set null;
alter table public.survey_answers add column if not exists question_key text;
alter table public.survey_answers add column if not exists is_active boolean not null default true;
create index if not exists survey_response_sessions_survey_status_idx
  on public.survey_response_sessions(survey_id, status, updated_at desc);
create index if not exists survey_answers_session_idx
  on public.survey_answers(response_session_id) where response_session_id is not null;

alter table public.survey_sections enable row level security;
alter table public.survey_classification_rules enable row level security;
alter table public.survey_versions enable row level security;
alter table public.survey_response_sessions enable row level security;

do $$
declare
  tbl text;
  action text;
begin
  foreach tbl in array array['survey_sections', 'survey_classification_rules', 'survey_versions', 'survey_response_sessions'] loop
    execute format('drop policy if exists %I on public.%I', 'Authenticated users can read ' || tbl, tbl);
    execute format('create policy %I on public.%I for select to authenticated using (true)', 'Authenticated users can read ' || tbl, tbl);
    foreach action in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      if action = 'insert' then
        execute format('create policy %I on public.%I for insert to authenticated with check (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      elsif action = 'update' then
        execute format('create policy %I on public.%I for update to authenticated using (public.current_profile_role() in (''admin'', ''marketer'')) with check (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      else
        execute format('create policy %I on public.%I for delete to authenticated using (public.current_profile_role() in (''admin'', ''marketer''))', 'Workspace editors can ' || action || ' ' || tbl, tbl);
      end if;
    end loop;
  end loop;
end $$;

create or replace function public.save_survey_builder_definition(
  p_survey_id uuid,
  p_definition jsonb,
  p_mode text default 'save',
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  survey_payload jsonb := coalesce(p_definition -> 'survey', '{}'::jsonb);
  normalized_key text := lower(trim(coalesce(survey_payload ->> 'key', '')));
  normalized_title text := trim(coalesce(survey_payload ->> 'title', ''));
  normalized_slug text;
  v_survey_id uuid := p_survey_id;
  existing_status text;
  actor_id uuid;
  section jsonb;
  question jsonb;
  rule jsonb;
  section_id uuid;
  section_position integer := 0;
  question_position integer;
  next_version integer;
  question_total integer := 0;
begin
  if coalesce(p_definition ->> 'schemaVersion', '') <> '1.0' then
    return jsonb_build_object('ok', false, 'error', 'schema-version');
  end if;
  if normalized_key !~ '^[a-z][a-z0-9_]{1,99}$' or normalized_title = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid-survey');
  end if;
  if jsonb_typeof(coalesce(p_definition -> 'sections', '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid-sections');
  end if;

  select profile.id into actor_id from public.profiles profile where profile.user_id = auth.uid() limit 1;
  if actor_id is null and auth.role() = 'service_role' then actor_id := p_actor_profile_id; end if;

  select count(*) into question_total
  from jsonb_array_elements(coalesce(p_definition -> 'sections', '[]'::jsonb)) section_row,
       jsonb_array_elements(coalesce(section_row -> 'questions', '[]'::jsonb)) question_row;
  if question_total < 1 or question_total > 500 then
    return jsonb_build_object('ok', false, 'error', 'question-limit');
  end if;

  if v_survey_id is not null then
    select status into existing_status from public.surveys where id = v_survey_id for update;
    if existing_status is null then return jsonb_build_object('ok', false, 'error', 'survey-not-found'); end if;
    if existing_status = 'active' and p_mode <> 'publish' then
      return jsonb_build_object('ok', false, 'error', 'published-locked');
    end if;
    if exists (select 1 from public.survey_answers answer where answer.survey_id = v_survey_id limit 1) and existing_status = 'active' then
      return jsonb_build_object('ok', false, 'error', 'published-locked');
    end if;
  else
    normalized_slug := regexp_replace(normalized_key, '_+', '-', 'g');
    while exists (select 1 from public.surveys where lower(slug) = lower(normalized_slug)) loop
      normalized_slug := regexp_replace(normalized_key, '_+', '-', 'g') || '-' || substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6);
    end loop;
    insert into public.surveys (survey_key, title, type, description, status, slug, schema_version, version, settings, start_screen, completion_screen)
    values (
      normalized_key, normalized_title, nullif(trim(coalesce(survey_payload ->> 'type', '')), ''), nullif(trim(coalesce(survey_payload ->> 'description', '')), ''),
      case when p_mode = 'publish' then 'active' else 'draft' end, normalized_slug, '1.0', 1,
      coalesce(survey_payload -> 'settings', '{}'::jsonb), coalesce(survey_payload -> 'startScreen', '{}'::jsonb), coalesce(survey_payload -> 'completionScreen', '{}'::jsonb)
    ) returning id into v_survey_id;
  end if;

  if p_survey_id is not null then
    update public.surveys set
      survey_key = normalized_key,
      title = normalized_title,
      type = nullif(trim(coalesce(survey_payload ->> 'type', '')), ''),
      description = nullif(trim(coalesce(survey_payload ->> 'description', '')), ''),
      schema_version = '1.0',
      settings = coalesce(survey_payload -> 'settings', '{}'::jsonb),
      start_screen = coalesce(survey_payload -> 'startScreen', '{}'::jsonb),
      completion_screen = coalesce(survey_payload -> 'completionScreen', '{}'::jsonb),
      updated_at = now()
    where id = v_survey_id;
  end if;

  delete from public.survey_questions question_row where question_row.survey_id = v_survey_id;
  delete from public.survey_sections section_row where section_row.survey_id = v_survey_id;
  delete from public.survey_classification_rules rule_row where rule_row.survey_id = v_survey_id;

  for section in select value from jsonb_array_elements(p_definition -> 'sections') loop
    section_position := section_position + 1;
    insert into public.survey_sections (survey_id, key, title, description, visibility, order_index)
    values (
      v_survey_id, section ->> 'key', section ->> 'title', nullif(section ->> 'description', ''),
      coalesce(section -> 'visibility', '{}'::jsonb), section_position
    ) returning id into section_id;
    question_position := 0;
    for question in select value from jsonb_array_elements(coalesce(section -> 'questions', '[]'::jsonb)) loop
      question_position := question_position + 1;
      insert into public.survey_questions (
        survey_id, section_id, key, question_text, question_type, options, order_index, required,
        description, visibility, options_source, validation, settings, contact_mapping
      ) values (
        v_survey_id, section_id, question ->> 'key', question ->> 'title', question ->> 'type', coalesce(question -> 'options', '[]'::jsonb),
        section_position * 1000 + question_position, coalesce((question ->> 'required')::boolean, false),
        nullif(question ->> 'description', ''), coalesce(question -> 'visibility', '{}'::jsonb),
        coalesce(question -> 'optionsSource', '{}'::jsonb), coalesce(question -> 'validation', '{}'::jsonb),
        coalesce(question -> 'settings', '{}'::jsonb), coalesce(question -> 'contactMapping', '{}'::jsonb)
      );
    end loop;
  end loop;

  for rule in select value from jsonb_array_elements(coalesce(p_definition -> 'classificationRules', '[]'::jsonb)) loop
    insert into public.survey_classification_rules (survey_id, key, title, priority, conditions, actions)
    values (v_survey_id, rule ->> 'key', rule ->> 'title', coalesce((rule ->> 'priority')::integer, 100), coalesce(rule -> 'when', '{}'::jsonb), coalesce(rule -> 'actions', '[]'::jsonb));
  end loop;

  if p_mode = 'publish' then
    if p_survey_id is null then
      next_version := 1;
    else
      select version + 1 into next_version from public.surveys where id = v_survey_id;
    end if;
    update public.surveys set status = 'active', version = next_version, published_at = now(), updated_at = now() where id = v_survey_id;
    insert into public.survey_versions (survey_id, version, definition, published_by)
    values (v_survey_id, next_version, p_definition, actor_id)
    on conflict (survey_id, version) do update set definition = excluded.definition, published_by = excluded.published_by, created_at = now();
  end if;

  insert into public.activity_logs (user_id, action, entity_type, entity_id, entity_title, details)
  values (actor_id, case when p_survey_id is null then 'создал анкету' when p_mode = 'publish' then 'опубликовал анкету' else 'изменил анкету' end, 'survey', v_survey_id, normalized_title, jsonb_build_object('questions', question_total, 'mode', p_mode));

  return jsonb_build_object('ok', true, 'survey_id', v_survey_id, 'slug', (select slug from public.surveys where id = v_survey_id));
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'duplicate-key');
end;
$$;

revoke all on function public.save_survey_builder_definition(uuid, jsonb, text, uuid) from public, anon;
grant execute on function public.save_survey_builder_definition(uuid, jsonb, text, uuid) to authenticated, service_role;
