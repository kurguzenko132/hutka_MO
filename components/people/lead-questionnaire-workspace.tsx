'use client';

import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileQuestion,
  Link2,
  LoaderCircle,
  PackageCheck,
  PlusCircle,
  Trash2
} from 'lucide-react';
import {
  createLeadQuestionnaireFromPackMutationAction,
  createLeadQuestionnaireMutationAction,
  deleteLeadQuestionnaireMutationAction,
  type LeadQuestionnaireMutationQuestion
} from '@/actions/lead-questionnaires.actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { LeadQuestionnaireListItem, LeadQuestionnaireStatus } from '@/lib/lead-questionnaires';
import type { QuestionPack } from '@/lib/question-pack-shared';

type EditableQuestion = LeadQuestionnaireMutationQuestion & {
  optionsText: string;
};

function initialQuestions(): EditableQuestion[] {
  return Array.from({ length: 5 }, (_, index) => ({
    text: '',
    type: index === 0 ? 'long_text' : 'short_text',
    options: [],
    optionsText: '',
    required: index <= 2
  }));
}

function questionnaireStatusLabel(status: LeadQuestionnaireStatus) {
  const labels: Record<LeadQuestionnaireStatus, string> = {
    draft: 'Черновик',
    active: 'Активна',
    closed: 'Закрыта'
  };
  return labels[status];
}

function optimisticQuestionnaire(input: {
  id: string;
  leadId: string;
  title: string;
  description?: string;
  questionsCount: number;
}): LeadQuestionnaireListItem {
  return {
    id: input.id,
    leadId: input.leadId,
    title: input.title,
    description: input.description,
    status: 'active',
    token: input.id,
    publicUrl: 'Ссылка создается...',
    questionsCount: input.questionsCount,
    responsesCount: 0,
    createdAt: 'Только что'
  };
}

