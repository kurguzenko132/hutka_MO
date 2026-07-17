'use client';

import { useRouter } from 'next/navigation';
import { LoaderCircle, PlusCircle, Save, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useRef, useState, useTransition } from 'react';
import {
  addQuestionToPackMutation,
  deleteQuestionPackMutation,
  deleteQuestionPackQuestionMutation,
  updateQuestionPackMutation,
  updateQuestionPackQuestionMutation
} from '@/actions/question-packs.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type QuestionPack,
  type QuestionPackAudience,
  type QuestionPackQuestion,
  type QuestionPackStatus,
  type QuestionType,
  questionPackAudienceOptions,
  questionPackStatusOptions,
  questionTypeLabel,
  questionTypeOptions
} from '@/lib/question-pack-shared';

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function integer(formData: FormData, key: string, fallback = 0) {
  const parsed = Number.parseInt(value(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function options(valueToParse: string) {
  return valueToParse.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function optionsToText(items?: string[]) {
  return (items ?? []).join('\n');
}

function sortQuestions(items: QuestionPackQuestion[]) {
  return [...items].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.text.localeCompare(b.text, 'ru'));
}

function MutationButton({ pending, children, ...props }: React.ComponentProps<typeof Button> & { pending: boolean; children: ReactNode }) {
  return (
    <Button {...props} type="submit" disabled={props.disabled || pending} aria-busy={pending || undefined}>
      {pending && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

export function QuestionPackDetailWorkspace({ initialPack }: { initialPack: QuestionPack }) {
  const router = useRouter();
  const [pack, setPack] = useState(initialPack);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const pendingRef = useRef(new Set<string>());
  const [, startTransition] = useTransition();

  function runMutation(key: string, task: () => Promise<void>) {
    if (pendingRef.current.has(key)) return false;
    pendingRef.current.add(key);
    setPendingKeys((current) => [...current, key]);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingRef.current.delete(key);
        setPendingKeys((current) => current.filter((item) => item !== key));
      }
    });
    return true;
  }

  function isPending(key: string) {
    return pendingKeys.includes(key);
  }

  function errorText(error?: string) {
    if (error === 'demo') return 'Supabase не настроен, изменение не сохранено.';
    if (error === 'pack-not-found') return 'Набор больше не найден.';
    if (error === 'question-not-found') return 'Вопрос больше не найден.';
    if (error === 'pack-required' || error === 'title-required') return 'Укажи название набора.';
    if (error === 'question-required') return 'Заполни текст вопроса.';
    return 'Не удалось сохранить изменения.';
  }

  function updatePack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = value(formData, 'title');
    const key = 'pack:update';
    if (!title || pendingRef.current.has(key)) return;

    const previous = pack;
    const optimistic: QuestionPack = {
      ...pack,
      title,
      shortTitle: value(formData, 'short_title') || title,
      description: value(formData, 'description'),
      audience: (value(formData, 'audience') || 'any') as QuestionPackAudience,
      badge: value(formData, 'badge') || 'набор',
      status: (value(formData, 'status') || 'active') as QuestionPackStatus
    };
    setPack(optimistic);
    runMutation(key, async () => {
      const result = await updateQuestionPackMutation({ ...optimistic, id: pack.id });
      if (!result.ok || !result.item) {
        setPack(previous);
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      const saved = result.item;
      setPack((current) => ({
        ...current,
        title: saved.title,
        shortTitle: saved.shortTitle,
        description: saved.description,
        audience: saved.audience,
        badge: saved.badge,
        status: saved.status
      }));
      setNotice({ tone: 'success', text: 'Настройки набора сохранены.' });
    });
  }

  function deletePack() {
    if (
      pendingRef.current.size > 0
      || !window.confirm(`Удалить набор «${pack.title}»?`)
    ) return;

    runMutation('pack:delete', async () => {
      const result = await deleteQuestionPackMutation(pack.id);
      if (!result.ok) {
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      router.replace('/settings/question-packs?deleted=pack');
    });
  }

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const questionText = value(formData, 'question_text');
    const key = 'question:create';
    if (!questionText || pendingRef.current.has(key)) return;

    const temporaryId = `temporary-question-${crypto.randomUUID()}`;
    const temporary: QuestionPackQuestion = {
      id: temporaryId,
      text: questionText,
      type: (value(formData, 'question_type') || 'short_text') as QuestionType,
      options: options(value(formData, 'options')),
      required: formData.get('required') === 'on',
      orderIndex: integer(formData, 'order_index', pack.questions.length + 1)
    };
    setPack((current) => ({ ...current, questions: sortQuestions([...current.questions, temporary]) }));
    runMutation(key, async () => {
      const result = await addQuestionToPackMutation({
        packId: pack.id,
        text: temporary.text,
        type: temporary.type,
        options: temporary.options,
        required: temporary.required,
        orderIndex: temporary.orderIndex
      });
      if (!result.ok || !result.item) {
        setPack((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== temporaryId) }));
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      const savedQuestion = result.item;
      setPack((current) => ({
        ...current,
        questions: sortQuestions(current.questions.map((item) => item.id === temporaryId ? savedQuestion : item))
      }));
      form.reset();
      const orderInput = form.elements.namedItem('order_index');
      if (orderInput instanceof HTMLInputElement) {
        orderInput.value = String(pack.questions.length + 2);
      }
      setNotice({ tone: 'success', text: 'Вопрос добавлен.' });
    });
  }

  function updateQuestion(event: FormEvent<HTMLFormElement>, question: QuestionPackQuestion) {
    event.preventDefault();
    if (!question.id) return;
    const formData = new FormData(event.currentTarget);
    const questionText = value(formData, 'question_text');
    const key = `question:update:${question.id}`;
    if (!questionText || pendingRef.current.has(key)) return;

    const optimistic: QuestionPackQuestion = {
      ...question,
      text: questionText,
      type: (value(formData, 'question_type') || 'short_text') as QuestionType,
      options: options(value(formData, 'options')),
      required: formData.get('required') === 'on',
      orderIndex: integer(formData, 'order_index', question.orderIndex ?? 0)
    };
    setPack((current) => ({ ...current, questions: sortQuestions(current.questions.map((item) => item.id === question.id ? optimistic : item)) }));
    runMutation(key, async () => {
      const result = await updateQuestionPackQuestionMutation({
        packId: pack.id,
        questionId: question.id,
        text: optimistic.text,
        type: optimistic.type,
        options: optimistic.options,
        required: optimistic.required,
        orderIndex: optimistic.orderIndex
      });
      if (!result.ok || !result.item) {
        setPack((current) => ({ ...current, questions: sortQuestions(current.questions.map((item) => item.id === question.id ? question : item)) }));
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      const savedQuestion = result.item;
      setPack((current) => ({ ...current, questions: sortQuestions(current.questions.map((item) => item.id === question.id ? savedQuestion : item)) }));
      setNotice({ tone: 'success', text: 'Вопрос сохранен.' });
    });
  }

  function deleteQuestion(question: QuestionPackQuestion) {
    if (!question.id) return;
    const key = `question:delete:${question.id}`;
    if (
      pendingRef.current.has(key)
      || !window.confirm(`Удалить вопрос «${question.text}»?`)
    ) return;

    setPack((current) => ({ ...current, questions: current.questions.filter((item) => item.id !== question.id) }));
    runMutation(key, async () => {
      const result = await deleteQuestionPackQuestionMutation({ packId: pack.id, questionId: question.id as string });
      if (!result.ok) {
        setPack((current) => ({ ...current, questions: sortQuestions([...current.questions, question]) }));
        setNotice({ tone: 'error', text: errorText(result.error) });
        return;
      }
      setNotice({ tone: 'success', text: 'Вопрос удален.' });
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div role="status" aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {notice.text}
        </div>
      )}

      <Card key={`${pack.id}-${pack.title}-${pack.shortTitle}-${pack.status ?? ''}`}>
        <CardHeader><CardTitle>Настройки набора</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={updatePack} className="grid gap-4 lg:grid-cols-2">
            <div><label className="mb-2 block text-sm font-bold text-app-text">Полное название</label><Input name="title" defaultValue={pack.title} required /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Короткое название</label><Input name="short_title" defaultValue={pack.shortTitle} /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Для кого</label><Select name="audience" defaultValue={pack.audience}>{questionPackAudienceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Статус</label><Select name="status" defaultValue={pack.status ?? 'active'}>{questionPackStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Бейдж</label><Input name="badge" defaultValue={pack.badge} /></div>
            <div className="lg:col-span-2"><label className="mb-2 block text-sm font-bold text-app-text">Описание</label><Textarea name="description" defaultValue={pack.description} /></div>
            <div className="flex flex-wrap gap-2 lg:col-span-2"><MutationButton pending={isPending('pack:update')}><Save className="h-4 w-4" />Сохранить набор</MutationButton></div>
          </form>
          <div className="mt-4 border-t border-app-line pt-4">
            <Button type="button" variant="danger" disabled={pendingKeys.length > 0} aria-busy={isPending('pack:delete') || undefined} onClick={deletePack}>
              {isPending('pack:delete') ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить набор
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Добавить вопрос</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addQuestion} className="grid gap-4 lg:grid-cols-[90px_1fr_190px] lg:items-end">
            <div><label className="mb-2 block text-sm font-bold text-app-text">Порядок</label><Input name="order_index" type="number" min="1" defaultValue={String(pack.questions.length + 1)} /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Вопрос</label><Input name="question_text" placeholder="Например: как сейчас клиенты записываются?" required /></div>
            <div><label className="mb-2 block text-sm font-bold text-app-text">Тип</label><Select name="question_type" defaultValue="short_text">{questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
            <div className="lg:col-span-3"><label className="mb-2 block text-sm font-bold text-app-text">Варианты ответа</label><Textarea name="options" placeholder="Для вопросов с вариантами. Каждый вариант с новой строки." /></div>
            <label className="flex items-center gap-2 text-sm font-semibold text-app-muted lg:col-span-3"><input type="checkbox" name="required" className="h-4 w-4" />Обязательный вопрос</label>
            <div className="lg:col-span-3"><MutationButton pending={isPending('question:create')}>Добавить вопрос</MutationButton></div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black text-app-text">Вопросы набора</h2><Badge tone="gray">{pack.questions.length} вопросов</Badge></div>
        {pack.questions.length ? pack.questions.map((question, index) => {
          const updateKey = `question:update:${question.id}`;
          const deleteKey = `question:delete:${question.id}`;
          return (
            <Card key={`${question.id ?? index}-${question.text}-${question.orderIndex}`} className="performance-contain">
              <CardContent className="space-y-4">
                <form onSubmit={(event) => updateQuestion(event, question)} className="grid gap-4 lg:grid-cols-[90px_1fr_190px] lg:items-end">
                  <div><label className="mb-2 block text-sm font-bold text-app-text">Порядок</label><Input name="order_index" type="number" min="1" defaultValue={String(question.orderIndex ?? index + 1)} /></div>
                  <div><label className="mb-2 block text-sm font-bold text-app-text">Вопрос</label><Input name="question_text" defaultValue={question.text} required /></div>
                  <div><label className="mb-2 block text-sm font-bold text-app-text">Тип</label><Select name="question_type" defaultValue={question.type}>{questionTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
                  <div className="lg:col-span-3"><label className="mb-2 block text-sm font-bold text-app-text">Варианты ответа</label><Textarea name="options" defaultValue={optionsToText(question.options)} placeholder="Для вариантов выбора. Каждый вариант с новой строки." /></div>
                  <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-app-muted"><input type="checkbox" name="required" defaultChecked={Boolean(question.required)} className="h-4 w-4" />Обязательный вопрос</label>
                    <div className="flex flex-wrap gap-2"><Badge tone="purple">{questionTypeLabel(question.type)}</Badge><MutationButton variant="secondary" size="sm" pending={isPending(updateKey)}>Сохранить вопрос</MutationButton></div>
                  </div>
                </form>
                {question.id && (
                  <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isPending(deleteKey)} aria-busy={isPending(deleteKey) || undefined} onClick={() => deleteQuestion(question)}>
                    {isPending(deleteKey) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Удалить вопрос
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        }) : <Card><CardContent className="py-10 text-center text-sm text-app-muted">В этом наборе пока нет вопросов. Добавь первый вопрос выше.</CardContent></Card>}
      </div>
    </div>
  );
}
