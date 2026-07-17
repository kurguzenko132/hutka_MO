import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['actions', 'app', 'components', 'lib'];
const sourceExtensions = new Set(['.ts', '.tsx']);
const violations = [];

const forbiddenPatterns = [
  { label: 'бесконечный таймер setInterval', pattern: /\bsetInterval\s*\(/ },
  { label: 'постоянный кадровый цикл requestAnimationFrame', pattern: /\brequestAnimationFrame\s*\(/ },
  { label: 'полное обновление router.refresh', pattern: /\brouter\.refresh\s*\(/ },
  { label: 'полная перезагрузка страницы', pattern: /\b(?:window\.)?location\.reload\s*\(/ },
  { label: 'принудительный prefetch', pattern: /\bprefetch\s*=\s*\{\s*true\s*\}/ },
  { label: 'бесконечная pulse-анимация', pattern: /\banimate-pulse\b/ },
  { label: 'дорогой backdrop blur', pattern: /\bbackdrop-blur(?:-[a-z0-9]+)?\b/ },
  { label: 'дорогой большой blur', pattern: /\bblur-(?:2xl|3xl)\b/ },
  { label: 'тяжелая библиотека графиков в клиентском коде', pattern: /from\s+['"]recharts['"]/ },
  { label: 'изображение обходит оптимизацию Next.js', pattern: /\bunoptimized\b/ }
];

function extension(path) {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot) : '';
}

function walk(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

function functionBlock(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) return '';

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}

for (const root of roots) {
  for (const path of walk(root).filter((item) => sourceExtensions.has(extension(item)))) {
    const source = readFileSync(path, 'utf8');
    const lines = source.split('\n');

    for (const rule of forbiddenPatterns) {
      lines.forEach((line, index) => {
        if (rule.pattern.test(line)) {
          violations.push(`${relative('.', path)}:${index + 1} — ${rule.label}`);
        }
      });
    }

    if (path.startsWith('app/')) {
      lines.forEach((line, index) => {
        if (/\bgetLeadOptions\b/.test(line)) {
          violations.push(`${relative('.', path)}:${index + 1} — страница снова загружает весь справочник контактов`);
        }
      });
    }

    if (path.startsWith('actions/')) {
      if (/deferSideEffects\s*\([\s\S]{0,1200}?\brecordActivityLog\s*\(/.test(source)) {
        violations.push(`${relative('.', path)} — отложенный эффект повторно ставит activity log в очередь`);
      }
      if (/after\s*\(\s*async[\s\S]{0,1200}?\brecordActivityLog\s*\(/.test(source)) {
        violations.push(`${relative('.', path)} — вложенный after может потерять activity log`);
      }
    }

    if (path.endsWith('.tsx')) {
      for (const match of source.matchAll(/<form\b[\s\S]*?<\/form>/g)) {
        const form = match[0];
        if (
          /\baction=/.test(form)
          && !/<SubmitButton\b/.test(form)
          && !/<Button[^>]*type=["']submit["']/.test(form)
        ) {
          const line = source.slice(0, match.index).split('\n').length;
          violations.push(`${relative('.', path)}:${line} — server-action форма не показывает состояние отправки`);
        }
      }
    }
  }
}

const taskPage = readFileSync('app/(dashboard)/tasks/page.tsx', 'utf8');
const followUpPage = readFileSync('app/(dashboard)/followups/page.tsx', 'utf8');
const telegramDigest = readFileSync('app/api/telegram/digest/route.ts', 'utf8');
const dashboard = readFileSync('lib/dashboard.ts', 'utf8');
const leadsDirectory = readFileSync('lib/leads.ts', 'utf8');
const reports = readFileSync('lib/reports.ts', 'utf8');
const followUps = readFileSync('lib/followups.ts', 'utf8');
const funnels = readFileSync('lib/funnels.ts', 'utf8');
const campaigns = readFileSync('lib/campaigns.ts', 'utf8');
const surveys = readFileSync('lib/surveys.ts', 'utf8');
const refusals = readFileSync('lib/refusals.ts', 'utf8');
const questionnaires = readFileSync('lib/lead-questionnaires.ts', 'utf8');
const activityLog = readFileSync('lib/activity-log.ts', 'utf8');
const quality = readFileSync('lib/quality.ts', 'utf8');
const launch = readFileSync('lib/launch.ts', 'utf8');
const cleanupAction = readFileSync('actions/data-cleanup.actions.ts', 'utf8');
const settingsActions = readFileSync('actions/settings.actions.ts', 'utf8');
const leadActions = readFileSync('actions/leads.actions.ts', 'utf8');
const taskActions = readFileSync('actions/tasks.actions.ts', 'utf8');
const funnelActions = readFileSync('actions/funnels.actions.ts', 'utf8');
const leadQuestionnaireActions = readFileSync('actions/lead-questionnaires.actions.ts', 'utf8');
const cleanupMigration = readFileSync('supabase/step54-atomic-workspace-cleanup.sql', 'utf8');
const sourceMergeMigration = readFileSync('supabase/step55-atomic-source-merge.sql', 'utf8');
const atomicLeadSaveMigration = readFileSync('supabase/step56-atomic-lead-save.sql', 'utf8');
const atomicTaskCreateMigration = readFileSync('supabase/step57-atomic-task-create.sql', 'utf8');
const atomicLeadActionMigration = readFileSync('supabase/step58-atomic-lead-action.sql', 'utf8');
const atomicFunnelMoveMigration = readFileSync('supabase/step59-atomic-funnel-move.sql', 'utf8');
const atomicQuestionnaireCreateMigration = readFileSync('supabase/step60-atomic-lead-questionnaire-create.sql', 'utf8');
const schema = readFileSync('supabase/schema.sql', 'utf8');
const settingsPage = readFileSync('app/(dashboard)/settings/page.tsx', 'utf8');
const settingsDirectoryWorkspace = readFileSync('components/settings/settings-directory-workspace.tsx', 'utf8');
const settingsGeneralWorkspace = readFileSync('components/settings/settings-general-workspace.tsx', 'utf8');
const refusalActions = readFileSync('actions/refusals.actions.ts', 'utf8');
const refusalReasonsPage = readFileSync('app/(dashboard)/settings/refusal-reasons/page.tsx', 'utf8');
const refusalReasonsWorkspace = readFileSync('components/settings/refusal-reasons-workspace.tsx', 'utf8');
const templateActions = readFileSync('actions/message-templates.actions.ts', 'utf8');
const templatesPage = readFileSync('app/(dashboard)/settings/message-templates/page.tsx', 'utf8');
const templateDetailPage = readFileSync('app/(dashboard)/settings/message-templates/[id]/page.tsx', 'utf8');
const templatesWorkspace = readFileSync('components/settings/message-templates-workspace.tsx', 'utf8');
const templateDetailWorkspace = readFileSync('components/settings/message-template-detail-workspace.tsx', 'utf8');
const questionPackActions = readFileSync('actions/question-packs.actions.ts', 'utf8');
const questionPacksPage = readFileSync('app/(dashboard)/settings/question-packs/page.tsx', 'utf8');
const questionPackDetailPage = readFileSync('app/(dashboard)/settings/question-packs/[id]/page.tsx', 'utf8');
const questionPacksWorkspace = readFileSync('components/settings/question-packs-workspace.tsx', 'utf8');
const questionPackDetailWorkspace = readFileSync('components/settings/question-pack-detail-workspace.tsx', 'utf8');
const profileActions = readFileSync('actions/profile.actions.ts', 'utf8');
const telegramActions = readFileSync('actions/telegram.actions.ts', 'utf8');
const telegramLib = readFileSync('lib/telegram.ts', 'utf8');
const profilePage = readFileSync('app/(dashboard)/profile/page.tsx', 'utf8');
const profileWorkspace = readFileSync('components/profile/profile-workspace.tsx', 'utf8');
const telegramSettingsPage = readFileSync('app/(dashboard)/settings/telegram/page.tsx', 'utf8');
const telegramTestWorkspace = readFileSync('components/settings/telegram-test-workspace.tsx', 'utf8');
const insightActions = readFileSync('actions/insights.actions.ts', 'utf8');
const insightDetailPage = readFileSync('app/(dashboard)/insights/[id]/page.tsx', 'utf8');
const insightDetailWorkspace = readFileSync('components/insights/insight-detail-workspace.tsx', 'utf8');
const surveyActions = readFileSync('actions/surveys.actions.ts', 'utf8');
const surveyDetailPage = readFileSync('app/(dashboard)/surveys/[id]/page.tsx', 'utf8');
const surveyQuestionWorkspace = readFileSync('components/surveys/add-survey-question-form.tsx', 'utf8');
const surveyMetadataWorkspace = readFileSync('components/surveys/survey-metadata-workspace.tsx', 'utf8');
const campaignActions = readFileSync('actions/campaigns.actions.ts', 'utf8');
const campaignDetailPage = readFileSync('app/(dashboard)/campaigns/[id]/page.tsx', 'utf8');
const campaignWorkspace = readFileSync('components/campaigns/campaign-contacts-workspace.tsx', 'utf8');
const sidebar = readFileSync('components/layout/sidebar.tsx', 'utf8');
const topbar = readFileSync('components/layout/topbar.tsx', 'utf8');
const globals = readFileSync('app/globals.css', 'utf8');

if (/\bgetTasks\s*\(/.test(taskPage)) {
  violations.push('app/(dashboard)/tasks/page.tsx — список задач снова загружает все строки');
}
if (/\bgetTasks\s*\(/.test(dashboard)) {
  violations.push('lib/dashboard.ts — главная снова загружает все задачи');
}
if (/\bgetTasks\s*\(/.test(reports)) {
  violations.push('lib/reports.ts — отчет снова загружает все задачи вместо агрегатов');
}
if (/\bgetFollowUpRecommendations\s*\(/.test(followUpPage)) {
  violations.push('app/(dashboard)/followups/page.tsx — страница снова загружает все рекомендации');
}
if (/\bgetFollowUpRecommendations\b/.test(telegramDigest)) {
  violations.push('app/api/telegram/digest/route.ts — Telegram-дайджест снова загружает все рекомендации');
}
if (!followUps.includes("rpc('get_followup_recommendations_page'")) {
  violations.push('lib/followups.ts — отсутствует серверная пагинация рекомендаций');
}
if (!leadsDirectory.includes('items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize)')) {
  violations.push('lib/leads.ts — fallback каталога снова передает в RSC всю базу контактов');
}
if (!followUps.includes('recommendations: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)')) {
  violations.push('lib/followups.ts — fallback рекомендаций снова передает в RSC весь список');
}
if (!funnels.includes("rpc('get_funnel_board_page'") || !funnels.includes("rpc('get_funnel_stage_page'")) {
  violations.push('lib/funnels.ts — воронка снова загружает все карточки без серверной пагинации');
}
if (!campaigns.includes("rpc('get_campaign_summaries'")) {
  violations.push('lib/campaigns.ts — список кампаний снова загружает все связанные контакты');
}
if (!campaigns.includes("rpc('get_campaign_detail_page'")) {
  violations.push('lib/campaigns.ts — карточка кампании снова загружает все контакты');
}
if (!surveys.includes("rpc('get_survey_summaries'")) {
  violations.push('lib/surveys.ts — список анкет снова загружает все ответы ради счетчиков');
}
if (!surveys.includes("rpc('get_survey_response_page'")) {
  violations.push('lib/surveys.ts — карточка анкеты снова загружает все ответы');
}
if (!reports.includes("rpc('get_report_lead_aggregates'")) {
  violations.push('lib/reports.ts — отчеты снова рассчитываются по полной таблице контактов');
}
if (!refusals.includes("rpc('get_refusal_analytics'")) {
  violations.push('lib/refusals.ts — причины отказов снова загружают все контакты');
}
if (
  !questionnaires.includes("rpc('get_lead_questionnaire_summaries'")
  || !questionnaires.includes("rpc('get_lead_questionnaire_response_preview'")
) {
  violations.push('lib/lead-questionnaires.ts — персональные анкеты снова передают всю историю ответов');
}
if (!activityLog.includes('.range(') || !activityLog.includes('{ count: \'exact\' }')) {
  violations.push('lib/activity-log.ts — журнал действий снова не использует пагинацию');
}
if (!quality.includes("rpc('get_contact_duplicate_groups'")) {
  violations.push('lib/quality.ts — проверка дублей снова передает все контактные поля');
}
if (!quality.includes('getDatabaseTableCounts(') || !launch.includes('getDatabaseTableCounts(')) {
  violations.push('lib/quality.ts / lib/launch.ts — таблицы снова проверяются последовательными запросами');
}
if (!cleanupAction.includes("rpc('reset_workspace_data'")) {
  violations.push('actions/data-cleanup.actions.ts — очистка базы снова выполняется сетевым запросом для каждой таблицы');
}
if (/\.delete\(\)\.neq\(['"]id['"]/.test(cleanupAction)) {
  violations.push('actions/data-cleanup.actions.ts — очистка снова предполагает поле id во всех таблицах связей');
}
if (
  !cleanupMigration.includes('security definer')
  || !cleanupMigration.includes('grant execute on function public.reset_workspace_data(text, uuid) to service_role')
  || !cleanupMigration.includes('revoke all on function public.reset_workspace_data(text, uuid) from authenticated')
) {
  violations.push('supabase/step54-atomic-workspace-cleanup.sql — атомарная очистка имеет небезопасные права');
}
if (!settingsActions.includes("rpc('merge_duplicate_sources'")) {
  violations.push('actions/settings.actions.ts — объединение источников снова выполняет несколько сетевых циклов');
}
if (
  !sourceMergeMigration.includes('security invoker')
  || !sourceMergeMigration.includes('grant execute on function public.merge_duplicate_sources(uuid) to authenticated, service_role')
) {
  violations.push('supabase/step55-atomic-source-merge.sql — объединение источников не сохраняет RLS-права');
}
const createLeadBlock = functionBlock(leadActions, 'createLeadAction');
const updateLeadBlock = functionBlock(leadActions, 'updateLeadAction');
if (
  !leadActions.includes("rpc('save_lead_with_tags'")
  || !createLeadBlock.includes('saveLeadWithTagsRpc(')
  || !updateLeadBlock.includes('saveLeadWithTagsRpc(')
  || createLeadBlock.indexOf('saveLeadWithTagsRpc(') > createLeadBlock.indexOf('findDuplicateLead(')
  || updateLeadBlock.indexOf('saveLeadWithTagsRpc(') > updateLeadBlock.indexOf('findDuplicateLead(')
) {
  violations.push('actions/leads.actions.ts — сохранение контакта снова начинает с каскада сетевых запросов');
}
if (
  !atomicLeadSaveMigration.includes('security invoker')
  || !atomicLeadSaveMigration.includes('insert into public.lead_interactions')
  || !atomicLeadSaveMigration.includes('insert into public.activity_logs')
  || !atomicLeadSaveMigration.includes('grant execute on function public.save_lead_with_tags(')
  || !atomicLeadSaveMigration.includes('to authenticated, service_role')
  || !atomicLeadSaveMigration.includes('from anon')
) {
  violations.push('supabase/step56-atomic-lead-save.sql — атомарное сохранение контакта неполное или имеет небезопасные права');
}
if (!schema.includes('create or replace function public.save_lead_with_tags(')) {
  violations.push('supabase/schema.sql — отсутствует атомарное сохранение контакта из Step 56');
}
const createTaskBlock = functionBlock(taskActions, 'createTaskAction');
if (
  !taskActions.includes("rpc('create_task_with_assignees'")
  || !createTaskBlock.includes('createTaskWithAssigneesRpc(')
  || createTaskBlock.indexOf('createTaskWithAssigneesRpc(') > createTaskBlock.indexOf('getExistingProfileIds(')
) {
  violations.push('actions/tasks.actions.ts — создание задачи снова начинает с отдельных проверок контакта и участников');
}
if (
  !atomicTaskCreateMigration.includes('security invoker')
  || !atomicTaskCreateMigration.includes('insert into public.task_assignees')
  || !atomicTaskCreateMigration.includes('insert into public.lead_interactions')
  || !atomicTaskCreateMigration.includes('insert into public.activity_logs')
  || !atomicTaskCreateMigration.includes('grant execute on function public.create_task_with_assignees(')
  || !atomicTaskCreateMigration.includes('to authenticated, service_role')
  || !atomicTaskCreateMigration.includes('from anon')
) {
  violations.push('supabase/step57-atomic-task-create.sql — атомарное создание задачи неполное или имеет небезопасные права');
}
if (!schema.includes('create or replace function public.create_task_with_assignees(')) {
  violations.push('supabase/schema.sql — отсутствует атомарное создание задачи из Step 57');
}
if (
  !leadActions.includes("rpc('schedule_lead_action'")
  || !leadActions.includes('const atomicResult = await scheduleLeadActionRpc(')
) {
  violations.push('actions/leads.actions.ts — планирование действия снова использует несколько сетевых раундов');
}
if (
  !atomicLeadActionMigration.includes('security invoker')
  || !atomicLeadActionMigration.includes('update public.leads')
  || !atomicLeadActionMigration.includes('insert into public.tasks')
  || !atomicLeadActionMigration.includes('insert into public.lead_interactions')
  || !atomicLeadActionMigration.includes('insert into public.activity_logs')
  || !atomicLeadActionMigration.includes('grant execute on function public.schedule_lead_action(')
  || !atomicLeadActionMigration.includes('to authenticated, service_role')
  || !atomicLeadActionMigration.includes('from anon')
) {
  violations.push('supabase/step58-atomic-lead-action.sql — планирование действия неполное или имеет небезопасные права');
}
if (!schema.includes('create or replace function public.schedule_lead_action(')) {
  violations.push('supabase/schema.sql — отсутствует атомарное планирование действия из Step 58');
}
if (!funnelActions.includes("rpc('move_lead_to_stage'")) {
  violations.push('actions/funnels.actions.ts — drag-and-drop снова сохраняет стадию и историю раздельно');
}
if (
  !atomicFunnelMoveMigration.includes('security invoker')
  || !atomicFunnelMoveMigration.includes('update public.leads')
  || !atomicFunnelMoveMigration.includes('insert into public.lead_interactions')
  || !atomicFunnelMoveMigration.includes('insert into public.activity_logs')
  || !atomicFunnelMoveMigration.includes('grant execute on function public.move_lead_to_stage(')
  || !atomicFunnelMoveMigration.includes('to authenticated, service_role')
  || !atomicFunnelMoveMigration.includes('from anon')
) {
  violations.push('supabase/step59-atomic-funnel-move.sql — перенос воронки неполный или имеет небезопасные права');
}
if (!schema.includes('create or replace function public.move_lead_to_stage(')) {
  violations.push('supabase/schema.sql — отсутствует атомарный перенос воронки из Step 59');
}
const deleteLeadBlock = functionBlock(leadActions, 'deleteLeadAction');
if (
  !deleteLeadBlock.includes(".from('leads')\n    .delete()")
  || !deleteLeadBlock.includes(".select('id,name')")
) {
  violations.push('actions/leads.actions.ts — удаление контакта снова делает предварительный select');
}
if (!leadQuestionnaireActions.includes("rpc('create_lead_questionnaire_with_questions'")) {
  violations.push('actions/lead-questionnaires.actions.ts — персональные вопросы снова создаются несколькими сетевыми раундами');
}
if (
  !atomicQuestionnaireCreateMigration.includes('security invoker')
  || !atomicQuestionnaireCreateMigration.includes('insert into public.lead_questionnaires')
  || !atomicQuestionnaireCreateMigration.includes('insert into public.lead_questionnaire_questions')
  || !atomicQuestionnaireCreateMigration.includes('insert into public.lead_interactions')
  || !atomicQuestionnaireCreateMigration.includes('insert into public.activity_logs')
  || !atomicQuestionnaireCreateMigration.includes('grant execute on function public.create_lead_questionnaire_with_questions(')
  || !atomicQuestionnaireCreateMigration.includes('to authenticated, service_role')
  || !atomicQuestionnaireCreateMigration.includes('from anon')
) {
  violations.push('supabase/step60-atomic-lead-questionnaire-create.sql — создание персональных вопросов неполное или имеет небезопасные права');
}
if (!schema.includes('create or replace function public.create_lead_questionnaire_with_questions(')) {
  violations.push('supabase/schema.sql — отсутствует атомарное создание персональных вопросов из Step 60');
}
if (
  !settingsPage.includes('<SettingsGeneralWorkspace')
  || !settingsPage.includes('<SettingsDirectoryWorkspace')
) {
  violations.push('app/(dashboard)/settings/page.tsx — настройки снова обновляют всю страницу после каждого действия');
}
if (
  !settingsDirectoryWorkspace.includes('createSourceMutation')
  || !settingsDirectoryWorkspace.includes('updateStageMutation')
  || !settingsDirectoryWorkspace.includes('deleteTagMutation')
  || !settingsDirectoryWorkspace.includes('pendingRef')
) {
  violations.push('components/settings/settings-directory-workspace.tsx — справочники потеряли локальные mutations или защиту от повторного нажатия');
}
if (
  !settingsGeneralWorkspace.includes('updateAppSettingsMutation')
  || !settingsGeneralWorkspace.includes('updateProfileRoleMutation')
  || !settingsGeneralWorkspace.includes('pendingRef')
) {
  violations.push('components/settings/settings-general-workspace.tsx — базовые настройки или роли снова используют полную навигацию');
}
if (
  !settingsActions.includes('createSourceMutation')
  || !settingsActions.includes('createStageMutation')
  || !settingsActions.includes('createTagMutation')
  || !settingsActions.includes('updateAppSettingsMutation')
  || !settingsActions.includes('updateProfileRoleMutation')
) {
  violations.push('actions/settings.actions.ts — отсутствуют возвращающие результат mutations для настроек');
}
for (const mutationName of [
  'updateAppSettingsMutation',
  'createSourceMutation',
  'updateSourceMutation',
  'deleteSourceMutation',
  'mergeDuplicateSourcesMutation',
  'createStageMutation',
  'updateStageMutation',
  'deleteStageMutation',
  'createTagMutation',
  'updateTagMutation',
  'deleteTagMutation',
  'updateProfileRoleMutation'
]) {
  const block = functionBlock(settingsActions, mutationName);
  if (!block || block.includes('redirect(') || block.includes('revalidatePath(') || block.includes('revalidateSettings(')) {
    violations.push(`actions/settings.actions.ts — ${mutationName} снова инициирует полную навигацию или RSC refresh`);
  }
}
for (const [source, mutationNames, label] of [
  [refusalActions, [
    'createRefusalReasonMutation',
    'updateRefusalReasonMutation',
    'deleteRefusalReasonMutation'
  ], 'actions/refusals.actions.ts'],
  [templateActions, [
    'createMessageTemplateMutation',
    'updateMessageTemplateMutation',
    'deleteMessageTemplateMutation'
  ], 'actions/message-templates.actions.ts'],
  [questionPackActions, [
    'createQuestionPackMutation',
    'updateQuestionPackMutation',
    'deleteQuestionPackMutation',
    'addQuestionToPackMutation',
    'updateQuestionPackQuestionMutation',
    'deleteQuestionPackQuestionMutation'
  ], 'actions/question-packs.actions.ts'],
  [profileActions, [
    'updateOwnProfileMutation'
  ], 'actions/profile.actions.ts'],
  [telegramActions, [
    'sendOwnTelegramTestMutation',
    'sendTelegramBroadcastTestMutation',
    'sendTelegramQuickTestMutation'
  ], 'actions/telegram.actions.ts'],
  [insightActions, [
    'updateInsightMutation',
    'deleteInsightMutation'
  ], 'actions/insights.actions.ts'],
  [surveyActions, [
    'addSurveyQuestionMutationAction',
    'deleteSurveyQuestionMutationAction',
    'updateSurveyMetadataMutation',
    'deleteSurveyMutation'
  ], 'actions/surveys.actions.ts'],
  [campaignActions, [
    'addLeadToCampaignMutationAction',
    'removeLeadFromCampaignMutationAction',
    'updateCampaignResultMutationAction',
    'updateCampaignMetadataMutation',
    'deleteCampaignMutation'
  ], 'actions/campaigns.actions.ts']
]) {
  for (const mutationName of mutationNames) {
    const block = functionBlock(source, mutationName);
    if (!block || block.includes('redirect(') || block.includes('revalidatePath(') || block.includes('revalidateRefusals(') || block.includes('revalidateTemplates(') || block.includes('revalidateQuestionPacks(')) {
      violations.push(`${label} — ${mutationName} снова инициирует полную навигацию или RSC refresh`);
    }
  }
}
if (
  !profilePage.includes('<ProfileWorkspace')
  || !profileWorkspace.includes('updateOwnProfileMutation')
  || !profileWorkspace.includes('publishProfilePresentation')
  || !profileWorkspace.includes('pendingRef')
) {
  violations.push('profile — профиль снова использует полную навигацию или не синхронизирует оболочку');
}
if (
  !insightDetailPage.includes('<InsightDetailWorkspace')
  || !insightDetailWorkspace.includes('updateInsightMutation')
  || !insightDetailWorkspace.includes('deleteInsightMutation')
  || !insightDetailWorkspace.includes('pendingRef')
) {
  violations.push('insights/[id] — карточка вывода снова использует полную навигацию для редактирования');
}
if (
  !surveyDetailPage.includes('<SurveyMetadataProvider')
  || !surveyDetailPage.includes('<SurveyMetadataWorkspace')
  || !surveyMetadataWorkspace.includes('updateSurveyMetadataMutation')
  || !surveyMetadataWorkspace.includes('deleteSurveyMutation')
  || !surveyMetadataWorkspace.includes('pendingRef')
) {
  violations.push('surveys/[id] — настройки анкеты снова используют полную навигацию');
}
if (
  surveyActions.includes('surveyExists(')
  || !surveyQuestionWorkspace.includes('orderIndex: draft.orderIndex')
  || !surveyQuestionWorkspace.includes('pendingRef')
) {
  violations.push('survey questions — добавление вопроса снова делает existence-запрос или допускает повторное нажатие');
}
if (
  !campaignDetailPage.includes('<CampaignMetadataHeader')
  || !campaignDetailPage.includes('<CampaignOverview')
  || !campaignDetailPage.includes('<CampaignMetadataForm')
  || !campaignDetailPage.includes('<CampaignDeleteForm')
  || !campaignWorkspace.includes('updateCampaignMetadataMutation')
  || !campaignWorkspace.includes('pendingRef')
) {
  violations.push('campaigns/[id] — метаданные кампании снова используют полную навигацию или допускают повторную запись');
}
if (
  campaignActions.includes('campaignResult')
  || !campaignActions.includes('const [leadResult, relationResult] = await Promise.all([')
) {
  violations.push('actions/campaigns.actions.ts — добавление контакта снова последовательно проверяет кампанию перед связью');
}
if (
  !telegramSettingsPage.includes('<TelegramTestWorkspace')
  || !telegramTestWorkspace.includes('sendTelegramBroadcastTestMutation')
  || !telegramTestWorkspace.includes('sendTelegramQuickTestMutation')
  || !telegramTestWorkspace.includes('pendingRef')
) {
  violations.push('settings/telegram — Telegram-тесты снова используют полную навигацию');
}
if (!sidebar.includes('useProfilePresentation') || !topbar.includes('useProfilePresentation')) {
  violations.push('layout — изменение профиля больше не обновляет sidebar и topbar локально');
}
const telegramBroadcastBlock = functionBlock(telegramLib, 'sendWorkspaceTelegramNotification');
if (
  !telegramBroadcastBlock
  || telegramBroadcastBlock.indexOf('isSupabaseServiceConfigured()') < 0
  || telegramBroadcastBlock.indexOf('const recipients = await getTelegramRecipients();') < 0
  || telegramBroadcastBlock.indexOf('isSupabaseServiceConfigured()') > telegramBroadcastBlock.indexOf('const recipients = await getTelegramRecipients();')
) {
  violations.push('lib/telegram.ts — список Telegram-получателей запрашивается до проверки service role');
}
if (
  !refusalReasonsPage.includes('<RefusalReasonsWorkspace')
  || !refusalReasonsWorkspace.includes('pendingRef')
  || !refusalReasonsWorkspace.includes('deleteRefusalReasonMutation')
) {
  violations.push('settings/refusal-reasons — причины отказа снова используют полную навигацию');
}
if (
  !templatesPage.includes('<MessageTemplatesWorkspace')
  || !templateDetailPage.includes('<MessageTemplateDetailWorkspace')
  || !templatesWorkspace.includes('createMessageTemplateMutation')
  || !templateDetailWorkspace.includes('updateMessageTemplateMutation')
) {
  violations.push('settings/message-templates — шаблоны сообщений снова используют полную навигацию');
}
if (
  !questionPacksPage.includes('<QuestionPacksWorkspace')
  || !questionPackDetailPage.includes('<QuestionPackDetailWorkspace')
  || !questionPacksWorkspace.includes('createQuestionPackMutation')
  || !questionPackDetailWorkspace.includes('updateQuestionPackQuestionMutation')
) {
  violations.push('settings/question-packs — готовые вопросы снова используют полную навигацию');
}
if (refusalActions.includes('refusalReasonExists(')) {
  violations.push('actions/refusals.actions.ts — CRUD причин отказа снова делает предварительный existence-запрос');
}
if (templateActions.includes('templateExists(')) {
  violations.push('actions/message-templates.actions.ts — CRUD шаблонов снова делает предварительный existence-запрос');
}
if (questionPackActions.includes('packExists(') || questionPackActions.includes('packQuestionExists(')) {
  violations.push('actions/question-packs.actions.ts — CRUD готовых вопросов снова делает предварительный existence-запрос');
}
if (!globals.includes('content-visibility: auto')) {
  violations.push('app/globals.css — отсутствует content-visibility для длинных списков');
}
if (!globals.includes('backdrop-filter: none !important')) {
  violations.push('app/globals.css — отсутствует защита от дорогого backdrop-filter');
}
if (!globals.includes('transition-duration: 80ms !important')) {
  violations.push('app/globals.css — отсутствует ограничение длинных transition');
}

if (violations.length > 0) {
  console.error(`Performance audit failed (${violations.length}):`);
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Performance audit passed.');
}
