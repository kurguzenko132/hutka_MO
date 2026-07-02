-- Hutka demo seed
-- Run after supabase/schema.sql only if you want demo contacts and a first working dataset.

insert into public.sources (name, type) values
  ('Instagram Reels', 'social'),
  ('Telegram beauty чат', 'social'),
  ('Партнер beauty-школа', 'partner')
on conflict do nothing;

insert into public.tags (name, color) values
  ('Горячий контакт', 'red'),
  ('Нужны клиенты', 'pink'),
  ('Нет CRM', 'purple'),
  ('Готов к пилоту', 'green'),
  ('Вернуться позже', 'yellow')
on conflict (name) do nothing;

insert into public.funnel_stages (name, type, order_index, color) values
  ('Готов к пилоту', 'master', 8, 'green'),
  ('Кейс', 'master', 9, 'purple')
on conflict do nothing;

do $$
declare
  instagram_source uuid;
  telegram_source uuid;
  found_stage uuid;
  test_stage uuid;
  anna_id uuid;
  salon_id uuid;
  survey_id uuid;
  campaign_id uuid;
  insight_id uuid;
  hypothesis_id uuid;
begin
  select id into instagram_source from public.sources where name in ('Instagram Reels', 'Instagram') order by case when name = 'Instagram Reels' then 0 else 1 end limit 1;
  select id into telegram_source from public.sources where name in ('Telegram beauty чат', 'Telegram') order by case when name = 'Telegram beauty чат' then 0 else 1 end limit 1;
  select id into found_stage from public.funnel_stages where name in ('Найден', 'Найдено') order by order_index limit 1;
  select id into test_stage from public.funnel_stages where name in ('Тест', 'Готов к пилоту') order by order_index limit 1;

  if not exists (select 1 from public.leads where instagram = '@anna.demo.nails') then
    insert into public.leads (name, type, niche, city, instagram, phone, source_id, stage_id, interest_level, priority_score, notes, next_step, next_contact_date)
    values ('Анна Смирнова demo', 'master', 'Маникюр', 'Минск', '@anna.demo.nails', '+375291111111', instagram_source, test_stage, 'hot', 86, 'Демо-контакт: нужны клиенты, записи ведет в Instagram.', 'Отправить персональный опрос', now() + interval '1 day')
    returning id into anna_id;
  else
    select id into anna_id from public.leads where instagram = '@anna.demo.nails' limit 1;
  end if;

  if not exists (select 1 from public.leads where instagram = '@beautyline.demo') then
    insert into public.leads (name, type, niche, city, instagram, source_id, stage_id, interest_level, priority_score, notes, next_step, next_contact_date)
    values ('Beauty Line demo', 'salon', 'Салон красоты', 'Брест', '@beautyline.demo', telegram_source, found_stage, 'warm', 58, 'Демо-салон: хочет понять, даст ли карта новые заявки.', 'Назначить короткий созвон', now() + interval '2 days')
    returning id into salon_id;
  else
    select id into salon_id from public.leads where instagram = '@beautyline.demo' limit 1;
  end if;

  insert into public.lead_interactions (lead_id, type, channel, text, result)
  values
    (anna_id, 'note', 'system', 'Создан демо-контакт для проверки запуска Hutka.', 'demo'),
    (salon_id, 'note', 'system', 'Создан демо-салон для проверки запуска Hutka.', 'demo')
  on conflict do nothing;

  insert into public.tasks (lead_id, title, description, due_date, priority, status)
  values
    (anna_id, 'Отправить опрос Анне', 'Проверить интерес к карте и CRM.', now() + interval '1 day', 'high', 'todo'),
    (salon_id, 'Созвон с Beauty Line', 'Уточнить текущую систему записи и боли.', now() + interval '2 days', 'medium', 'todo')
  on conflict do nothing;

  if not exists (select 1 from public.surveys where slug = 'demo-master-survey') then
    insert into public.surveys (title, type, description, status, slug)
    values ('Демо-опрос для мастера', 'master', 'Короткая форма для проверки боли, записи и интереса к пилоту.', 'active', 'demo-master-survey')
    returning id into survey_id;

    insert into public.survey_questions (survey_id, question_text, question_type, options, order_index, required)
    values
      (survey_id, 'Как сейчас ведете запись?', 'single_choice', '["Instagram Direct", "Telegram", "Блокнот", "CRM", "Другое"]'::jsonb, 1, true),
      (survey_id, 'Какая главная проблема сейчас?', 'long_text', '[]'::jsonb, 2, true),
      (survey_id, 'Готовы протестировать карту мастеров?', 'yes_no', '[]'::jsonb, 3, true);
  else
    select id into survey_id from public.surveys where slug = 'demo-master-survey' limit 1;
  end if;

  if not exists (select 1 from public.campaigns where name = 'Demo: мастера маникюра Минск') then
    insert into public.campaigns (name, goal, channel, city, niche, budget, offer_text, status, start_date, result_notes)
    values ('Demo: мастера маникюра Минск', 'Проверить оффер про заявки с карты', 'Instagram', 'Минск', 'Маникюр', 0, 'Клиенты смогут находить вас на карте и записываться онлайн.', 'active', current_date, 'Демо-кампания для проверки карточки кампании и связей.')
    returning id into campaign_id;
  else
    select id into campaign_id from public.campaigns where name = 'Demo: мастера маникюра Минск' limit 1;
  end if;

  insert into public.campaign_leads (campaign_id, lead_id) values (campaign_id, anna_id) on conflict do nothing;

  if not exists (select 1 from public.insights where title = 'Demo: мастерам важнее заявки, чем CRM') then
    insert into public.insights (title, description, category, evidence, importance)
    values ('Demo: мастерам важнее заявки, чем CRM', 'В коммуникации стоит начинать с ценности карты и новых клиентов, а CRM показывать как инструмент внутри.', 'Маркетинговый вывод', 'Демо-данные: контакт Анна заинтересовалась пилотом из-за нехватки клиентов.', 'high')
    returning id into insight_id;
  else
    select id into insight_id from public.insights where title = 'Demo: мастерам важнее заявки, чем CRM' limit 1;
  end if;

  insert into public.insight_leads (insight_id, lead_id) values (insight_id, anna_id) on conflict do nothing;
  insert into public.insight_campaigns (insight_id, campaign_id) values (insight_id, campaign_id) on conflict do nothing;
  insert into public.insight_surveys (insight_id, survey_id) values (insight_id, survey_id) on conflict do nothing;

  if not exists (select 1 from public.hypotheses where title = 'Demo: оффер про карту даст больше ответов') then
    insert into public.hypotheses (title, description, category, status, test_method, success_metric, evidence_for, evidence_against, result, next_action, confidence)
    values ('Demo: оффер про карту даст больше ответов', 'Предполагаем, что мастера лучше реагируют на новые заявки с карты, чем на описание CRM.', 'Оффер', 'testing', 'Сравнить два сообщения в Instagram: про CRM и про карту.', 'Оффер про карту должен дать минимум x2 ответов.', 'Первые демо-контакты реагируют на заявки.', 'Недостаточно реальных данных.', 'Пока в проверке.', 'Написать 30 мастерам и сравнить ответы.', 'medium')
    returning id into hypothesis_id;
  else
    select id into hypothesis_id from public.hypotheses where title = 'Demo: оффер про карту даст больше ответов' limit 1;
  end if;

  insert into public.hypothesis_leads (hypothesis_id, lead_id) values (hypothesis_id, anna_id) on conflict do nothing;
  insert into public.hypothesis_insights (hypothesis_id, insight_id) values (hypothesis_id, insight_id) on conflict do nothing;
  insert into public.hypothesis_campaigns (hypothesis_id, campaign_id) values (hypothesis_id, campaign_id) on conflict do nothing;
  insert into public.hypothesis_surveys (hypothesis_id, survey_id) values (hypothesis_id, survey_id) on conflict do nothing;
end $$;
