'use client';

import Link from 'next/link';
import { FileQuestion, LoaderCircle, PlusCircle } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import { createQuestionPackMutation } from '@/actions/question-packs.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type QuestionPackAudience,
  type QuestionPackListItem,
  type QuestionPackStatus,
  questionPackAudienceLabel,
  questionPackAudienceOptions,
  questionPackStatusLabel,
  questionPackStatusOptions
} from '@/lib/question-pack-shared';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function sortPacks(items: QuestionPackListItem[]) {
  return [...items].sort((a, b) => a.shortTitle.localeCompare(b.shortTitle, 'ru'));
}

function MutationButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function QuestionPacksWorkspace({ initialPacks }: { initialPacks: QuestionPackListItem[] }) {
  const [packs, setPacks] = useState(initialPacks);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef(false);
  const [, startTransition] = useTransition();

  function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = value(formData, 'title');
    if (!title) return;

    const temporaryId = `temporary-pack-${crypto.randomUUID()}`;
    const temporary: QuestionPackListItem = {
      id: temporaryId,
      title,
      shortTitle: value(formData, 'short_title') || title,
      description: value(formData, 'description'),
      audience: (value(formData, 'audience') || 'master') as QuestionPackAudience,
      badge: value(formData, 'badge') || 'набор',
      status: (value(formData, 'status') || 'active') as QuestionPackStatus,
      questionsCount: 0
    };

    pendingRef.current = true;
    setPending(true);
    setPacks((current) => sortPacks([...current, temporary]));
    startTransition(async () => {
      try {
        const result = await createQuestionPackMutation(temporary);
        if (!result.ok || !result.item) {
          setPacks((current) => current.filter((item) => item.id !== temporaryId));
          setNotice({
            tone: 'error',
            text: result.error === 'demo'
              ? 'Supabase не настроен, набор не сохранен.'
              : result.error === 'title-required'
                ? 'Укажи название набора.'
                : 'Не удалось создать готовые вопросы.'
          });
          return;
        }
        const savedPack = result.item;
        setPacks((current) => sortPacks(current.map((item) => item.id === temporaryId ? savedPack : item)));
        form.reset();
        setNotice({ tone: 'success', text: 'Готовые вопросы созданы.' });
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать готовые вопросы</CardTitle>
          <p className="text-sm text-app-muted">Создай шаблон, который потом можно будет одним кликом отправлять мастеру, салону или клиенту из карточки контакта.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={createPack} className="grid gap-4 lg:grid-cols-2">
            <div><label className="mb-2 block text-sm font-bold text-app-text">Полное название</label><Input name="title" placeholder="Например: Диагностика мастера" required /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Короткое название</label><Input name="short_title" placeholder="Мастер: диагностика" /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Для кого</label><Select name="audience" defaultValue="master">{questionPackAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Статус</label><Select name="status" defaultValue="active">{questionPackStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Бейдж</label><Input name="badge" placeholder="старт / карта / отказ" defaultValue="набор" /></div>
            <div className="lg:col-span-2"><label className="mb-2 block text-sm font-bold text-app-text">Описание</label><Textarea name="description" placeholder="Коротко объясни, когда использовать этот набор." /></div>
            <div className="lg:col-span-2"><MutationButton pending={pending}>Создать набор</MutationButton></div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {packs.length ? packs.map((pack) => {
          const isTemporary = pack.id.startsWith('temporary-pack-');
          return (
          <Card key={pack.id} className="performance-contain">
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-lg font-black text-app-text">{pack.shortTitle}</h2>
                    <Badge tone="purple">{pack.badge}</Badge>
                    {isTemporary && <Badge tone="yellow">Сохраняется</Badge>}
                    <Badge tone={pack.status === 'active' ? 'green' : pack.status === 'archived' ? 'gray' : 'yellow'}>{questionPackStatusLabel(pack.status ?? 'active')}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-app-muted">{pack.description || 'Без описания'}</p>
                </div>
                {isTemporary ? (
                  <Button size="sm" disabled>Редактировать</Button>
                ) : (
                  <Button asChild size="sm"><Link prefetch={false} href={`/settings/question-packs/${pack.id}`}>Редактировать</Link></Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{questionPackAudienceLabel(pack.audience)}</Badge>
                <Badge tone="gray">{pack.questionsCount} вопросов</Badge>
              </div>
            </CardContent>
          </Card>
        );
        }) : (
          <Card className="xl:col-span-2"><CardContent className="flex flex-col items-center justify-center py-12 text-center"><FileQuestion className="h-10 w-10 text-app-faint" /><h2 className="mt-4 text-lg font-black text-app-text">Готовые вопросы еще не созданы</h2><p className="mt-2 max-w-xl text-sm text-app-muted">Создай первый набор вопросов, чтобы быстро отправлять мастерам и салонам готовые анкеты.</p></CardContent></Card>
        )}
      </div>
    </div>
  );
}
