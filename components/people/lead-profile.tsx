import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  addLeadInteractionAction,
  attachLeadToCampaignFromProfileAction,
  attachLeadToInsightFromProfileAction,
  createLeadSurveyInviteAction,
  deleteLeadAction
} from '@/actions/leads.actions';
import { createLeadQuestionnaireAction, createLeadQuestionnaireFromPackAction, deleteLeadQuestionnaireAction } from '@/actions/lead-questionnaires.actions';
import { clearLeadRefusalAction, markLeadRefusedAction } from '@/actions/refusals.actions';
import { deleteTaskAction } from '@/actions/tasks.actions';
import { getCampaignOptions, type CampaignOption } from '@/lib/campaigns';
import { needs, surveyAnswers } from '@/lib/data';
import {
  getLeadById,
  getLeadInteractions,
  getLeadRelatedItems,
  getLeadTasks,
  type LeadRelationItem,
  type LeadSurveyResponseGroup
} from '@/lib/leads';
import { getInsightOptions, type InsightOption } from '@/lib/insights';
import { getSurveyOptions, type SurveyOption } from '@/lib/surveys';
import { getLeadQuestionnaires, getLeadQuestionnaireResponses, questionnaireStatusLabel, type LeadQuestionnaireListItem, type LeadQuestionnaireResponseGroup } from '@/lib/lead-questionnaires';
import { getQuestionPacks, type QuestionPack } from '@/lib/question-packs';
import { getRefusalReasons, type RefusalReason } from '@/lib/refusals';
import { getMessageTemplatesForLead } from '@/lib/message-templates';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { MessageTemplatePanel } from '@/components/people/message-template-panel';
import { LeadNextActionCard } from '@/components/people/lead-next-action-card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileQuestion,
  FlaskConical,
  Lightbulb,
  Link2,
  MessageSquare,
  PackageCheck,
  Trash2,
  PlusCircle,
  Save,
  Send
} from 'lucide-react';
import { notFound } from 'next/navigation';

const relationTone: Record<LeadRelationItem['type'], BadgeTone> = {
  campaign: 'purple',
  survey: 'blue',
  insight: 'pink',
  hypothesis: 'yellow'
};

function normalizeLabel(label?: string) {
  const map: Record<string, string> = {
    active: 'Активна',
    draft: 'Черновик',
    paused: 'Пауза',
    finished: 'Завершена',
    low: 'Низкая',
    medium: 'Средняя',
    high: 'Высокая',
    critical: 'Критично',
    new: 'Новая',
    in_review: 'На проверке',
    accepted: 'Принят',
    archived: 'Архив',
    testing: 'В проверке',
    validated: 'Подтверждается',
    invalidated: 'Не подтверждается',
    needs_data: 'Нужно больше данных',
    closed: 'Закрыта'
  };

  return map[label ?? ''] ?? label ?? 'Связано';
}

function toneFromLabel(label?: string): BadgeTone {
  if (['critical', 'invalidated'].includes(label ?? '')) return 'red';
  if (['high', 'accepted', 'validated', 'active'].includes(label ?? '')) return 'green';
  if (['medium', 'testing', 'needs_data', 'paused'].includes(label ?? '')) return 'yellow';
  if (['finished', 'archived', 'closed'].includes(label ?? '')) return 'gray';
  return 'purple';
}

function contactHref(value?: string, type?: 'instagram' | 'telegram' | 'email' | 'phone') {
  if (!value) return undefined;
  if (type === 'email') return `mailto:${value}`;
  if (type === 'phone') return `tel:${value}`;
  if (type === 'telegram') return value.startsWith('@') ? `https://t.me/${value.slice(1)}` : value;
  if (type === 'instagram') return value.startsWith('@') ? `https://instagram.com/${value.slice(1)}` : value;
  return value;
}

