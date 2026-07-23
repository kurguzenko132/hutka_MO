-- Step 63: personal survey links for contacts.
-- Run after supabase/step62-survey-builder.sql.

do $$
begin
  if to_regclass('public.surveys') is null
    or to_regclass('public.leads') is null
    or to_regclass('public.survey_response_sessions') is null then
    raise exception using
      errcode = 'P0001',
      message = 'Сначала примените базовую схему и Step 62 конструктора анкет.';
  end if;
end $$;

create table if not exists public.survey_lead_invites (
  id uuid primary key default uuid_generate_v4(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'completed', 'revoked')),
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  last_response_session_id uuid references public.survey_response_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists survey_lead_invites_active_unique_idx
  on public.survey_lead_invites(survey_id, lead_id)
  where status = 'active';
create index if not exists survey_lead_invites_token_idx
  on public.survey_lead_invites(token);
create index if not exists survey_lead_invites_lead_idx
  on public.survey_lead_invites(lead_id, created_at desc);

alter table public.survey_lead_invites enable row level security;

drop policy if exists "Authenticated users can read survey_lead_invites" on public.survey_lead_invites;
create policy "Authenticated users can read survey_lead_invites"
  on public.survey_lead_invites for select to authenticated using (true);

drop policy if exists "Workspace editors can insert survey_lead_invites" on public.survey_lead_invites;
create policy "Workspace editors can insert survey_lead_invites"
  on public.survey_lead_invites for insert to authenticated
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can update survey_lead_invites" on public.survey_lead_invites;
create policy "Workspace editors can update survey_lead_invites"
  on public.survey_lead_invites for update to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'))
  with check (public.current_profile_role() in ('admin', 'marketer'));

drop policy if exists "Workspace editors can delete survey_lead_invites" on public.survey_lead_invites;
create policy "Workspace editors can delete survey_lead_invites"
  on public.survey_lead_invites for delete to authenticated
  using (public.current_profile_role() in ('admin', 'marketer'));
