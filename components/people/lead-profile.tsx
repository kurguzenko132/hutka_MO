import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  addLeadInteractionAction,
  attachLeadToCampaignFromProfileAction,
  attachLeadToHypothesisFromProfileAction,
  attachLeadToInsightFromProfileAction,
  createLeadSurveyInviteAction,
  updateLeadFollowUpAction,
  updateLeadStageFromProfileAction,
  deleteLeadAction
} from '@/actions/leads.actions';
import { createLeadQuestionnaireAction, createLeadQuestionnaireFromPackAction, deleteLeadQuestionnaireAction } from '@/actions/lead-questionnaires.actions';
import { clearLeadRefusalAction, markLeadRefusedAction } from '@/actions/refusals.actions';
import { createTaskAction, deleteTaskAction } from '@/actions/tasks.actions';
import { getCampaignOptions, type CampaignOption } from '@/lib/campaigns';
import { needs, surveyAnswers } from '@/lib/data';
import {
  getLeadById,
  getLeadInteractions,
  getLeadRelatedItems,
  getLeadStageOptions,
  getLeadTasks,
  type LeadRelationItem,
  type LeadSurveyResponseGroup
} from '@/lib/leads';
import { getHypothesisOptions, type HypothesisOption } from '@/lib/hypotheses';
import { getInsightOptions, type InsightOption } from '@/lib/insights';
import { getSurveyOptions, type SurveyOption } from '@/lib/surveys';
import { getLeadQuestionnaires, getLeadQuestionnaireResponses, questionnaireStatusLabel, type LeadQuestionnaireListItem, type LeadQuestionnaireResponseGroup } from '@/lib/lead-questionnaires';
import { getQuestionPacks, type QuestionPack } from '@/lib/question-packs';
import { getRefusalReasons, type RefusalReason } from '@/lib/refusals';
import { getMessageTemplatesForLead } from '@/lib/message-templates';
import { getCurrentUserContext } from '@/lib/permissions';
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
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileQuestion,
  Flag,
  FlaskConical,
  Lightbulb,
  Link2,
  MessageSquare,
  MoreVertical,
  PackageCheck,
  Trash2,
  PlusCircle,
  Save,
  Send,
  Sparkles,
  Target,
  TestTube2
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
              <Badge tone={relationTone[item.type]}>{item.type === 'campaign' ? 'Кампания' : item.type === 'insight' ? 'Инсайт' : 'Гипотеза'}</Badge>
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
        <CardTitle className="flex items-center gap-2"><FileQuestion className="h-4 w-4 text-app-purple" />Опросы контакта</CardTitle>
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
        )) : <p className="text-sm text-app-muted">Пока нет связанных ответов на опросы.</p>}
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


function LeadQuestionnairesCard({ items }: { items: LeadQuestionnaireListItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><FileQuestion className="h-4 w-4 text-app-purple" />Персональные анкеты</CardTitle>
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
              <form action={deleteLeadQuestionnaireAction}>
                <input type="hidden" name="questionnaire_id" value={item.id} />
                <input type="hidden" name="lead_id" value={item.leadId} />
                <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" />Удалить</Button>
              </form>
            </div>
          </div>
        )) : (
          <p className="text-sm text-app-muted">Пока нет персональных анкет. Создай вопросы ниже и отправь человеку ссылку.</p>
        )}
      </CardContent>
    </Card>
  );
}


function LeadQuestionnaireResponsesCard({ items }: { items: LeadQuestionnaireResponseGroup[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-app-pink" />Ответы по персональным вопросам</CardTitle>
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
        )) : <p className="text-sm text-app-muted">Ответов на персональные вопросы пока нет.</p>}
      </CardContent>
    </Card>
  );
}