function RelationList({ title, empty, items, icon }: { title: string; empty: string; items: LeadRelationItem[]; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
        <Badge tone="gray">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => (
          <Link key={`${item.type}-${item.id}`} href={item.href} className="block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-app-text">{item.title}</p>
                {item.meta && <p className="mt-1 text-sm text-app-muted">{item.meta}</p>}
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-app-faint" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={relationTone[item.type]}>{item.type === 'campaign' ? 'Кампания' : item.type === 'insight' ? 'Вывод' : 'Связь'}</Badge>
              {item.label && <Badge tone={toneFromLabel(item.label)}>{normalizeLabel(item.label)}</Badge>}
            </div>
          </Link>
        )) : <p className="text-sm text-app-muted">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function SurveyRelations({ items }: { items: LeadSurveyResponseGroup[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><FileQuestion className="h-4 w-4 text-app-purple" />Анкеты контакта</CardTitle>
        <Badge tone="gray">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-app-text">{item.title}</p>
                <p className="mt-1 text-sm text-app-muted">{item.respondent || 'Ответ без имени'}{item.contact ? ` · ${item.contact}` : ''}</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-app-faint" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="blue">{item.answersCount} ответов</Badge>
              <Badge tone="gray">{item.date}</Badge>
            </div>
          </Link>
        )) : <p className="text-sm text-app-muted">Пока нет ответов контакта по анкетам.</p>}
      </CardContent>
    </Card>
  );
}

function EmptyOption({ label }: { label: string }) {
  return <option value="">{label}</option>;
}

