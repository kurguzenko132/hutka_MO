import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { deleteLeadAction } from '@/actions/leads.actions';
import { getCampaignOptions } from '@/lib/campaigns';
import { needs, surveyAnswers } from '@/lib/data';
import {
  getLeadById,
  getLeadInteractions,
  getLeadRelatedItems,
  getLeadTasks,
  type LeadRelationItem,
  type LeadSurveyResponseGroup
} from '@/lib/leads';
import { getInsightOptions } from '@/lib/insights';
import { getLeadSurveyInvites, getSurveyOptions } from '@/lib/surveys';
import { getLeadQuestionnaires, getLeadQuestionnaireResponses, type LeadQuestionnaireResponseGroup } from '@/lib/lead-questionnaires';
import { getQuestionPacks } from '@/lib/question-packs';
import { getRefusalReasons } from '@/lib/refusals';
import { getMessageTemplatesForLead } from '@/lib/message-templates';
import { getCurrentUserContext } from '@/lib/permissions';
import { can } from '@/lib/roles';
import { ContactRelationsHub } from '@/components/people/contact-relations-hub';
import { MessageTemplatePanel } from '@/components/people/message-template-panel';
import { LeadActivityWorkspace } from '@/components/people/lead-activity-workspace';
import { LeadNextActionCard } from '@/components/people/lead-next-action-card';
import { LeadQuestionnaireWorkspace } from '@/components/people/lead-questionnaire-workspace';
import { LeadRefusalCard } from '@/components/people/lead-refusal-card';
import { LeadTasksCard } from '@/components/people/lead-tasks-card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Edit3,
  ExternalLink,
  FileQuestion,
  Lightbulb,
  Link2,
  MessageSquare,
  Trash2,
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
          <Link key={`${item.type}-${item.id}`} prefetch={false} href={item.href} className="block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/50">
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
          <Link key={item.id} prefetch={false} href={item.href} className="block rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/50">
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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-app-line bg-white p-3 shadow-card md:hidden">
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


type LeadProfileLead = NonNullable<Awaited<ReturnType<typeof getLeadById>>>;
type LeadProfileTasks = Awaited<ReturnType<typeof getLeadTasks>>;
type LeadProfileUser = Awaited<ReturnType<typeof getCurrentUserContext>>;

function loadLeadProfileDetails(id: string) {
  return Promise.all([
    getLeadInteractions(id, 100),
    getLeadRelatedItems(id),
    getCampaignOptions(),
    getInsightOptions(),
    getSurveyOptions(),
    getLeadSurveyInvites(id),
    getLeadQuestionnaires(id),
    getLeadQuestionnaireResponses(id),
    getRefusalReasons(),
    getQuestionPacks()
  ]);
}