function QuestionPacksCard({ leadId, packs }: { leadId: string; packs: QuestionPack[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-app-purple" />Готовые паки вопросов</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-app-muted">
          Выбери готовый пакет — Hutka сразу создаст персональную ссылку с вопросами. Не нужно каждый раз вручную заполнять анкету для мастера или салона.
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
                  Создать ссылку
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
        <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать вопросы для контакта</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLeadQuestionnaireAction} className="space-y-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-app-text">Название анкеты</span>
              <Input name="title" defaultValue={`Вопросы для ${leadName}`} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-app-text">Описание для человека</span>
              <Input name="description" placeholder="Например: ответьте, чтобы мы подготовили пилот" />
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
            Создать ссылку для отправки
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
  hypotheses,
  surveys
}: {
  leadId: string;
  campaigns: CampaignOption[];
  insights: InsightOption[];
  hypotheses: HypothesisOption[];
  surveys: SurveyOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-app-purple" />Связи контакта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-app-muted">
          Добавляй контакт в кампании, связывай его с инсайтами и гипотезами, а также создавай персональную ссылку на опрос прямо из карточки.
        </p>

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

        <form action={createLeadSurveyInviteAction} className="space-y-3 rounded-2xl border border-app-line p-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <p className="text-sm font-bold text-app-text">Опрос для контакта</p>
          <Select name="survey_id" defaultValue="" required disabled={surveys.length === 0}>
            <EmptyOption label={surveys.length ? 'Выбери опрос' : 'Опросов пока нет'} />
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.name}{survey.status !== 'active' ? ' · черновик' : ''}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary" className="w-full" disabled={surveys.length === 0}>
            <ClipboardList className="h-4 w-4" />
            Создать ссылку на опрос
          </Button>
        </form>

        <form action={attachLeadToInsightFromProfileAction} className="space-y-3 rounded-2xl border border-app-line p-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <p className="text-sm font-bold text-app-text">Связать с инсайтом</p>
          <Select name="insight_id" defaultValue="" required disabled={insights.length === 0}>
            <EmptyOption label={insights.length ? 'Выбери инсайт' : 'Инсайтов пока нет'} />
            {insights.map((insight) => <option key={insight.id} value={insight.id}>{insight.name}</option>)}
          </Select>
          <Button type="submit" variant="secondary" className="w-full" disabled={insights.length === 0}>
            <Lightbulb className="h-4 w-4" />
            Привязать инсайт
          </Button>
        </form>

        <form action={attachLeadToHypothesisFromProfileAction} className="space-y-3 rounded-2xl border border-app-line p-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <p className="text-sm font-bold text-app-text">Связать с гипотезой</p>
          <Select name="hypothesis_id" defaultValue="" required disabled={hypotheses.length === 0}>
            <EmptyOption label={hypotheses.length ? 'Выбери гипотезу' : 'Гипотез пока нет'} />
            {hypotheses.map((hypothesis) => <option key={hypothesis.id} value={hypothesis.id}>{hypothesis.name}</option>)}
          </Select>
          <Button type="submit" variant="secondary" className="w-full" disabled={hypotheses.length === 0}>
            <Target className="h-4 w-4" />
            Привязать гипотезу
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export async function LeadProfile({ id }: { id: string }) {
  const [lead, interactions, tasks, stageOptions, related, campaignOptions, insightOptions, hypothesisOptions, surveyOptions, leadQuestionnaires, leadQuestionnaireResponses, currentUser, refusalReasons] = await Promise.all([
    getLeadById(id),
    getLeadInteractions(id),
    getLeadTasks(id),
    getLeadStageOptions(),
    getLeadRelatedItems(id),
    getCampaignOptions(),
    getInsightOptions(),
    getHypothesisOptions(),
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
  const currentStageOption = stageOptions.find((stage) => stage.name === lead.stage);
  const [questionPacks, messageTemplates] = await Promise.all([
    getQuestionPacks(),
    getMessageTemplatesForLead(lead.type)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-app-line bg-white p-6 shadow-card lg:flex-row lg:items-start">
        <div>
          <p className="mb-2 text-sm text-app-muted">Люди → {lead.name}</p>
          <h1 className="text-3xl font-black tracking-tight text-app-text">{lead.name}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={lead.score >= 75 ? 'red' : lead.score >= 45 ? 'yellow' : 'gray'}>{lead.priority} · {lead.score}/100</Badge>
            <Badge tone={lead.stage === 'Отказ' ? 'red' : 'purple'}>{lead.stage}</Badge>
            {lead.refusalReason && <Badge tone="red">Отказ: {lead.refusalReason}</Badge>}
            {lead.tags.length ? lead.tags.map((tag, index) => (
              <Badge key={tag} tone={index === 0 ? 'red' : index === 1 ? 'pink' : index === 2 ? 'purple' : 'green'}>{tag}</Badge>
            )) : <Badge tone="gray">Без тегов</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/people/${lead.id}/edit`}>
              <Edit3 className="h-4 w-4" />
              Редактировать
            </Link>
          </Button>
          {instagramHref && (
            <Button asChild variant="secondary">
              <a href={instagramHref} target="_blank" rel="noreferrer"><MessageSquare className="h-4 w-4" /> Instagram</a>
            </Button>
          )}
          {telegramHref && (
            <Button asChild variant="secondary">
              <a href={telegramHref} target="_blank" rel="noreferrer"><Send className="h-4 w-4" /> Telegram</a>
            </Button>
          )}
          <form action={updateLeadStageFromProfileAction}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="stage_name" value="Тест" />
            <Button type="submit"><TestTube2 className="h-4 w-4" /> В пилот</Button>
          </form>
          <Button variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
        </div>
      </div>

      <LeadNextActionCard lead={lead} tasks={tasks} />

      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-200 to-purple-200 text-xl font-black text-purple-800">
                  {lead.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-xl font-black text-app-text">{lead.name}</h2>
                  <p className="text-sm text-app-muted">{lead.type} · {lead.niche}</p>
                </div>
              </div>
              {[
                ['Тип', lead.type],
                ['Ниша', lead.niche],
                ['Город', lead.city],
                ['Источник', lead.source],
                ['Стадия', lead.stage],
                ['Приоритет', `${lead.priority} · ${lead.score}/100`],
                ['Следующий шаг', lead.nextStep],
                ['Следующий контакт', lead.nextDate]
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 border-b border-app-line pb-3 text-sm last:border-0">
                  <span className="text-app-muted">{label}</span>
                  <span className="text-right font-semibold text-app-text">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Контакты</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                ['Instagram', lead.instagram, instagramHref],
                ['Telegram', lead.telegram, telegramHref],
                ['Телефон', lead.phone, phoneHref],
                ['Email', lead.email, emailHref]
              ].map(([label, value, href]) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-app-soft px-4 py-3">
                  <span className="text-app-muted">{label}</span>
                  {href && value ? (
                    <a href={href} target={String(href).startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="font-semibold text-app-purple hover:underline">
                      {value}
                    </a>
                  ) : <span className="font-semibold text-app-text">—</span>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Быстрое управление</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form action={updateLeadStageFromProfileAction} className="space-y-3 rounded-2xl border border-app-line p-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <p className="text-sm font-bold text-app-text">Перевести в стадию</p>
                <Select name="stage_id" defaultValue={currentStageOption?.id ?? ''}>
                  {stageOptions.filter((stage) => stage.name !== 'Отказ').map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </Select>
                <Button type="submit" variant="secondary" className="w-full"><ArrowRight className="h-4 w-4" />Сменить стадию</Button>
              </form>

              <RefusalManagementCard leadId={lead.id} lead={lead} reasons={refusalReasons} />

              <form action={updateLeadFollowUpAction} className="space-y-3 rounded-2xl border border-app-line p-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <p className="text-sm font-bold text-app-text">Следующий шаг</p>
                <Input name="next_step" defaultValue={lead.nextStep === '—' ? '' : lead.nextStep} placeholder="Например: отправить ссылку на опрос" />
                <Input name="next_contact_date" type="date" defaultValue={lead.nextDateRaw ?? ''} />
                <Button type="submit" variant="secondary" className="w-full"><Flag className="h-4 w-4" />Сохранить follow-up</Button>
              </form>

              <div className="grid gap-2">
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={`/tasks/new?leadId=${lead.id}`}><CalendarPlus className="h-4 w-4" />Создать задачу</Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={`/insights/new?leadId=${lead.id}`}><Sparkles className="h-4 w-4" />Создать новый инсайт</Link>
                </Button>
                <Button asChild variant="ghost" className="justify-start">
                  <Link href={`/hypotheses/new?leadId=${lead.id}`}><Target className="h-4 w-4" />Создать новую гипотезу</Link>
                </Button>
              </div>

              <form action={deleteLeadAction} className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <p className="text-sm font-black text-red-700">Удалить контакт</p>
                <p className="mt-1 text-xs leading-5 text-red-600">Удалятся анкеты, касания и связи контакта. Задачи останутся без привязки к контакту.</p>
                <Button type="submit" variant="danger" className="mt-3 w-full">
                  <Trash2 className="h-4 w-4" />
                  Удалить контакт
                </Button>
              </form>
            </CardContent>
          </Card>

          <ContactRelationsHub
            leadId={lead.id}
            campaigns={campaignOptions}
            insights={insightOptions}
            hypotheses={hypothesisOptions}
            surveys={surveyOptions}
          />

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
          />
          <QuestionPacksCard leadId={lead.id} packs={questionPacks} />
          <LeadQuestionnairesCard items={leadQuestionnaires} />
          <LeadQuestionnaireResponsesCard items={leadQuestionnaireResponses} />
          <PersonalQuestionnaireBuilder leadId={lead.id} leadName={lead.name} />
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
                  <p className="text-sm text-app-muted">Пока нет касаний. Добавь первое сообщение, звонок или заметку.</p>
                )}
              </div>
            </CardContent>
          </Card>

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
                    <option value="survey_sent">Опрос отправлен</option>
                    <option value="survey_completed">Опрос пройден</option>
                    <option value="status_change">Изменение статуса</option>
                  </Select>
                  <Input name="channel" placeholder="Канал: Instagram, Telegram..." />
                </div>
                <Textarea name="text" placeholder="Что произошло, что ответил контакт, что важно не забыть..." required />
                <Input name="result" placeholder="Результат: ответил, ждём, отказ, готов к пилоту..." />
                <Button type="submit"><Save className="h-4 w-4" />Сохранить касание</Button>
              </form>
            </CardContent>
          </Card>
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
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="return_to" value={`/people/${lead.id}`} />
                      <Button type="submit" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" />Удалить</Button>
                    </form>
                  </div>
                </div>
              )) : <p className="text-sm text-app-muted">Задач по контакту пока нет.</p>}

              <form action={createTaskAction} className="space-y-3 rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-4">
                <input type="hidden" name="lead_id" value={lead.id} />
                <input type="hidden" name="return_to" value={`/people/${lead.id}`} />
                <Input name="title" placeholder="Новая задача" required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="due_date" type="date" />
                  <Select name="priority" defaultValue="Средний">
                    <option>Низкий</option>
                    <option>Средний</option>
                    <option>Высокий</option>
                    <option>Срочно</option>
                  </Select>
                </div>
                <Textarea name="description" placeholder="Описание задачи" />
                <Button type="submit" variant="secondary"><CalendarPlus className="h-4 w-4" />Добавить задачу</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <RelationList title="Кампании" empty="Контакт пока не привязан к кампаниям." items={related.campaigns} icon={<Link2 className="h-4 w-4 text-app-purple" />} />
        <SurveyRelations items={related.surveys} />
        <RelationList title="Инсайты" empty="По контакту пока нет инсайтов." items={related.insights} icon={<Lightbulb className="h-4 w-4 text-app-pink" />} />
        <RelationList title="Гипотезы" empty="Контакт пока не связан с гипотезами." items={related.hypotheses} icon={<Target className="h-4 w-4 text-amber-500" />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Последние ответы на опросы</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {surveyAnswers.map((answer) => (
            <div key={answer.question} className="rounded-2xl border border-app-line p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-app-faint">{answer.question}</p>
              <p className="mt-2 text-sm font-semibold text-app-text">{answer.answer}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
