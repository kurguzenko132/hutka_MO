'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from 'react';
import { AlertTriangle, Check, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import {
  addSurveyQuestionMutationAction,
  deleteSurveyQuestionMutationAction,
  type SurveyQuestionMutationInput
} from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { SurveyQuestion } from '@/lib/surveys';

const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice']);
const DEFAULT_OPTIONS = ['Вариант 1', 'Вариант 2'];

function questionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    short_text: 'Короткий ответ',
    long_text: 'Длинный ответ',
    single_choice: 'Один вариант',
    multiple_choice: 'Несколько вариантов',
    yes_no: 'Да / нет',
    rating: 'Оценка',
    number: 'Число'
  };
  return labels[type] ?? type;
}

type SurveyQuestionsContextValue = {
  questions: SurveyQuestion[];
  addPending: boolean;
  deletePendingIds: string[];
  addQuestion: (input: SurveyQuestionMutationInput) => Promise<boolean>;
  deleteQuestion: (question: SurveyQuestion) => Promise<void>;
};

const SurveyQuestionsContext = createContext<SurveyQuestionsContextValue | null>(null);

function useSurveyQuestions() {
  const value = useContext(SurveyQuestionsContext);
  if (!value) throw new Error('Survey question controls must be inside SurveyQuestionsProvider.');
  return value;
}

function optionsToText(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean).join('\n');
}

function sortQuestions(questions: SurveyQuestion[]) {
  return [...questions].sort((a, b) => a.orderIndex - b.orderIndex || a.text.localeCompare(b.text, 'ru'));
}

