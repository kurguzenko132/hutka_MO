import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath, outputPath, sqlPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !sqlPath) {
  throw new Error('Usage: node scripts/build-individual-master-survey.mjs <source.md> <survey.json> <load.sql>');
}

const translit = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

function key(value, fallback) {
  const latin = value.toLowerCase().split('').map((char) => translit[char] ?? char).join('');
  const normalized = latin.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return normalized && /^[a-z]/.test(normalized) ? normalized : `${fallback}_${normalized || 'value'}`;
}

const keyOverrides = {
  '1': 'work_format', '2': 'specializations', '3': 'city', '4': 'experience', '5': 'clients_per_month', '6': 'schedule_occupancy', '7': 'current_priorities',
  '8': 'client_sources', '9': 'booking_channels', '10': 'schedule_storage', '11': 'self_booking', '12': 'booking_confirmation', '13': 'booking_reminders', '14': 'late_cancellations', '15': 'no_shows', '16': 'prepayment', '17': 'client_data_storage', '18': 'client_data_saved', '19': 'income_tracking', '20': 'admin_time', '21': 'booking_service',
  '22А': 'other_service_name', '23А': 'service_duration', '24А': 'service_features', '25А': 'service_satisfaction', '26А': 'service_dislikes', '27А': 'service_price', '28А': 'service_switch_interest', '29А': 'service_switch_conditions',
  '22Б': 'no_service_reasons', '23Б': 'service_previous_experience', '24Б': 'service_stopped_reasons', '25Б': 'service_try_trigger',
  '30': 'work_problems', '31': 'top_problems', '32': 'main_problem', '33': 'problem_impact', '34': 'problem_importance', '35': 'hutka_familiarity',
  '36': 'hutka_usefulness', '37': 'needed_features', '38': 'main_feature', '39': 'adoption_barriers', '40': 'demo_interest', '41': 'test_interest',
  '36Д': 'demo_clarity', '37Д': 'demo_useful_features', '38Д': 'demo_difficulties', '39Д': 'demo_missing_features', '40Д': 'demo_comparison', '41Д': 'demo_try_interest', '42Д': 'demo_try_conditions',
  '36Т': 'test_duration', '37Т': 'test_actions', '38Т': 'test_difficulty_stage', '39Т': 'test_main_difficulty', '40Т': 'test_errors', '41Т': 'test_best_feature', '42Т': 'test_missing_feature', '43Т': 'test_usability', '44Т': 'continue_using_hutka', '45Т': 'test_needed_changes', '46Т': 'recommendation_probability',
  '47': 'willingness_to_pay', '48': 'acceptable_price', '49': 'payment_format', '50': 'next_interest', '51': 'contact_permission', '52': 'contact_method', '53': 'contact_value', '54': 'contact_time'
};

const required = new Set(['work_format', 'specializations', 'city', 'booking_channels', 'booking_service', 'work_problems', 'hutka_familiarity', 'contact_permission']);
const maxSelections = { current_priorities: 3, service_try_trigger: 3, top_problems: 3, needed_features: 5 };

function typeFor(raw) {
  const value = raw.toLowerCase();
  if (value.includes('несколько')) return 'multiple_choice';
  if (value.includes('шкала')) return 'scale';
  if (value.includes('короткий') || value.includes('выбор города')) return 'short_text';
  if (value.includes('открытый')) return 'long_text';
  return 'single_choice';
}

