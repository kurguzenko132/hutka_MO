'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { completeSurveyResponseMutation, saveSurveyResponseDraftMutation } from '@/actions/surveys.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { questionOptions, surveyOptionLabel, visibleSurveySections, type SurveyAnswers, type SurveyDefinition, type SurveyOption, type SurveyQuestion } from '@/lib/survey-builder';

function tokenForSurvey(surveyId: string, inviteToken?: string) {
  const key = `hutka-survey-${surveyId}-${inviteToken ?? 'public'}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID().replace(/-/g, '');
  window.localStorage.setItem(key, created);
  return created;
}

function selected(value: unknown, item: string) {
  return Array.isArray(value) ? value.includes(item) : value === item;
}

function sourceOptions(definition: SurveyDefinition, question: SurveyQuestion, answers: SurveyAnswers): SurveyOption[] {
  if (!question.optionsSource) return questionOptions(question, answers);
  const selectedValues = Array.isArray(answers[question.optionsSource.question]) ? answers[question.optionsSource.question] as unknown[] : [answers[question.optionsSource.question]];
  return selectedValues.filter((value) => value !== undefined && value !== '').map((value, index) => {
    const stored = String(value);
    return { key: `selected_${index + 1}_${stored}`, value: stored, label: surveyOptionLabel(definition, question.optionsSource!.question, stored) };
  });
}

function QuestionInput({ question, definition, answers, update }: { question: SurveyQuestion; definition: SurveyDefinition; answers: SurveyAnswers; update: (value: unknown) => void }) {
  const value = answers[question.key] ?? (question.type === 'multiple_choice' ? [] : '');
  const options = sourceOptions(definition, question, answers);
  const maxSelections = Number(question.validation?.maxSelections ?? 0);

  if (question.type === 'info') return <p className="text-sm leading-6 text-app-muted">{question.description || question.title}</p>;
  if (question.type === 'section_break') return <div className="border-t border-app-line pt-4 text-base font-black text-app-text">{question.title}</div>;
  if (question.type === 'long_text') return <Textarea value={String(value)} onChange={(event) => update(event.target.value)} placeholder={String(question.validation?.placeholder ?? 'Напишите ответ')} />;
  if (question.type === 'email') return <Input type="email" value={String(value)} onChange={(event) => update(event.target.value)} placeholder="name@example.com" />;
  if (question.type === 'phone') return <Input type="tel" value={String(value)} onChange={(event) => update(event.target.value)} placeholder="+375 ..." />;
  if (question.type === 'number') return <Input type="number" value={String(value)} min={Number(question.validation?.min ?? '') || undefined} max={Number(question.validation?.max ?? '') || undefined} onChange={(event) => update(event.target.value)} />;
  if (question.type === 'city') return <><Input list="hutka-cities" value={String(value)} onChange={(event) => update(event.target.value)} placeholder="Начните вводить город" /><datalist id="hutka-cities"><option value="Минск" /><option value="Москва" /><option value="Санкт-Петербург" /><option value="Варшава" /></datalist></>;
  if (question.type === 'scale' || question.type === 'rating') {
    const min = Number(question.settings?.min ?? 1); const max = Number(question.settings?.max ?? (question.type === 'rating' ? 5 : 5)); const step = Number(question.settings?.step ?? 1);
    const items = Array.from({ length: Math.max(0, Math.floor((max - min) / step) + 1) }, (_, index) => min + index * step);
    return <div className="flex flex-wrap gap-2">{items.map((item) => <label key={item} className={`flex h-10 min-w-10 cursor-pointer items-center justify-center border px-3 text-sm font-bold ${String(value) === String(item) ? 'border-app-purple bg-purple-50 text-app-purple' : 'border-app-line bg-white text-app-text'}`}><input className="sr-only" type="radio" name={question.key} checked={String(value) === String(item)} onChange={() => update(String(item))} />{item}</label>)}</div>;
  }
  if (question.type === 'multiple_choice') return <div className="space-y-2">{options.map((option) => {
    const optionValue = option.value ?? option.key;
    return <label key={option.key} className="flex cursor-pointer items-center gap-3 border border-app-line bg-white p-3 text-sm font-semibold text-app-text"><input type="checkbox" checked={selected(value, optionValue)} onChange={(event) => { const current = Array.isArray(value) ? value.map(String) : []; if (event.target.checked) { if (maxSelections && current.length >= maxSelections) return; update([...current, optionValue]); } else update(current.filter((item) => item !== optionValue)); }} />{option.label}</label>;
  })}</div>;
  if (question.type === 'single_choice' || question.type === 'yes_no') {
    const choices = question.type === 'yes_no' && !options.length ? [{ key: 'yes', label: 'Да', value: 'yes' }, { key: 'no', label: 'Нет', value: 'no' }] : options;
    return <div className="space-y-2">{choices.map((option) => { const optionValue = option.value ?? option.key; return <label key={option.key} className={`flex cursor-pointer items-center gap-3 border p-3 text-sm font-semibold ${String(value) === optionValue ? 'border-app-purple bg-purple-50 text-app-purple' : 'border-app-line bg-white text-app-text'}`}><input type="radio" className="h-4 w-4" name={question.key} checked={String(value) === optionValue} onChange={() => update(optionValue)} />{option.label}</label>; })}</div>;
  }
  return <Input value={String(value)} onChange={(event) => update(event.target.value)} placeholder={String(question.validation?.placeholder ?? 'Введите ответ')} />;
}

export function PublicSurveyBuilder({ surveyId, slug, definition, inviteToken }: { surveyId: string; slug: string; definition: SurveyDefinition; inviteToken?: string }) {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [token, setToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [saving, startTransition] = useTransition();
  const lastSaved = useRef('');
  const sections = useMemo(() => visibleSurveySections(definition, answers), [definition, answers]);
  const questions = sections.flatMap((section) => section.questions).filter((question) => !['info', 'section_break'].includes(question.type));
  const completed = questions.filter((question) => { const value = answers[question.key]; return value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0); }).length;

  useEffect(() => { setToken(tokenForSurvey(surveyId, inviteToken)); }, [inviteToken, surveyId]);
  useEffect(() => {
    if (!token || submitted) return;
    const snapshot = JSON.stringify(answers);
    if (snapshot === lastSaved.current) return;
    const timer = window.setTimeout(() => {
      saveSurveyResponseDraftMutation({ surveyId, slug, token, answers, inviteToken }).then((result) => { if (result.ok) lastSaved.current = snapshot; });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, inviteToken, slug, submitted, surveyId, token]);

  function update(question: SurveyQuestion, value: unknown) {
    setAnswers((current) => ({ ...current, [question.key]: value }));
    setError('');
  }

  function submit() {
    if (!token) return;
    startTransition(async () => {
      const result = await completeSurveyResponseMutation({ surveyId, slug, token, answers, inviteToken });
      if (!result.ok) {
        const errorCode = 'error' in result ? result.error : '';
        setError(errorCode === 'required'
          ? 'Ответьте на все обязательные видимые вопросы.'
          : errorCode === 'invite-completed' || errorCode === 'already-completed'
            ? 'Ответ по этой ссылке уже получен.'
            : 'Не удалось сохранить ответы. Попробуйте еще раз.');
        return;
      }
      lastSaved.current = JSON.stringify(answers);
      setSubmitted(true);
    });
  }

  if (submitted) return <div className="border border-emerald-100 bg-white p-7 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-4 text-2xl font-black text-app-text">{definition.survey.completionScreen?.title || 'Спасибо за ответы'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-muted">{definition.survey.completionScreen?.description || 'Ответ сохранен.'}</p></div>;

  return <div className="space-y-5">
    {questions.length > 0 && <div className="border border-app-line bg-white p-3"><div className="flex items-center justify-between text-xs font-bold text-app-muted"><span>Прогресс</span><span>{completed} из {questions.length}</span></div><div className="mt-2 h-2 overflow-hidden bg-slate-100"><div className="h-full bg-app-purple transition-all" style={{ width: `${questions.length ? (completed / questions.length) * 100 : 0}%` }} /></div></div>}
    {sections.map((section) => <section key={section.key} className="space-y-4"><div><h2 className="text-lg font-black text-app-text">{section.title}</h2>{section.description && <p className="mt-1 text-sm text-app-muted">{section.description}</p>}</div>{section.questions.map((question) => <div key={question.key} className="border border-app-line bg-white p-4 sm:p-5"><div className="mb-3"><p className="text-base font-black text-app-text">{question.title}{question.required && question.type !== 'info' && <span className="text-app-red"> *</span>}</p>{question.description && question.type !== 'info' && <p className="mt-1 text-sm text-app-muted">{question.description}</p>}</div><QuestionInput question={question} definition={definition} answers={answers} update={(value) => update(question, value)} /></div>)}</section>)}
    {error && <p role="alert" className="border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    <div className="sticky bottom-3 border border-app-line bg-white/95 p-3"><Button type="button" size="lg" className="w-full" onClick={submit} disabled={saving || !token}><Send className="h-4 w-4" />{saving ? 'Сохраняем…' : 'Отправить ответы'}</Button><p className="mt-2 text-center text-xs text-app-muted">Ответы сохраняются автоматически.</p></div>
  </div>;
}
