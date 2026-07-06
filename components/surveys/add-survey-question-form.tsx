'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addSurveyQuestionAction } from '@/actions/surveys.actions';
import { Field, FormSection } from '@/components/forms/form-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice']);
const DEFAULT_OPTIONS = ['Вариант 1', 'Вариант 2'];

function optionsToText(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean).join('\n');
}

export function AddSurveyQuestionForm({ surveyId }: { surveyId: string }) {
  const [type, setType] = useState('long_text');
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const showOptions = CHOICE_TYPES.has(type);

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

  return (
    <form action={addSurveyQuestionAction}>
      <input type="hidden" name="survey_id" value={surveyId} />
      <input type="hidden" name="question_options" value={showOptions ? optionsToText(options) : ''} />
      <FormSection title="Добавить вопрос" subtitle="Новый вопрос сразу появится в публичной форме.">
        <div className="space-y-4">
          <Field label="Текст вопроса">
            <Input name="question_text" placeholder="Например: что мешает вам расти?" required />
          </Field>
          <Field label="Тип вопроса">
            <Select name="question_type" value={type} onChange={(event) => changeType(event.target.value)}>
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
                    <Input value={option} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Вариант ${index + 1}`} />
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeOption(index)}
                      aria-label="Удалить вариант"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addOption}>
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
            <input name="required" type="checkbox" className="h-4 w-4 rounded border-app-line" />
            Обязательный вопрос
          </label>
          <Button type="submit" className="w-full"><Plus className="h-4 w-4" />Добавить вопрос</Button>
        </div>
      </FormSection>
    </form>
  );
}