export function LeadQuestionnaireWorkspace({
  leadId,
  leadName,
  initialItems,
  packs,
  canManage
}: {
  leadId: string;
  leadName: string;
  initialItems: LeadQuestionnaireListItem[];
  packs: QuestionPack[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState(`Вопросы для ${leadName}`);
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>(initialQuestions);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  function start(action: string, message: string) {
    setPending(action);
    setNotice(message);
    setNoticeError(false);
  }

  function fail(message: string) {
    setNotice(message);
    setNoticeError(true);
  }

  async function createFromPack(pack: QuestionPack) {
    if (pending) return;
    const optimisticId = `optimistic-pack-${Date.now()}`;
    const previousItems = items;
    start(`pack:${pack.id}`, 'Создаю ссылку из готовых вопросов...');
    setItems((current) => [
      optimisticQuestionnaire({
        id: optimisticId,
        leadId,
        title: pack.shortTitle,
        description: pack.description,
        questionsCount: pack.questions.length
      }),
      ...current
    ]);

    try {
      const result = await createLeadQuestionnaireFromPackMutationAction({
        leadId,
        packId: pack.id
      });
      if (!result.ok || !result.questionnaire) {
        setItems(previousItems);
        fail('Не удалось создать ссылку из готовых вопросов.');
      } else {
        const questionnaire = result.questionnaire;
        setItems((current) => current.map((item) => item.id === optimisticId ? questionnaire : item));
        setNotice('Ссылка на вопросы создана.');
      }
    } catch {
      setItems(previousItems);
      fail('Не удалось связаться с сервером. Изменение отменено.');
    } finally {
      setPending('');
    }
  }

  async function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const payload = questions
      .map((question) => ({
        text: question.text.trim(),
        type: question.type,
        options: question.optionsText.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
        required: question.required
      }))
      .filter((question) => question.text);
    if (payload.length === 0) {
      fail('Добавь хотя бы один вопрос.');
      return;
    }

    const optimisticId = `optimistic-custom-${Date.now()}`;
    const previousItems = items;
    start('custom', 'Создаю персональную ссылку...');
    setItems((current) => [
      optimisticQuestionnaire({
        id: optimisticId,
        leadId,
        title: title.trim() || `Вопросы для ${leadName}`,
        description: description.trim() || undefined,
        questionsCount: payload.length
      }),
      ...current
    ]);

    try {
      const result = await createLeadQuestionnaireMutationAction({
        leadId,
        title,
        description,
        questions: payload
      });
      if (!result.ok || !result.questionnaire) {
        setItems(previousItems);
        fail('Не удалось создать ссылку на вопросы.');
      } else {
        const questionnaire = result.questionnaire;
        setItems((current) => current.map((item) => item.id === optimisticId ? questionnaire : item));
        setDescription('');
        setQuestions(initialQuestions());
        setNotice('Персональная ссылка создана.');
      }
    } catch {
      setItems(previousItems);
      fail('Не удалось связаться с сервером. Изменение отменено.');
    } finally {
      setPending('');
    }
  }

  async function removeQuestionnaire(item: LeadQuestionnaireListItem) {
    if (pending) return;
    if ((confirmations[item.id] ?? '').trim() !== 'УДАЛИТЬ') {
      fail('Для удаления введи УДАЛИТЬ.');
      return;
    }

    const previousItems = items;
    start(`delete:${item.id}`, 'Удаляю вопросы...');
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));

    try {
      const result = await deleteLeadQuestionnaireMutationAction({
        questionnaireId: item.id,
        leadId,
        confirmation: confirmations[item.id]
      });
      if (!result.ok) {
        setItems(previousItems);
        fail('Не удалось удалить вопросы. Они возвращены в список.');
      } else {
        setConfirmations((current) => ({ ...current, [item.id]: '' }));
        setNotice('Вопросы удалены.');
      }
    } catch {
      setItems(previousItems);
      fail('Не удалось связаться с сервером. Данные восстановлены.');
    } finally {
      setPending('');
    }
  }

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setQuestions((current) => current.map((question, questionIndex) => (
      questionIndex === index ? { ...question, ...patch } : question
    )));
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p aria-live="polite" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${noticeError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {noticeError ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice}</span>
        </p>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-app-purple" />Готовые вопросы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {packs.map((pack) => (
                <div key={pack.id} className="rounded-2xl border border-app-line p-4 transition hover:border-purple-200 hover:bg-purple-50/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-app-text">{pack.shortTitle}</p>
                        <Badge tone="purple">{pack.badge}</Badge>
                        <Badge tone="gray">{pack.questions.length} вопросов</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-app-muted">{pack.description}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={Boolean(pending)}
                      onClick={() => void createFromPack(pack)}
                    >
                      {pending === `pack:${pack.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      Создать ссылку
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <div className="mt-4 break-all rounded-xl bg-app-soft p-3 text-xs font-semibold text-app-muted">
                {item.publicUrl}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!item.id.startsWith('optimistic-') && (
                  <Button asChild size="sm" variant="secondary">
                    <a href={item.publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Открыть ссылку</a>
                  </Button>
                )}
                {canManage && !item.id.startsWith('optimistic-') && (
                  <>
                    <Input
                      value={confirmations[item.id] ?? ''}
                      disabled={Boolean(pending)}
                      onChange={(event) => setConfirmations((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="УДАЛИТЬ"
                      className="h-9 w-32 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={Boolean(pending)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void removeQuestionnaire(item)}
                    >
                      {pending === `delete:${item.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Удалить
                    </Button>
                  </>
                )}
              </div>
            </div>
          )) : (
            <p className="text-sm text-app-muted">
              {canManage ? 'Пока нет вопросов для контакта. Создай ссылку ниже.' : 'Вопросов для контакта пока нет.'}
            </p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PlusCircle className="h-4 w-4 text-app-purple" />Создать свои вопросы</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void createCustom(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-app-text">Название вопросов</span>
                  <Input value={title} disabled={Boolean(pending)} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-app-text">Описание для человека</span>
                  <Input value={description} disabled={Boolean(pending)} onChange={(event) => setDescription(event.target.value)} placeholder="Например: ответьте, чтобы мы подготовили тестирование" />
                </label>
              </div>

              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div key={index} className="rounded-2xl border border-app-line p-4">
                    <p className="mb-3 text-sm font-black text-app-text">Вопрос {index + 1}</p>
                    <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
                      <Input
                        value={question.text}
                        disabled={Boolean(pending)}
                        onChange={(event) => updateQuestion(index, { text: event.target.value })}
                        placeholder={index === 0 ? 'Например: какая главная проблема с записью?' : 'Текст вопроса'}
                      />
                      <Select
                        value={question.type}
                        disabled={Boolean(pending)}
                        onChange={(event) => updateQuestion(index, { type: event.target.value })}
                      >
                        <option value="short_text">Короткий ответ</option>
                        <option value="long_text">Развернутый ответ</option>
                        <option value="yes_no">Да / нет</option>
                        <option value="single_choice">Один вариант</option>
                        <option value="multiple_choice">Несколько вариантов</option>
                        <option value="rating">Оценка</option>
                        <option value="number">Число</option>
                      </Select>
                    </div>
                    <Textarea
                      value={question.optionsText}
                      disabled={Boolean(pending)}
                      onChange={(event) => updateQuestion(index, { optionsText: event.target.value })}
                      className="mt-3"
                      placeholder="Варианты для выбора, если нужны. Каждый вариант с новой строки или через запятую."
                    />
                    <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-app-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(question.required)}
                        disabled={Boolean(pending)}
                        onChange={(event) => updateQuestion(index, { required: event.target.checked })}
                        className="h-4 w-4"
                      />
                      Обязательный вопрос
                    </label>
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={Boolean(pending)}>
                {pending === 'custom' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Создать ссылку на вопросы
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