function RefusalManagementCard({ leadId, lead, reasons }: { leadId: string; lead: NonNullable<Awaited<ReturnType<typeof getLeadById>>>; reasons: RefusalReason[] }) {
  return (
    <Card className={lead.refusalReason ? 'border-red-100 bg-red-50/30' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-app-red" />
          Причина отказа
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lead.refusalReason ? (
          <div className="rounded-2xl border border-red-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="red">{lead.refusalReason}</Badge>
              {lead.refusedAt && <Badge tone="gray">{lead.refusedAt}</Badge>}
            </div>
            {lead.refusalComment && <p className="mt-3 text-sm leading-6 text-app-muted">{lead.refusalComment}</p>}
            <form action={clearLeadRefusalAction} className="mt-4">
              <input type="hidden" name="lead_id" value={leadId} />
              <Button type="submit" size="sm" variant="secondary">Очистить причину</Button>
            </form>
          </div>
        ) : (
          <p className="text-sm leading-6 text-app-muted">Если контакт отказался или ушел в паузу, зафиксируй причину. Потом Hutka покажет аналитику отказов в отчетах и на главной.</p>
        )}

        <form action={markLeadRefusedAction} className="space-y-3 rounded-2xl border border-app-line bg-white p-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <p className="text-sm font-bold text-app-text">Перевести в отказ</p>
          <Select name="reason_id" defaultValue="" required>
            <EmptyOption label={reasons.length ? 'Выбери причину отказа' : 'Причины не настроены'} />
            {reasons.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}
          </Select>
          <Textarea name="refusal_comment" rows={4} placeholder="Комментарий: что именно сказал человек, когда можно вернуться, что могло бы изменить решение" />
          <Button type="submit" variant="danger" className="w-full">
            <AlertTriangle className="h-4 w-4" />
            Зафиксировать отказ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MobileStickyActions({
  instagramHref,
  telegramHref,
  phoneHref,
  emailHref
}: {
  instagramHref?: string;
  telegramHref?: string;
  phoneHref?: string;
  emailHref?: string;
}) {
  const links = [
    instagramHref ? { label: 'Instagram', href: instagramHref, external: true } : null,
    telegramHref ? { label: 'Telegram', href: telegramHref, external: true } : null,
    phoneHref ? { label: 'Телефон', href: phoneHref } : null,
    emailHref ? { label: 'Email', href: emailHref } : null
  ].filter((item): item is { label: string; href: string; external?: boolean } => Boolean(item));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-app-line bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <a href="#next-action" className="flex h-11 items-center justify-center rounded-xl bg-app-purple px-2 text-sm font-black text-white">
          Запланировать
        </a>
        <a href="#lead-questions" className="flex h-11 items-center justify-center rounded-xl border border-app-line bg-white px-2 text-sm font-black text-app-text">
          Вопросы
        </a>
        <details className="relative">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-app-line bg-white px-2 text-sm font-black text-app-text [&::-webkit-details-marker]:hidden">
            Написать
          </summary>
          <div className="absolute bottom-14 right-0 grid min-w-44 gap-2 rounded-2xl border border-app-line bg-white p-3 shadow-card">
            {links.length ? links.map((link) => (
              <a key={link.label} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} className="rounded-xl bg-app-soft px-3 py-2 text-sm font-bold text-app-text">
                {link.label}
              </a>
            )) : (
              <span className="rounded-xl bg-app-soft px-3 py-2 text-sm font-bold text-app-muted">Контакты не указаны</span>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}


function LeadQuestionnairesCard({ items, canManageQuestionnaires = false }: { items: LeadQuestionnaireListItem[]; canManageQuestionnaires?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><FileQuestion className="h-4 w-4 text-app-purple" />Вопросы для контакта</CardTitle>
        <Badge tone="gray">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-app-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-app-text">{item.title}</p>
                <p className="mt-1 text-sm text-app-muted">{item.questionsCount} вопросов · {item.responsesCount} ответов · {item.createdAt}</p>
              </div>
              <Badge tone={item.status === 'active' ? 'green' : item.status === 'closed' ? 'gray' : 'yellow'}>{questionnaireStatusLabel(item.status)}</Badge>
            </div>
            {item.description && <p className="mt-3 text-sm leading-6 text-app-muted">{item.description}</p>}
            <div className="mt-4 rounded-xl bg-app-soft p-3 text-xs font-semibold text-app-muted break-all">
              {item.publicUrl}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary"><a href={item.publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Открыть ссылку</a></Button>
              {canManageQuestionnaires && (
                <form action={deleteLeadQuestionnaireAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="questionnaire_id" value={item.id} />
                  <input type="hidden" name="lead_id" value={item.leadId} />
                  <Input name="confirmation" placeholder="УДАЛИТЬ" className="h-9 w-32 text-xs" />
                  <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" />Удалить</Button>
                </form>
              )}
            </div>
          </div>
        )) : (
          <p className="text-sm text-app-muted">
            {canManageQuestionnaires ? 'Пока нет вопросов для контакта. Создай вопросы ниже и отправь человеку ссылку.' : 'Вопросов для контакта пока нет.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}


function LeadQuestionnaireResponsesCard({ items }: { items: LeadQuestionnaireResponseGroup[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-app-pink" />Ответы контакта</CardTitle>
        <Badge tone="gray">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length ? items.map((group) => (
          <div key={group.id} className="rounded-2xl border border-app-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-app-text">{group.questionnaireTitle}</p>
                <p className="mt-1 text-sm text-app-muted">
                  {group.respondentName || 'Ответ без имени'}{group.respondentContact ? ` · ${group.respondentContact}` : ''} · {group.createdAt}
                </p>
              </div>
              {group.questionnaireUrl && (
                <a href={group.questionnaireUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-app-purple hover:underline">Ссылка</a>
              )}
            </div>
            <div className="mt-4 grid gap-3">
              {group.answers.map((answer) => (
                <div key={`${group.id}-${answer.question}`} className="rounded-xl bg-app-soft p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-app-faint">{answer.question}</p>
                  <p className="mt-1 text-sm font-semibold text-app-text">{answer.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )) : <p className="text-sm text-app-muted">Ответов контакта пока нет.</p>}
      </CardContent>
    </Card>
  );
}


function QuestionPacksCard({ leadId, packs }: { leadId: string; packs: QuestionPack[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-app-purple" />Готовые вопросы</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-app-muted">
          Выбери готовые вопросы — Hutka сразу создаст персональную ссылку. Не нужно каждый раз вручную заполнять анкету для мастера или салона.
        </p>
        <div className="grid gap-3">
          {packs.map((pack) => (
            <form key={pack.id} action={createLeadQuestionnaireFromPackAction} className="rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
              <input type="hidden" name="lead_id" value={leadId} />
              <input type="hidden" name="pack_id" value={pack.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-app-text">{pack.shortTitle}</p>
                    <Badge tone="purple">{pack.badge}</Badge>
                    <Badge tone="gray">{pack.questions.length} вопросов</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{pack.description}</p>
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  <Link2 className="h-4 w-4" />
                  Создать ссылку на вопросы
                </Button>
              </div>
            </form>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonalQuestionnaireBuilder({ leadId, leadName }: { leadId: string; leadName: string }) {
  const questionIndexes = [1, 2, 3, 4, 5];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Вопросы для контакта</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLeadQuestionnaireAction} className="space-y-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-app-text">Название вопросов</span>
              <Input name="title" defaultValue={`Вопросы для ${leadName}`} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-app-text">Описание для человека</span>
              <Input name="description" placeholder="Например: ответьте, чтобы мы подготовили тестирование" />
            </label>
          </div>

          <div className="space-y-3">
            {questionIndexes.map((index) => (
              <div key={index} className="rounded-2xl border border-app-line p-4">
                <p className="mb-3 text-sm font-black text-app-text">Вопрос {index}</p>
                <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
                  <Input name={`lead_question_text_${index}`} placeholder={index === 1 ? 'Например: какая главная проблема с записью?' : 'Текст вопроса'} />
                  <Select name={`lead_question_type_${index}`} defaultValue={index === 1 ? 'long_text' : 'short_text'}>
                    <option value="short_text">Короткий ответ</option>
                    <option value="long_text">Развернутый ответ</option>
                    <option value="yes_no">Да / нет</option>
                    <option value="single_choice">Один вариант</option>
                    <option value="multiple_choice">Несколько вариантов</option>
                    <option value="rating">Оценка</option>
                    <option value="number">Число</option>
                  </Select>
                </div>
                <Textarea name={`lead_question_options_${index}`} className="mt-3" placeholder="Варианты для выбора, если нужны. Каждый вариант с новой строки или через запятую." />
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-app-muted">
                  <input type="checkbox" name={`lead_question_required_${index}`} defaultChecked={index <= 2} className="h-4 w-4" />
                  Обязательный вопрос
                </label>
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full" size="lg">
            <Link2 className="h-4 w-4" />
            Создать ссылку на вопросы
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ContactRelationsHub({
  leadId,
  campaigns,
  insights,
  surveys,
  canManageCampaigns = false,
  canManageSurveys = false,
  canManageInsights = false
}: {
  leadId: string;
  campaigns: CampaignOption[];
  insights: InsightOption[];
  surveys: SurveyOption[];
  canManageCampaigns?: boolean;
  canManageSurveys?: boolean;
  canManageInsights?: boolean;
}) {
  const hasRelationActions = canManageCampaigns || canManageSurveys || canManageInsights;
  if (!hasRelationActions) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-app-purple" />Связи контакта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-app-muted">
          Добавляй контакт в кампании, связывай его с выводами и фиксируй отправку ссылки на анкету прямо из карточки.
        </p>

        {canManageCampaigns && (
          <form action={attachLeadToCampaignFromProfileAction} className="space-y-3 rounded-2xl border border-app-line p-4">
            <input type="hidden" name="lead_id" value={leadId} />
            <p className="text-sm font-bold text-app-text">Добавить в кампанию</p>
            <Select name="campaign_id" defaultValue="" required disabled={campaigns.length === 0}>
              <EmptyOption label={campaigns.length ? 'Выбери кампанию' : 'Кампаний пока нет'} />
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={campaigns.length === 0}>
              <FlaskConical className="h-4 w-4" />
              Привязать к кампании
            </Button>
          </form>
        )}

        {canManageSurveys && (
          <form action={createLeadSurveyInviteAction} className="space-y-3 rounded-2xl border border-app-line p-4">
            <input type="hidden" name="lead_id" value={leadId} />
            <p className="text-sm font-bold text-app-text">Ссылка на анкету</p>
            <Select name="survey_id" defaultValue="" required disabled={surveys.length === 0}>
              <EmptyOption label={surveys.length ? 'Выбери анкету' : 'Анкет пока нет'} />
              {surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}{survey.status !== 'active' ? ' · черновик' : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={surveys.length === 0}>
              <ClipboardList className="h-4 w-4" />
              Создать ссылку на вопросы
            </Button>
          </form>
        )}

        {canManageInsights && (
          <form action={attachLeadToInsightFromProfileAction} className="space-y-3 rounded-2xl border border-app-line p-4">
            <input type="hidden" name="lead_id" value={leadId} />
            <p className="text-sm font-bold text-app-text">Связать с выводом</p>
            <Select name="insight_id" defaultValue="" required disabled={insights.length === 0}>
              <EmptyOption label={insights.length ? 'Выбери вывод' : 'Выводов пока нет'} />
              {insights.map((insight) => <option key={insight.id} value={insight.id}>{insight.name}</option>)}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={insights.length === 0}>
              <Lightbulb className="h-4 w-4" />
              Привязать вывод
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export async function LeadProfile({ id }: { id: string }) {
  const [lead, interactions, tasks, related, campaignOptions, insightOptions, surveyOptions, leadQuestionnaires, leadQuestionnaireResponses, currentUser, refusalReasons] = await Promise.all([
    getLeadById(id),
    getLeadInteractions(id),
    getLeadTasks(id),
    getLeadRelatedItems(id),
    getCampaignOptions(),
    getInsightOptions(),
    getSurveyOptions(),
    getLeadQuestionnaires(id),
    getLeadQuestionnaireResponses(id),
    getCurrentUserContext(),
    getRefusalReasons()
  ]);

  if (!lead) notFound();

  const instagramHref = contactHref(lead.instagram, 'instagram');
  const telegramHref = contactHref(lead.telegram, 'telegram');
  const emailHref = contactHref(lead.email, 'email');
  const phoneHref = contactHref(lead.phone, 'phone');
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageContacts = can(currentRole, 'manageContacts');
  const canManageTasks = can(currentRole, 'manageTasks');
  const canManageCampaigns = can(currentRole, 'manageCampaigns');
  const canManageSurveys = can(currentRole, 'manageSurveys');
  const canManageInsights = can(currentRole, 'manageInsights');
  const canManageSettings = can(currentRole, 'manageSettings');
  const canManageRelations = canManageCampaigns || canManageSurveys || canManageInsights;
  const [questionPacks, messageTemplates] = await Promise.all([
    getQuestionPacks(),
    getMessageTemplatesForLead(lead.type)
  ]);

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[1fr_320px] lg:p-6">
          <div className="min-w-0">
            <p className="mb-2 text-sm text-app-muted">Контакты → {lead.name}</p>
            <h1 className="text-3xl font-black tracking-tight text-app-text">{lead.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={lead.score >= 75 ? 'red' : lead.score >= 45 ? 'yellow' : 'gray'}>{lead.priority} · {lead.score}/100</Badge>
              <Badge tone={lead.stage === 'Отказ' ? 'red' : 'purple'}>{lead.stage}</Badge>
              {lead.refusalReason && <Badge tone="red">Отказ: {lead.refusalReason}</Badge>}
              {lead.tags.length ? lead.tags.map((tag, index) => (
                <Badge key={tag} tone={index === 0 ? 'red' : index === 1 ? 'pink' : index === 2 ? 'purple' : 'green'}>{tag}</Badge>
              )) : <Badge tone="gray">Без тегов</Badge>}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                ['Имя', lead.name],
                ['Тип контакта', lead.type],
                ['Ниша', lead.niche],
                ['Город', lead.city],
                ['Источник', lead.source],
                ['Статус', lead.stage],
                ['Приоритет', `${lead.priority} · ${lead.score}/100`],
                ['Instagram', lead.instagram || '—'],
                ['Telegram', lead.telegram || '—'],
                ['Телефон', lead.phone || '—'],
                ['Email', lead.email || '—'],
                ['Комментарий', lead.notes || '—'],
                ['Теги', lead.tags.length ? lead.tags.join(', ') : '—'],
                ['Последняя активность', interactions[0]?.date || '—'],
                ['Дата создания', lead.createdAt || '—']
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-app-line bg-slate-50/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-app-faint">{label}</p>
                  <p className="mt-1 break-words text-sm font-semibold text-app-text">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-black text-app-text">Быстрые рабочие действия</p>
            {canManageContacts && (
              <Button asChild className="w-full justify-start" variant="secondary">
                <Link href={`/people/${lead.id}/edit`}>
                  <Edit3 className="h-4 w-4" />
                  Редактировать контакт
                </Link>
              </Button>
            )}
            {instagramHref && (
              <Button asChild className="w-full justify-start" variant="secondary">
                <a href={instagramHref} target="_blank" rel="noreferrer"><MessageSquare className="h-4 w-4" /> Instagram</a>
              </Button>
            )}
            {telegramHref && (
              <Button asChild className="w-full justify-start" variant="secondary">
                <a href={telegramHref} target="_blank" rel="noreferrer"><Send className="h-4 w-4" /> Telegram</a>
              </Button>
            )}
            {phoneHref && (
              <Button asChild className="w-full justify-start" variant="secondary">
                <a href={phoneHref}><MessageSquare className="h-4 w-4" /> Телефон</a>
              </Button>
            )}
            {emailHref && (
              <Button asChild className="w-full justify-start" variant="secondary">
                <a href={emailHref}><MessageSquare className="h-4 w-4" /> Email</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div id="next-action" className="scroll-mt-24">
        <LeadNextActionCard lead={lead} tasks={tasks} role={currentRole} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.2fr_1fr]">
        <div className="space-y-6">
          {canManageRelations && (
            <ContactRelationsHub
              leadId={lead.id}
              campaigns={campaignOptions}
              insights={insightOptions}
              surveys={surveyOptions}
              canManageCampaigns={canManageCampaigns}
              canManageSurveys={canManageSurveys}
              canManageInsights={canManageInsights}
            />
          )}

          {canManageContacts && <RefusalManagementCard leadId={lead.id} lead={lead} reasons={refusalReasons} />}

          <MessageTemplatePanel
            lead={{
              name: lead.name,
              type: lead.type,
              niche: lead.niche,
              city: lead.city,
              stage: lead.stage,
              source: lead.source,
              instagram: lead.instagram,
              telegram: lead.telegram,
              phone: lead.phone,
              email: lead.email
            }}
            sender={{
              name: currentUser?.fullName ?? 'Команда Hutka',
              title: currentUser?.jobTitle ?? 'Маркетолог',
              email: currentUser?.email ?? ''
            }}
            templates={messageTemplates}
            canEditTemplates={canManageSettings}
          />
          {canManageContacts && <QuestionPacksCard leadId={lead.id} packs={questionPacks} />}
          <div id="lead-questions" className="scroll-mt-24">
            <LeadQuestionnairesCard items={leadQuestionnaires} canManageQuestionnaires={canManageContacts} />
          </div>
          <LeadQuestionnaireResponsesCard items={leadQuestionnaireResponses} />
          {canManageContacts && <PersonalQuestionnaireBuilder leadId={lead.id} leadName={lead.name} />}
          {canManageContacts && (
            <form action={deleteLeadAction} className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
              <input type="hidden" name="lead_id" value={lead.id} />
              <p className="text-sm font-black text-red-700">Удалить контакт</p>
              <p className="mt-1 text-xs leading-5 text-red-600">Удалятся анкеты, касания и связи контакта. Задачи останутся без привязки к контакту.</p>
              <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" className="mt-3 bg-white" required />
              <Button type="submit" variant="danger" className="mt-3 w-full">
                <Trash2 className="h-4 w-4" />
                Удалить контакт
              </Button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>История активности</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-5">
                {interactions.length ? interactions.map((item, index) => (
                  <div key={item.id} className="relative rounded-2xl border border-app-line bg-white p-4 pl-9">
                    {index < interactions.length - 1 && <span className="absolute left-[17px] top-9 h-full w-px bg-purple-100" />}
                    <span className="absolute left-3 top-5 h-3.5 w-3.5 rounded-full border-2 border-white bg-app-purple shadow" />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-app-faint">{item.date}</p>
                        <p className="mt-1 font-bold text-app-text">{item.title}</p>
                      </div>
                      {(item.channel || item.result) && <Badge tone="gray">{item.channel}{item.result ? ` · ${item.result}` : ''}</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-app-muted">{item.text}</p>
                  </div>
                )) : (
                  <p className="text-sm text-app-muted">
                    {canManageContacts ? 'Пока нет касаний. Добавь первое сообщение, звонок или заметку.' : 'Касаний пока нет.'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {canManageContacts && (
            <Card>
              <CardHeader><CardTitle>Добавить касание</CardTitle></CardHeader>
              <CardContent>
                <form action={addLeadInteractionAction} className="space-y-4">
                  <input type="hidden" name="lead_id" value={lead.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select name="type" defaultValue="note">
                      <option value="note">Заметка</option>
                      <option value="message">Сообщение</option>
                      <option value="call">Звонок</option>
                      <option value="meeting">Встреча</option>
                      <option value="survey_sent">Анкета отправлена</option>
                      <option value="survey_completed">Анкета заполнена</option>
                      <option value="status_change">Изменение статуса</option>
                    </Select>
                    <Input name="channel" placeholder="Канал: Instagram, Telegram..." />
                  </div>
                  <Textarea name="text" placeholder="Что произошло, что ответил контакт, что важно не забыть..." required />
                  <Input name="result" placeholder="Результат: ответил, ждём, отказ, заинтересован..." />
                  <Button type="submit"><Save className="h-4 w-4" />Сохранить касание</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Боли и потребности</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(lead.notes ? [lead.notes] : needs).map((need) => (
                <div key={need} className="flex gap-3 text-sm text-app-text">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-app-pink" />
                  <span>{need}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Задачи по контакту</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {tasks.length ? tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-app-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-app-text">{task.title}</p>
                      {task.description && <p className="mt-1 text-sm text-app-muted">{task.description}</p>}
                    </div>
                    <Badge tone={task.priority === 'Срочно' || task.priority === 'Высокий' ? 'red' : task.priority === 'Средний' ? 'yellow' : 'green'}>{task.priority}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-app-faint">{task.status} · {task.dueDate}</p>
                    {canManageTasks && (
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <input type="hidden" name="return_to" value={`/people/${lead.id}`} />
                        <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" />Удалить</Button>
                      </form>
                    )}
                  </div>
                </div>
              )) : <p className="text-sm text-app-muted">Задач по контакту пока нет.</p>}

            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <RelationList title="Кампании" empty="Контакт пока не привязан к кампаниям." items={related.campaigns} icon={<Link2 className="h-4 w-4 text-app-purple" />} />
        <SurveyRelations items={related.surveys} />
        <RelationList title="Выводы" empty="По контакту пока нет выводов." items={related.insights} icon={<Lightbulb className="h-4 w-4 text-app-pink" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Последние ответы на анкеты</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {surveyAnswers.map((answer) => (
            <div key={answer.question} className="rounded-2xl border border-app-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{answer.question}</p>
              <p className="mt-2 text-sm font-semibold text-app-text">{answer.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <MobileStickyActions instagramHref={instagramHref} telegramHref={telegramHref} phoneHref={phoneHref} emailHref={emailHref} />
    </div>
  );
}