function parseQuestion(header, body) {
  const [, number, title] = header.match(/^##\s+([^.]*)\.\s*(.+)$/) ?? [];
  if (!number || !title) return null;
  const typeLine = body.find((line) => /^\*\*Тип:\*\*/.test(line)) ?? '**Тип:** один вариант.';
  const type = typeFor(typeLine);
  const questionKey = keyOverrides[number] ?? `question_${key(number, 'item')}`;
  const options = body
    .filter((line) => /^\* /.test(line))
    .map((line, index) => line.replace(/^\* /, '').trim())
    .filter((line) => !line.startsWith('Если ') && !line.startsWith('показать ') && !line.startsWith('Показывать '))
    .map((label, index) => ({ key: key(label, `option_${index + 1}`), label }));
  const result = { key: questionKey, type, title: title.replace(/\*\*/g, ''), ...(required.has(questionKey) ? { required: true } : {}) };
  if (options.length && !['short_text', 'long_text'].includes(type)) result.options = options;
  if (type === 'scale') result.settings = questionKey === 'recommendation_probability' ? { min: 0, max: 10, step: 1 } : { min: 1, max: 5, step: 1 };
  if (maxSelections[questionKey]) result.validation = { maxSelections: maxSelections[questionKey] };
  return result;
}

const source = readFileSync(inputPath, 'utf8').replace(/\r/g, '');
const lines = source.split('\n');
const sections = [];
let section = null;

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index].trim();
  if (/^# (Блок|Ветка)/.test(line)) {
    section = { key: key(line.replace(/^# /, ''), `section_${sections.length + 1}`), title: line.replace(/^# /, ''), questions: [] };
    sections.push(section);
    continue;
  }
  if (!section || !/^##\s+[^.]+\./.test(line)) continue;
  const body = [];
  let cursor = index + 1;
  while (cursor < lines.length && !/^#/.test(lines[cursor].trim())) { body.push(lines[cursor].trim()); cursor += 1; }
  const question = parseQuestion(line, body);
  if (question) section.questions.push(question);
  index = cursor - 1;
}

const byKey = new Map(sections.flatMap((item) => item.questions).map((question) => [question.key, question]));
const optionValue = (questionKey, label) => byKey.get(questionKey)?.options?.find((option) => option.label === label)?.key;
const condition = (question, operator, value) => ({ question, operator, value });
const setVisibility = (questionKey, visibility) => { const question = byKey.get(questionKey); if (question) question.visibility = visibility; };

const serviceValues = ['Да, DIKIDI', 'Да, YCLIENTS', 'Да, другой сервис'].map((label) => optionValue('booking_service', label));
const noServiceValues = ['Пользуюсь только обычным календарём или таблицей', 'Раньше пользовался, но перестал', 'Никогда не пользовался такими сервисами'].map((label) => optionValue('booking_service', label));
sections.find((item) => item.title.includes('Ветка А'))?.questions.forEach((question) => { question.visibility = { any: serviceValues.map((value) => condition('booking_service', 'equals', value)) }; });
sections.find((item) => item.title.includes('Ветка Б'))?.questions.forEach((question) => { question.visibility = { any: noServiceValues.map((value) => condition('booking_service', 'equals', value)) }; });
setVisibility('other_service_name', { all: [condition('booking_service', 'equals', optionValue('booking_service', 'Да, другой сервис'))] });
setVisibility('service_stopped_reasons', { all: [condition('service_previous_experience', 'not_equals', optionValue('service_previous_experience', 'Нет, никогда не пробовал'))] });

const newHutka = ['Раньше ничего не слышал о Hutka', 'Слышал название, но не видел сервис'].map((label) => optionValue('hutka_familiarity', label));
const demoHutka = [optionValue('hutka_familiarity', 'Видел презентацию или демонстрацию')];
const testHutka = ['Зарегистрировался, но почти не пользовался', 'Уже тестировал сервис', 'Уже регулярно использую сервис'].map((label) => optionValue('hutka_familiarity', label));
sections.find((item) => item.title.includes('ещё не видел Hutka'))?.questions.forEach((question) => { question.visibility = { any: newHutka.map((value) => condition('hutka_familiarity', 'equals', value)) }; });
sections.find((item) => item.title.includes('видел демонстрацию Hutka'))?.questions.forEach((question) => { question.visibility = { any: demoHutka.map((value) => condition('hutka_familiarity', 'equals', value)) }; });
sections.find((item) => item.title.includes('тестировал Hutka'))?.questions.forEach((question) => { question.visibility = { any: testHutka.map((value) => condition('hutka_familiarity', 'equals', value)) }; });

byKey.get('top_problems').optionsSource = { type: 'selected_answers', question: 'work_problems' };
byKey.get('main_problem').optionsSource = { type: 'selected_answers', question: 'top_problems' };
byKey.get('main_feature').optionsSource = { type: 'selected_answers', question: 'needed_features' };
const priceVisibility = { any: [
  condition('hutka_usefulness', 'greater_or_equal', 4),
  condition('demo_interest', 'in', [optionValue('demo_interest', 'Да'), optionValue('demo_interest', 'Возможно, но сначала хочу узнать больше')]),
  condition('test_interest', 'in', [optionValue('test_interest', 'Да, готов начать в ближайшее время'), optionValue('test_interest', 'Да, но немного позже'), optionValue('test_interest', 'Возможно, после демонстрации')]),
  condition('hutka_familiarity', 'in', testHutka),
  condition('continue_using_hutka', 'in', [optionValue('continue_using_hutka', 'Да, готов пользоваться постоянно'), optionValue('continue_using_hutka', 'Да, если будут исправлены отдельные проблемы'), optionValue('continue_using_hutka', 'Да, если появятся нужные функции')])
] };
['willingness_to_pay', 'acceptable_price', 'payment_format'].forEach((questionKey) => setVisibility(questionKey, priceVisibility));
setVisibility('acceptable_price', { all: [priceVisibility, condition('willingness_to_pay', 'not_equals', optionValue('willingness_to_pay', 'Нет'))] });
['contact_method', 'contact_value', 'contact_time'].forEach((questionKey) => setVisibility(questionKey, { all: [condition('contact_permission', 'equals', optionValue('contact_permission', 'Да'))] }));
byKey.get('city').contactMapping = { field: 'city', mode: 'if_empty' };
byKey.get('contact_value').contactMapping = { field: 'comment', mode: 'always' };

const definition = {
  schemaVersion: '1.0',
  survey: {
    key: 'individual_master_research_2026',
    title: 'Опрос индивидуальных мастеров',
    type: 'Мастера',
    description: 'Понять, как мастера ведут запись, работают с клиентами и оценивают Hutka.',
    startScreen: { title: 'Несколько вопросов о вашей работе', description: 'Здравствуйте! Мы изучаем, как индивидуальные мастера работают с клиентами, ведут запись и организуют расписание. Опрос займет несколько минут; контакт можно оставить только по желанию.' },
    completionScreen: { title: 'Спасибо за ответы!', description: 'Ваш опыт поможет сделать Hutka действительно удобным инструментом для самостоятельных мастеров.' }
  },
  sections,
  classificationRules: [
    { key: 'demo_ready', title: 'Готов к демонстрации', priority: 10, when: { all: [condition('next_interest', 'contains', optionValue('next_interest', 'Посмотреть демонстрацию Hutka')), condition('contact_permission', 'equals', optionValue('contact_permission', 'Да')), condition('contact_value', 'is_answered')] }, actions: [{ type: 'set_contact_status', status: 'interested' }, { type: 'create_task', title: 'Договориться о демонстрации Hutka', dueInDays: 1, priority: 'high' }] },
    { key: 'testing_ready', title: 'Готов тестировать', priority: 20, when: { all: [condition('test_interest', 'in', [optionValue('test_interest', 'Да, готов начать в ближайшее время'), optionValue('test_interest', 'Да, но немного позже')]), condition('contact_permission', 'equals', optionValue('contact_permission', 'Да')), condition('contact_value', 'is_answered')] }, actions: [{ type: 'set_contact_status', status: 'interested' }, { type: 'create_task', title: 'Помочь с регистрацией и настройкой Hutka', dueInDays: 1, priority: 'high' }] },
    { key: 'active_tester', title: 'Тестирует', priority: 30, when: { all: [condition('hutka_familiarity', 'in', testHutka), condition('continue_using_hutka', 'in', [optionValue('continue_using_hutka', 'Да, готов пользоваться постоянно'), optionValue('continue_using_hutka', 'Да, если будут исправлены отдельные проблемы'), optionValue('continue_using_hutka', 'Да, если появятся нужные функции')])] }, actions: [{ type: 'set_contact_status', status: 'testing' }, { type: 'create_task', title: 'Собрать обратную связь по тестированию Hutka', dueInDays: 3, priority: 'medium' }] }
  ]
};

const json = `${JSON.stringify(definition, null, 2)}\n`;
writeFileSync(outputPath, json);
writeFileSync(sqlPath, `-- Deletes only surveys and their dependent survey data.\nbegin;\ndelete from public.surveys;\nselect public.save_survey_builder_definition(null, $survey$${json.trim()}$survey$::jsonb, 'publish', null);\ncommit;\n`);
