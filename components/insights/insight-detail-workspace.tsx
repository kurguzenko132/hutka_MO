'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Brain, CheckCircle2, ClipboardList, LoaderCircle, Save, Send, Sparkles, Trash2, Users } from 'lucide-react';
import { type FormEvent, useRef, useState, useTransition } from 'react';
import { deleteInsightMutation, updateInsightMutation } from '@/actions/insights.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  insightImportanceLabel,
  insightImportanceToDb,
  insightImportanceTone,
  insightStatusLabel,
  insightStatusToDb,
  insightStatusTone,
  type InsightDetail,
  type InsightRelation
} from '@/lib/insight-shared';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function errorText(error?: string) {
  if (error === 'demo') return 'Supabase не настроен, изменение не сохранено.';
  if (error === 'insight-not-found') return 'Вывод больше не найден.';
  if (error === 'confirmation-required') return 'Для удаления введи УДАЛИТЬ.';
  if (error === 'delete-failed') return 'Не удалось удалить вывод.';
  return 'Не удалось сохранить изменения.';
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-app-muted">{title}</p>
      <p className="mt-3 text-sm font-semibold leading-6 text-app-text">{text}</p>
    </div>
  );
}

function RelationCard({ icon, title, empty, items }: { icon: ReactNode; title: string; empty: string; items: InsightRelation[] }) {
  return (
    <Card className="h-full performance-contain">
      <CardContent>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-app-purple">{icon}</div><h3 className="font-black text-app-text">{title}</h3></div>
        <div className="mt-4 space-y-2">
          {items.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-app-muted">{empty}</p> : null}
          {items.map((item) => <Link key={item.id} prefetch={false} href={item.href} className="block rounded-xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text transition hover:border-purple-200 hover:bg-purple-50">{item.name}</Link>)}
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightDetailWorkspace({ initialInsight, canManage }: { initialInsight: InsightDetail; canManage: boolean }) {
  const router = useRouter();
  const [insight, setInsight] = useState(initialInsight);
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
    const statusLabel = value(formData, 'status');
    const importanceLabel = value(formData, 'importance');
    const previous = insight;
    const optimistic: InsightDetail = {
      ...insight,
      status: insightStatusToDb[statusLabel] ?? insight.status,
      statusLabel: insightStatusLabel(insightStatusToDb[statusLabel] ?? insight.status),
      importance: insightImportanceToDb[importanceLabel] ?? insight.importance,
      importanceLabel: insightImportanceLabel(insightImportanceToDb[importanceLabel] ?? insight.importance),
      evidence: value(formData, 'evidence') || undefined,
      nextAction: value(formData, 'next_action') || undefined
    };
    setInsight(optimistic);
    setNotice(null);
    run('update', async () => {
      const result = await updateInsightMutation({
        id: insight.id,
        status: statusLabel,
        importance: importanceLabel,
        evidence: optimistic.evidence,
        nextAction: optimistic.nextAction
      });
      if (!result.ok || !result.item) {
        setInsight(previous);
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      setInsight((current) => ({ ...current, ...result.item }));
      setNotice({ tone: 'success', text: 'Вывод обновлен.' });
    });
  }

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const confirmation = value(new FormData(event.currentTarget), 'confirmation');
    if (confirmation !== 'УДАЛИТЬ') {
      setNotice({ tone: 'error', text: errorText('confirmation-required') });
      return;
    }
    run('delete', async () => {
      const result = await deleteInsightMutation(insight.id, confirmation);
      if (!result.ok) {
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      router.replace('/insights?deleted=insight');
    });
  }

  const formKey = [insight.status, insight.importance, insight.evidence ?? '', insight.nextAction ?? ''].join(':');

  return (
    <div className="space-y-6">
      {notice ? (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.tone === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <main className="space-y-6">
          <Card><CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={insightImportanceTone(insight.importance)}>{insight.importanceLabel}</Badge>
              <Badge tone={insightStatusTone(insight.status)}>{insight.statusLabel}</Badge>
              <Badge tone="purple">{insight.category}</Badge>
              <Badge tone="gray">Связей: {insight.relationsCount}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoBlock title="Доказательства" text={insight.evidence || 'Доказательства пока не добавлены.'} />
              <InfoBlock title="Следующее действие" text={insight.nextAction || 'Следующее действие пока не указано.'} />
            </div>
          </CardContent></Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <RelationCard icon={<Users className="h-5 w-5" />} title="Контакты" empty="Контакты не привязаны" items={insight.leads} />
            <RelationCard icon={<Send className="h-5 w-5" />} title="Кампании" empty="Кампании не привязаны" items={insight.campaigns} />
            <RelationCard icon={<ClipboardList className="h-5 w-5" />} title="Анкеты" empty="Анкеты не привязаны" items={insight.surveys} />
          </div>

          <Card><CardContent><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-app-purple"><Sparkles className="h-5 w-5" /></div><div><h3 className="font-black text-app-text">Как использовать этот вывод</h3><p className="mt-2 text-sm leading-6 text-app-muted">Обсуди его с командой и преврати в действие: изменить оффер, упростить онбординг, выбрать другой канал или обновить сценарий общения.</p></div></div></CardContent></Card>
        </main>

        <aside className="space-y-6">
          {canManage ? (
            <form key={formKey} onSubmit={update}>
              <FormSection title="Обновить вывод" subtitle="Поменяй статус, важность и следующий шаг после обсуждения с командой.">
                <div className="space-y-4">
                  <Field label="Статус"><Select name="status" defaultValue={insight.statusLabel}><option>Новый</option><option>На проверке</option><option>Принят</option><option>В архиве</option></Select></Field>
                  <Field label="Важность"><Select name="importance" defaultValue={insight.importanceLabel}><option>Низкая</option><option>Средняя</option><option>Высокая</option><option>Критично</option></Select></Field>
                  <Field label="Доказательства"><Textarea name="evidence" defaultValue={insight.evidence ?? ''} /></Field>
                  <Field label="Следующее действие"><Textarea name="next_action" defaultValue={insight.nextAction ?? ''} /></Field>
                  <Button type="submit" className="w-full" disabled={Boolean(pendingKey)} aria-busy={pendingKey === 'update' || undefined}>{pendingKey === 'update' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить изменения</Button>
                </div>
              </FormSection>
            </form>
          ) : null}

          <Card><CardContent><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-50 text-pink-600"><Brain className="h-5 w-5" /></div><h3 className="mt-4 text-lg font-black text-app-text">Следующий этап</h3><p className="mt-2 text-sm leading-6 text-app-muted">После этого вывод можно переносить в тексты, задачи и решения по кампании.</p></CardContent></Card>

          {canManage ? (
            <form onSubmit={remove}>
              <FormSection title="Удалить вывод" subtitle="Удалится вывод и его связи. Контакты, кампании и анкеты останутся.">
                <Input name="confirmation" placeholder="Напиши: УДАЛИТЬ" required />
                <Button type="submit" variant="danger" className="w-full" disabled={Boolean(pendingKey)} aria-busy={pendingKey === 'delete' || undefined}>{pendingKey === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить вывод</Button>
              </FormSection>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
