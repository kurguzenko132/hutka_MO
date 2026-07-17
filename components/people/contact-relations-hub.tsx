'use client';

import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Link2,
  LoaderCircle
} from 'lucide-react';
import { addLeadToCampaignMutationAction } from '@/actions/campaigns.actions';
import {
  attachLeadToInsightMutationAction,
  createLeadSurveyInviteMutationAction
} from '@/actions/leads.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import type { CampaignOption } from '@/lib/campaigns';
import type { InsightOption } from '@/lib/insight-shared';
import type { SurveyOption } from '@/lib/surveys';

type PendingAction = 'campaign' | 'survey' | 'insight' | '';

export function ContactRelationsHub({
  leadId,
  campaigns,
  insights,
  surveys,
  initialCampaignIds = [],
  initialInsightIds = [],
  canManageCampaigns = false,
  canManageSurveys = false,
  canManageInsights = false
}: {
  leadId: string;
  campaigns: CampaignOption[];
  insights: InsightOption[];
  surveys: SurveyOption[];
  initialCampaignIds?: string[];
  initialInsightIds?: string[];
  canManageCampaigns?: boolean;
  canManageSurveys?: boolean;
  canManageInsights?: boolean;
}) {
  const [campaignId, setCampaignId] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [insightId, setInsightId] = useState('');
  const [linkedCampaignIds, setLinkedCampaignIds] = useState(() => new Set(initialCampaignIds));
  const [linkedInsightIds, setLinkedInsightIds] = useState(() => new Set(initialInsightIds));
  const [surveyLink, setSurveyLink] = useState<{ title: string; url: string } | null>(null);
  const [pending, setPending] = useState<PendingAction>('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const hasRelationActions = canManageCampaigns || canManageSurveys || canManageInsights;
  if (!hasRelationActions) return null;

  function start(action: PendingAction, message: string) {
    setPending(action);
    setNotice(message);
    setNoticeError(false);
  }

  function fail(message: string) {
    setNotice(message);
    setNoticeError(true);
  }

  async function attachCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !campaignId) return;
    const selectedId = campaignId;
    const title = campaigns.find((item) => item.id === selectedId)?.name ?? 'кампания';
    start('campaign', 'Добавляю контакт в кампанию...');

    try {
      const result = await addLeadToCampaignMutationAction({ campaignId: selectedId, leadId });
      if (!result.ok) {
        fail('Не удалось добавить контакт в кампанию.');
      } else {
        setLinkedCampaignIds((current) => new Set(current).add(selectedId));
        setCampaignId('');
        setNotice(`Контакт добавлен в кампанию «${title}».`);
      }
    } catch {
      fail('Не удалось связаться с сервером.');
    } finally {
      setPending('');
    }
  }

  async function createSurveyLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !surveyId) return;
    const selectedId = surveyId;
    start('survey', 'Создаю ссылку на вопросы...');

    try {
      const result = await createLeadSurveyInviteMutationAction({ leadId, surveyId: selectedId });
      if (!result.ok || !result.url) {
        fail('Не удалось создать ссылку на вопросы.');
      } else {
        setSurveyLink({ title: result.title ?? 'Анкета', url: result.url });
        setSurveyId('');
        setNotice('Ссылка создана и записана в историю контакта.');
      }
    } catch {
      fail('Не удалось связаться с сервером.');
    } finally {
      setPending('');
    }
  }

  async function attachInsight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !insightId) return;
    const selectedId = insightId;
    const title = insights.find((item) => item.id === selectedId)?.name ?? 'вывод';
    start('insight', 'Связываю контакт с выводом...');

    try {
      const result = await attachLeadToInsightMutationAction({ leadId, insightId: selectedId });
      if (!result.ok) {
        fail('Не удалось связать контакт с выводом.');
      } else {
        setLinkedInsightIds((current) => new Set(current).add(selectedId));
        setInsightId('');
        setNotice(`Контакт связан с выводом «${title}».`);
      }
    } catch {
      fail('Не удалось связаться с сервером.');
    } finally {
      setPending('');
    }
  }

  async function copySurveyLink() {
    if (!surveyLink) return;
    try {
      const absoluteUrl = new URL(surveyLink.url, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      setNotice('Ссылка скопирована.');
      setNoticeError(false);
    } catch {
      fail('Не удалось скопировать ссылку.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-app-purple" />Рабочие связи</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <p aria-live="polite" className={`flex items-start gap-2 text-sm font-semibold ${noticeError ? 'text-red-700' : 'text-emerald-700'}`}>
            {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{notice}</span>
          </p>
        )}

        {canManageCampaigns && (
          <form onSubmit={(event) => void attachCampaign(event)} className="space-y-3 rounded-2xl border border-app-line p-4">
            <p className="text-sm font-bold text-app-text">Добавить в кампанию</p>
            <Select
              value={campaignId}
              required
              disabled={campaigns.length === 0 || Boolean(pending)}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">{campaigns.length ? 'Выбери кампанию' : 'Кампаний пока нет'}</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id} disabled={linkedCampaignIds.has(campaign.id)}>
                  {campaign.name}{linkedCampaignIds.has(campaign.id) ? ' · уже добавлен' : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={campaigns.length === 0 || Boolean(pending) || !campaignId}>
              {pending === 'campaign' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Добавить в кампанию
            </Button>
          </form>
        )}

        {canManageSurveys && (
          <form onSubmit={(event) => void createSurveyLink(event)} className="space-y-3 rounded-2xl border border-app-line p-4">
            <p className="text-sm font-bold text-app-text">Ссылка на вопросы</p>
            <Select
              value={surveyId}
              required
              disabled={surveys.length === 0 || Boolean(pending)}
              onChange={(event) => setSurveyId(event.target.value)}
            >
              <option value="">{surveys.length ? 'Выбери анкету' : 'Анкет пока нет'}</option>
              {surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}{survey.status !== 'active' ? ' · черновик' : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={surveys.length === 0 || Boolean(pending) || !surveyId}>
              {pending === 'survey' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              Создать ссылку на вопросы
            </Button>
          </form>
        )}

        {surveyLink && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-sm font-bold text-app-text">{surveyLink.title}</p>
            <p className="break-all text-xs leading-5 text-app-muted">{surveyLink.url}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void copySurveyLink()}>
                <Copy className="h-4 w-4" />
                Копировать
              </Button>
              <Button asChild size="sm">
                <a href={surveyLink.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Открыть
                </a>
              </Button>
            </div>
          </div>
        )}

        {canManageInsights && (
          <form onSubmit={(event) => void attachInsight(event)} className="space-y-3 rounded-2xl border border-app-line p-4">
            <p className="text-sm font-bold text-app-text">Связать с выводом</p>
            <Select
              value={insightId}
              required
              disabled={insights.length === 0 || Boolean(pending)}
              onChange={(event) => setInsightId(event.target.value)}
            >
              <option value="">{insights.length ? 'Выбери вывод' : 'Выводов пока нет'}</option>
              {insights.map((insight) => (
                <option key={insight.id} value={insight.id} disabled={linkedInsightIds.has(insight.id)}>
                  {insight.name}{linkedInsightIds.has(insight.id) ? ' · уже связан' : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="w-full" disabled={insights.length === 0 || Boolean(pending) || !insightId}>
              {pending === 'insight' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              Связать вывод
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