export function SurveyQuestionsProvider({
  surveyId,
  initialQuestions,
  children
}: {
  surveyId: string;
  initialQuestions: SurveyQuestion[];
  children: ReactNode;
}) {
  const [questions, setQuestions] = useState(sortQuestions(initialQuestions));
  const [addPending, setAddPending] = useState(false);
  const [deletePendingIds, setDeletePendingIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const pendingRef = useRef(false);

  async function addQuestion(input: SurveyQuestionMutationInput) {
    if (pendingRef.current || addPending || deletePendingIds.length > 0) return false;

    const temporaryId = `pending-${Date.now()}`;
    const draft: SurveyQuestion = {
      id: temporaryId,
      text: input.text.trim(),
      type: input.type,
      options: input.options,
      required: input.required,
      orderIndex: Math.max(0, ...questions.map((question) => question.orderIndex)) + 1
    };

    pendingRef.current = true;
    setAddPending(true);
    setNotice('Добавляю вопрос...');
    setNoticeError(false);
    setQuestions((current) => [...current, draft]);

    try {
      const result = await addSurveyQuestionMutationAction({
        ...input,
        surveyId,
        orderIndex: draft.orderIndex
      });
      if (!result.ok || !result.question) {
        setQuestions((current) => current.filter((question) => question.id !== temporaryId));
        setNotice('Не удалось добавить вопрос. Изменение отменено.');
        setNoticeError(true);
        return false;
      }

      setQuestions((current) => sortQuestions(
        current.map((question) => question.id === temporaryId ? result.question as SurveyQuestion : question)
      ));
      setNotice('Вопрос добавлен.');
      return true;
    } catch {
      setQuestions((current) => current.filter((question) => question.id !== temporaryId));
      setNotice('Не удалось связаться с сервером. Изменение отменено.');
      setNoticeError(true);
      return false;
    } finally {
      pendingRef.current = false;
      setAddPending(false);
    }
  }

  async function deleteQuestion(question: SurveyQuestion) {
    if (
      pendingRef.current ||
      addPending ||
      deletePendingIds.length > 0 ||
      !window.confirm(`Удалить вопрос «${question.text}»?`)
    ) return;

    pendingRef.current = true;
    setDeletePendingIds((current) => [...current, question.id]);
    setNotice('Удаляю вопрос...');
    setNoticeError(false);
    setQuestions((current) => current.filter((item) => item.id !== question.id));

    try {
      const result = await deleteSurveyQuestionMutationAction({
        surveyId,
        questionId: question.id
      });
      if (!result.ok) {
        setQuestions((current) => sortQuestions([...current, question]));
        setNotice('Не удалось удалить вопрос. Он возвращен в анкету.');
        setNoticeError(true);
      } else {
        setNotice('Вопрос удален.');
      }
    } catch {
      setQuestions((current) => sortQuestions([...current, question]));
      setNotice('Не удалось связаться с сервером. Вопрос возвращен в анкету.');
      setNoticeError(true);
    } finally {
      pendingRef.current = false;
      setDeletePendingIds((current) => current.filter((id) => id !== question.id));
    }
  }

  return (
    <SurveyQuestionsContext.Provider value={{
      questions,
      addPending,
      deletePendingIds,
      addQuestion,
      deleteQuestion
    }}>
      {notice ? (
        <div
          aria-live="polite"
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
            noticeError ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {noticeError ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
          <span>{notice}</span>
        </div>
      ) : null}
      {children}
    </SurveyQuestionsContext.Provider>
  );
}

export function SurveyQuestionList({ canManageSurveys }: { canManageSurveys: boolean }) {
  const { questions, addPending, deletePendingIds, deleteQuestion } = useSurveyQuestions();

  return (
    <FormSection title="Вопросы анкеты">
      <div className="space-y-3">
        {questions.length === 0 && (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-app-muted">
            {canManageSurveys ? 'Пока вопросов нет. Добавь первый вопрос справа.' : 'Пока вопросов нет.'}
          </p>
        )}
        {questions.map((question, index) => {
          const pending = deletePendingIds.includes(question.id);
          return (
            <div key={question.id} className="performance-contain rounded-2xl border border-app-line bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-sm font-black text-app-purple">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-app-text">{question.text}</p>
                    {question.required && <Badge tone="red">Обязательный</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-app-muted">{questionTypeLabel(question.type)}</p>
                    {canManageSurveys && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={addPending || deletePendingIds.length > 0}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => void deleteQuestion(question)}
                      >
                        {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Удалить вопрос
                      </Button>
                    )}
                  </div>
                  {question.options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.options.map((option) => <Badge key={option} tone="gray">{option}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}

export function SurveyQuestionCountBadge() {
  const { questions } = useSurveyQuestions();
  return <Badge tone="blue">{questions.length} вопросов</Badge>;
}

export function AddSurveyQuestionForm({ surveyId }: { surveyId: string }) {
  const { addPending, deletePendingIds, addQuestion } = useSurveyQuestions();
  const [type, setType] = useState('long_text');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const showOptions = CHOICE_TYPES.has(type);
  const busy = addPending || deletePendingIds.length > 0;

  function changeType(value: string) {
    setType(value);
    if (CHOICE_TYPES.has(value) && options.length === 0) setOptions(DEFAULT_OPTIONS);
  }

  function updateOption(index: number, value: string) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function addOption() {
    setOptions((current) => [...current, `Вариант ${current.length + 1}`]);
  }

  function removeOption(index: number) {
    setOptions((current) => {
      const next = current.filter((_, optionIndex) => optionIndex !== index);
      return next.length > 0 ? next : DEFAULT_OPTIONS;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const created = await addQuestion({
      surveyId,
      text: String(formData.get('question_text') ?? ''),
      type,
      options: showOptions ? options.map((option) => option.trim()).filter(Boolean) : [],
      required: formData.get('required') === 'on'
    });

    if (created) {
      form.reset();
      setType('long_text');
      setOptions(DEFAULT_OPTIONS);
    }
  }

  return (
    <form onSubmit={submit}>
      <input type="hidden" name="question_options" value={showOptions ? optionsToText(options) : ''} />
      <FormSection title="Добавить вопрос" subtitle="Новый вопрос сразу появится в публичной форме.">
        <div className="space-y-4">
          <Field label="Текст вопроса">
            <Input name="question_text" placeholder="Например: что мешает вам расти?" required disabled={busy} />
          </Field>
          <Field label="Тип вопроса">
            <Select name="question_type" value={type} disabled={busy} onChange={(event) => changeType(event.target.value)}>
              <option value="short_text">Короткий ответ</option>
              <option value="long_text">Длинный ответ</option>
              <option value="single_choice">Один вариант</option>
              <option value="multiple_choice">Несколько вариантов</option>
              <option value="yes_no">Да / нет</option>
              <option value="rating">Оценка</option>
              <option value="number">Число</option>
            </Select>
          </Field>

          {showOptions && (
            <Field label="Варианты ответа" hint="Эти варианты увидит человек в публичной анкете.">
              <div className="space-y-2 rounded-2xl border border-app-line bg-white p-3">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input value={option} disabled={busy} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Вариант ${index + 1}`} />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeOption(index)}
                      aria-label="Удалить вариант"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={addOption}>
                  <Plus className="h-4 w-4" />
                  Добавить вариант ответа
                </Button>
              </div>
            </Field>
          )}

          {type === 'yes_no' && (
            <p className="rounded-2xl border border-app-line bg-white p-3 text-xs font-semibold text-app-muted">
              В публичной анкете автоматически будут варианты: Да / Нет.
            </p>
          )}
          {type === 'rating' && (
            <p className="rounded-2xl border border-app-line bg-white p-3 text-xs font-semibold text-app-muted">
              В публичной анкете автоматически будет шкала оценки от 1 до 5.
            </p>
          )}

          <label className="flex items-center gap-2 rounded-2xl border border-app-line bg-white p-3 text-sm font-semibold text-app-text">
            <input name="required" type="checkbox" disabled={busy} className="h-4 w-4 rounded border-app-line" />
            Обязательный вопрос
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {addPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Добавить вопрос
          </Button>
        </div>
      </FormSection>
    </form>
  );
}
