'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { createContext, type FormEvent, type ReactNode, useContext, useRef, useState, useTransition } from 'react';
import { deleteSurveyMutation, updateSurveyMetadataMutation } from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { PageHeader } from '@/components/layout/page-header';
import { SurveyQuestionCountBadge } from '@/components/surveys/add-survey-question-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type SurveyMetadata = {
  id: string;
  title: string;
  type: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
};

type SurveyMetadataContextValue = {
  survey: SurveyMetadata;
  setSurvey: (survey: SurveyMetadata) => void;
};

const SurveyMetadataContext = createContext<SurveyMetadataContextValue | null>(null);
const segmentOptions = ['Мастера', 'Салоны', 'Клиенты', 'Партнеры', 'После тестирования', 'Общий'];

function useSurveyMetadata() {
  const context = useContext(SurveyMetadataContext);
  if (!context) throw new Error('Survey metadata controls must be inside SurveyMetadataProvider.');
  return context;
}

function statusLabel(status: SurveyMetadata['status']) {
  if (status === 'active') return 'Активен';
  if (status === 'archived') return 'Архив';
  return 'Черновик';
}

function statusTone(status: SurveyMetadata['status']) {
  if (status === 'active') return 'green' as const;
  if (status === 'archived') return 'gray' as const;
  return 'yellow' as const;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function errorText(error?: string) {
  if (error === 'demo') return 'Supabase не настроен, изменение не сохранено.';
  if (error === 'title-required') return 'Укажи название анкеты.';
  if (error === 'survey-not-found') return 'Анкета больше не найдена.';
  if (error === 'confirmation-required') return 'Для удаления введи УДАЛИТЬ.';
  if (error === 'delete-failed') return 'Не удалось удалить анкету.';
  return 'Не удалось сохранить настройки анкеты.';
}

export function SurveyMetadataProvider({ initialSurvey, children }: { initialSurvey: SurveyMetadata; children: ReactNode }) {
  const [survey, setSurvey] = useState(initialSurvey);
  return <SurveyMetadataContext.Provider value={{ survey, setSurvey }}>{children}</SurveyMetadataContext.Provider>;
}

export function SurveyMetadataHeader() {
  const { survey } = useSurveyMetadata();
  return <PageHeader title={survey.title} subtitle={survey.description || 'Анкета без описания'} />;
}

export function SurveyMetadataSummary({
  publicUrl,
  slug,
  answersCount
}: {
  publicUrl: string;
  slug: string;
  answersCount: number;
}) {
  const { survey } = useSurveyMetadata();
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(survey.status)}>{statusLabel(survey.status)}</Badge>
          <Badge tone="purple">{survey.type}</Badge>
          <SurveyQuestionCountBadge />
          <Badge tone="green">{answersCount} ответов</Badge>
        </div>
        <div className="rounded-xl border border-app-line bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-app-muted">Публичная ссылка</p>
          <p className="mt-2 break-all text-sm font-semibold text-app-text">{publicUrl}</p>
          <Button asChild variant="secondary" className="mt-3">
            <Link prefetch={false} href={`/s/${slug}`} target="_blank"><ExternalLink className="h-4 w-4" />Открыть форму</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SurveyMetadataWorkspace() {
  const { survey, setSurvey } = useSurveyMetadata();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef(false);
  const [, startTransition] = useTransition();

  function run(key: string, task: () => Promise<void>) {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPendingKey(key);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current = false;
        setPendingKey(null);
      }
    });
    return true;
  }

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const formData = new FormData(event.currentTarget);
    const title = value(formData, 'title');
    if (!title) return;
    const previous = survey;
    const optimistic: SurveyMetadata = {
      ...survey,
      title,
      type: value(formData, 'type') || 'Общий',
      description: value(formData, 'description') || undefined,
      status: value(formData, 'status') as SurveyMetadata['status']
    };
    setSurvey(optimistic);
    setNotice(null);
    run('update', async () => {
      const result = await updateSurveyMetadataMutation(optimistic);
      if (!result.ok || !result.item) {
        setSurvey(previous);
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      setSurvey({ ...survey, ...result.item });
      setNotice({ tone: 'success', text: 'Настройки анкеты сохранены.' });
    });
  }

  const currentSegments = segmentOptions.includes(survey.type) ? segmentOptions : [survey.type, ...segmentOptions];
  const formKey = [survey.title, survey.type, survey.description ?? '', survey.status].join(':');

  return (
    <div className="space-y-6">
      {notice ? (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.tone === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <form key={formKey} onSubmit={update}>
        <FormSection title="Настройки анкеты" subtitle="Название, сегмент и статус публичной формы.">
          <div className="space-y-4">
            <Field label="Название"><Input name="title" defaultValue={survey.title} required /></Field>
            <Field label="Сегмент"><Select name="type" defaultValue={survey.type}>{currentSegments.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Статус">
              <Select name="status" defaultValue={survey.status}>
                <option value="draft">Черновик</option>
                <option value="active">Активен</option>
                <option value="archived">Архив</option>
              </Select>
            </Field>
            <Field label="Описание"><Textarea name="description" defaultValue={survey.description ?? ''} /></Field>
            <Button type="submit" className="w-full" disabled={Boolean(pendingKey)} aria-busy={pendingKey === 'update' || undefined}>
              {pendingKey === 'update' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить настройки
            </Button>
          </div>
        </FormSection>
      </form>

    </div>
  );
}

export function SurveyDeleteWorkspace() {
  const router = useRouter();
  const { survey } = useSurveyMetadata();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const pendingRef = useRef(false);
  const [, startTransition] = useTransition();

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const confirmation = value(new FormData(event.currentTarget), 'confirmation');
    if (confirmation !== 'УДАЛИТЬ') {
      setError(errorText('confirmation-required'));
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError('');
    startTransition(async () => {
      try {
        const result = await deleteSurveyMutation(survey.id, confirmation);
        if (!result.ok) {
          setError(errorText(result.error));
          return;
        }
        router.replace('/surveys?deleted=survey');
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    });
  }

  return (
    <form onSubmit={remove}>
      <FormSection title="Удалить анкету" subtitle="Удалится анкета, вопросы и ответы. Публичная ссылка перестанет работать.">
        {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" required />
        <Button type="submit" variant="danger" className="w-full" disabled={pending} aria-busy={pending || undefined}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить анкету
        </Button>
      </FormSection>
    </form>
  );
}