function LeadProfileDetailsFallback() {
  return (
    <div id="lead-questions" className="grid gap-6 2xl:grid-cols-3" aria-live="polite" aria-busy="true">
      {['Рабочие связи', 'История активности', 'Анкеты и задачи'].map((title) => (
        <Card key={title}>
          <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="h-3 w-3/4 rounded-full bg-slate-100" />
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function LeadProfileDetails({
  lead,
  tasks,
  currentUser,
  dataPromise
}: {
  lead: LeadProfileLead;
  tasks: LeadProfileTasks;
  currentUser: LeadProfileUser;
  dataPromise: ReturnType<typeof loadLeadProfileDetails>;
}) {
  const [
    [
      interactions,
      related,
      campaignOptions,
      insightOptions,
      surveyOptions,
      surveyInvites,
      leadQuestionnaires,
      leadQuestionnaireResponses,
      refusalReasons,
      questionPacks
    ],
    messageTemplates
  ] = await Promise.all([
    dataPromise,
    getMessageTemplatesForLead(lead.type)
  ]);

  const currentRole = currentUser?.role ?? 'viewer';
  const canManageContacts = can(currentRole, 'manageContacts');
  const canManageTasks = can(currentRole, 'manageTasks');
  const canManageCampaigns = can(currentRole, 'manageCampaigns');
  const canManageSurveys = can(currentRole, 'manageSurveys');
  const canManageInsights = can(currentRole, 'manageInsights');
  const canManageSettings = can(currentRole, 'manageSettings');
  const canManageRelations = canManageCampaigns || canManageSurveys || canManageInsights;

  return (
    <>
      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.2fr_1fr]">
        <div className="space-y-6">
          {canManageRelations && (
            <ContactRelationsHub
              leadId={lead.id}
              campaigns={campaignOptions}
              insights={insightOptions}
              surveys={surveyOptions}
              initialCampaignIds={related.campaigns.map((item) => item.id)}
              initialInsightIds={related.insights.map((item) => item.id)}
              initialSurveyLinks={surveyInvites}
              canManageCampaigns={canManageCampaigns}
              canManageSurveys={canManageSurveys}
              canManageInsights={canManageInsights}
            />
          )}

          {canManageContacts && (
            <LeadRefusalCard
              leadId={lead.id}
              reasons={refusalReasons}
              initialRefusal={lead.refusalReason ? {
                reason: lead.refusalReason,
                comment: lead.refusalComment,
                refusedAt: lead.refusedAt ?? 'Дата не указана'
              } : undefined}
            />
          )}

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
          <div id="lead-questions" className="scroll-mt-24">
            <LeadQuestionnaireWorkspace
              leadId={lead.id}
              leadName={lead.name}
              initialItems={leadQuestionnaires}
              packs={questionPacks}
              canManage={canManageContacts}
            />
          </div>
          <LeadQuestionnaireResponsesCard items={leadQuestionnaireResponses} />
          {canManageContacts && (
            <form action={deleteLeadAction} className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
              <input type="hidden" name="lead_id" value={lead.id} />
              <p className="text-sm font-black text-red-700">Удалить контакт</p>
              <p className="mt-1 text-xs leading-5 text-red-600">Удалятся анкеты, касания и связи контакта. Задачи останутся без привязки к контакту.</p>
              <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" className="mt-3 bg-white" required />
              <SubmitButton variant="danger" className="mt-3 w-full">
                <Trash2 className="h-4 w-4" />
                Удалить контакт
              </SubmitButton>
            </form>
          )}
        </div>

        <LeadActivityWorkspace leadId={lead.id} initialInteractions={interactions} canManage={canManageContacts} />

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

          <LeadTasksCard initialTasks={tasks} canManage={canManageTasks} />
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
    </>
  );
}

export async function LeadProfile({ id }: { id: string }) {
  const detailsPromise = loadLeadProfileDetails(id);
  const [lead, latestInteractions, tasks, currentUser] = await Promise.all([
    getLeadById(id),
    getLeadInteractions(id, 1),
    getLeadTasks(id),
    getCurrentUserContext()
  ]);

  if (!lead) notFound();

  const instagramHref = contactHref(lead.instagram, 'instagram');
  const telegramHref = contactHref(lead.telegram, 'telegram');
  const emailHref = contactHref(lead.email, 'email');
  const phoneHref = contactHref(lead.phone, 'phone');
  const currentRole = currentUser?.role ?? 'viewer';
  const canManageContacts = can(currentRole, 'manageContacts');

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
                ['Последняя активность', latestInteractions[0]?.date || '—'],
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
                <Link prefetch={false} href={`/people/${lead.id}/edit`}>
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

      <Suspense fallback={<LeadProfileDetailsFallback />}>
        <LeadProfileDetails lead={lead} tasks={tasks} currentUser={currentUser} dataPromise={detailsPromise} />
      </Suspense>

      <MobileStickyActions instagramHref={instagramHref} telegramHref={telegramHref} phoneHref={phoneHref} emailHref={emailHref} />
    </div>
  );
}
