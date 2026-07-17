-- Hutka step 53: detect contact duplicates inside PostgreSQL without transferring contact fields.
-- The function runs with caller permissions, preserving existing RLS.

create or replace function public.get_contact_duplicate_groups()
returns table (
  field text,
  value text,
  contacts bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with contact_values as (
    select 'email'::text as field, lower(trim(lead.email)) as value
    from public.leads lead
    where nullif(trim(lead.email), '') is not null
    union all
    select 'phone'::text, lower(trim(lead.phone))
    from public.leads lead
    where nullif(trim(lead.phone), '') is not null
    union all
    select 'instagram'::text, lower(trim(lead.instagram))
    from public.leads lead
    where nullif(trim(lead.instagram), '') is not null
    union all
    select 'telegram'::text, lower(trim(lead.telegram))
    from public.leads lead
    where nullif(trim(lead.telegram), '') is not null
  )
  select
    contact_value.field,
    contact_value.value,
    count(*) as contacts
  from contact_values contact_value
  group by contact_value.field, contact_value.value
  having count(*) > 1
  order by contacts desc, contact_value.field, contact_value.value
  limit 20;
$$;

revoke all on function public.get_contact_duplicate_groups() from public;
grant execute on function public.get_contact_duplicate_groups() to authenticated, service_role;
