'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/forms/form-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const MAX_QUESTIONS = 50;

type QuestionDraft = {
  id: number;
  text: string;
  type: string;
  required: boolean;
  options: string;
};

const initialQuestions: QuestionDraft[] = [
  { id: 1, text: 'Как вы сейчас ведете запись?', type: 'long_text', required: true, options: '' },
  { id: 2, text: 'Какая главная проблема в привлечении клиентов?', type: 'long_text', required: true, options: '' },
  { id: 3, text: 'Готовы ли протестировать карту мастеров?', type: 'yes_no', required: true, options: 'Да, Нет' },
  { id: 4, text: 'Что должно быть в приложении, чтобы вы реально им пользовались?', type: 'long_text', required: false, options: '' },
  { id: 5, text: '', type: 'short_text', required: false, options: '' },
  { id: 6, text: '', type: 'short_text', required: false, options: '' }
];

function createEmptyQuestion(id: number): QuestionDraft {
  return {
    id,
    text: '',
    type: 'short_text',
    required: false,
    options: ''
  };
}

export function SurveyQuestionBuilder() {
  const [questions, setQuestions] = useState<QuestionDraft[]>(initialQuestions);
  const [nextId, setNextId] = useState(initialQuestions.length + 1);

  const filledCount = useMemo(
    () => questions.filter((question) => question.text.trim().length > 0).length,
    [questions]
  );

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((current) => [...current, createEmptyQuestion(nextId)]);
    setNextId((current) => current + 1);
  }

  function removeQuestion(id: number) {
    setQuestions((current) => {
      if (current.length <= 1) return current;
      return current.filter((question) => question.id !== id);
    });
  }

  function updateQuestion(id: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question) => (question.id === id ? { ...question, ...patch } : question)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-app-text">Вопросов заполнено: {filledCount}</p>
          <p className="mt-1 text-xs font-semibold text-app-muted">
            Можно добавить до {MAX_QUESTIONS} вопросов. Пустые вопросы не сохраняются.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={addQuestion} disabled={questions.length >= MAX_QUESTIONS}>
          <Plus className="h-4 w-4" />
          Добавить вопрос
        </Button>
      </div>

      <div className="space-y-3">
        {questions.map((question, index) => {
          const number = index + 1;
          return (
            <div key={question.id} className="rounded-2xl border border-app-line bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-app-purple shadow-sm">
                  {number}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <Input
                    name={`question_text_${number}`}
                    value={question.text}
                    onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                    placeholder="Текст вопроса"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      name={`question_type_${number}`}
                      value={question.type}
                      onChange={(event) => updateQuestion(question.id, { type: event.target.value })}
                    >
                      <option value="short_text">Короткий ответ</option>
                      <option value="long_text">Длинный ответ</option>
                      <option value="single_choice">Один вариант</option>
                      <option value="multiple_choice">Несколько вариантов</option>
                      <option value="yes_no">Да / нет</option>
                      <option value="rating">Оценка</option>
                    </Select>
                    <label className="flex h-10 items-center gap-2 rounded-xl border border-app-line bg-white px-3 text-sm font-semibold text-app-text">
                      <input
                        name={`question_required_${number}`}
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                        className="h-4 w-4 rounded border-app-line"
                      />
                      Обязательный
                    </label>
                  </div>
                  <Field label="Варианты ответа" hint="Нужно только для вопросов с выбором. Вводи через запятую или с новой строки.">
                    <Textarea
                      name={`question_options_${number}`}
                      value={question.options}
                      onChange={(event) => updateQuestion(question.id, { options: event.target.value })}
                      placeholder="Да, Нет, Возможно"
                    />
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeQuestion(question.id)}
                      disabled={questions.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить вопрос
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
