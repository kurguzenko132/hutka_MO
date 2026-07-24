'use client';

import { ChangeEvent, useMemo, useRef, useState, useTransition } from 'react';
import { Download, FileJson2, Plus, Save, Send, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import individualMasterTemplate from '@/data/surveys/individual-master-survey-v1.json';
import { duplicateSurveyBuilderMutation, saveSurveyBuilderMutation } from '@/actions/surveys.actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  emptySurveyDefinition,
  normalizeSurveyDefinition,
  removeSurveyQuestions,
  surveyElementTypes,
  validateSurveyDefinition,
  type SurveyCondition,
  type SurveyDefinition,
  type SurveyElementType,
  type SurveyClassificationRule,
  type SurveyQuestion,
  type SurveySection
} from '@/lib/survey-builder';

const typeLabels: Record<SurveyElementType, string> = {
  info: 'Информационный блок', short_text: 'Короткий текст', long_text: 'Длинный текст',
  single_choice: 'Один вариант', multiple_choice: 'Несколько вариантов', scale: 'Шкала',
  number: 'Число', email: 'Email', phone: 'Телефон', city: 'Город', section_break: 'Разделитель',
  yes_no: 'Да / нет', rating: 'Оценка'
};
const choiceTypes = new Set<SurveyElementType>(['single_choice', 'multiple_choice', 'yes_no']);
const conditionOperators = [
  ['equals', 'равно'], ['not_equals', 'не равно'], ['contains', 'содержит'], ['not_contains', 'не содержит'],
  ['in', 'в списке'], ['not_in', 'не в списке'], ['greater_than', 'больше'], ['greater_or_equal', 'больше или равно'],
  ['less_than', 'меньше'], ['less_or_equal', 'меньше или равно'], ['is_answered', 'есть ответ'], ['is_not_answered', 'нет ответа']
] as const;

type Notice = { tone: 'success' | 'error'; text: string } | null;

function keyFrom(value: string, fallback: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return normalized && /^[a-z]/.test(normalized) ? normalized : fallback;
}

function makeQuestion(index: number): SurveyQuestion {
  return { key: `question_${index}`, type: 'short_text', title: 'Новый вопрос' };
}

function displayValidation(validation: ReturnType<typeof validateSurveyDefinition>) {
  return [
    `${validation.summary.sections} разделов`, `${validation.summary.questions} вопросов`,
    `${validation.summary.branches} условий`, `${validation.summary.classificationRules} правил`
  ].join(' · ');
}

export function SurveyBuilderWorkspace({
  initialDefinition,
  surveyId,
  canManage = true
}: {
  initialDefinition?: SurveyDefinition;
  surveyId?: string;
  canManage?: boolean;
}) {
  const [definition, setDefinition] = useState<SurveyDefinition>(initialDefinition ?? emptySurveyDefinition());
  const [selected, setSelected] = useState<{ section: number; question: number }>({ section: 0, question: 0 });
  const [jsonText, setJsonText] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const validation = useMemo(() => validateSurveyDefinition(definition), [definition]);
  const section = definition.sections[selected.section] ?? definition.sections[0];
  const question = section?.questions[selected.question] ?? section?.questions[0];
  const allQuestions = definition.sections.flatMap((item) => item.questions);

  function replaceDefinition(next: SurveyDefinition) {
    setDefinition(next);
    setSelected({ section: 0, question: 0 });
    setNotice(null);
  }

  function importText(source: string) {
    if (new TextEncoder().encode(source).byteLength > 2 * 1024 * 1024) {
      setNotice({ tone: 'error', text: 'JSON-файл больше 2 МБ.' });
      return;
    }
    try {
      const parsed = JSON.parse(source) as unknown;
      const result = validateSurveyDefinition(parsed);
      if (!result.ok || !result.definition) {
        setNotice({ tone: 'error', text: result.errors[0] ?? 'Не удалось проверить JSON.' });
        return;
      }
      replaceDefinition(result.definition);
      setNotice({ tone: 'success', text: `Готово к импорту: ${displayValidation(result)}.` });
    } catch {
      setNotice({ tone: 'error', text: 'В тексте есть ошибка JSON.' });
    }
  }

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ tone: 'error', text: 'JSON-файл больше 2 МБ.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result ?? '');
      setJsonText(source);
      importText(source);
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function updateSurvey(patch: Partial<SurveyDefinition['survey']>) {
    setDefinition((current) => ({ ...current, survey: { ...current.survey, ...patch } }));
  }

  function updateQuestion(patch: Partial<SurveyQuestion>) {
    setDefinition((current) => ({
      ...current,
      sections: current.sections.map((item, sectionIndex) => sectionIndex !== selected.section ? item : {
        ...item,
        questions: item.questions.map((entry, questionIndex) => questionIndex !== selected.question ? entry : { ...entry, ...patch })
      })
    }));
  }

  function addSection() {
    const index = definition.sections.length + 1;
    setDefinition((current) => ({ ...current, sections: [...current.sections, { key: `section_${index}`, title: `Раздел ${index}`, questions: [makeQuestion(index)] }] }));
    setSelected({ section: index - 1, question: 0 });
  }

  function removeSection(index: number) {
    if (definition.sections.length < 2) return;
    const removedKeys = definition.sections[index]?.questions.map((item) => item.key) ?? [];
    const cleanup = removeSurveyQuestions(definition, removedKeys);
    setDefinition(cleanup.definition);
    setSelected({ section: 0, question: 0 });
    if (cleanup.clearedVisibility || cleanup.clearedOptionSources || cleanup.removedRules) {
      setNotice({ tone: 'success', text: `Раздел удален. Очищено: условий ${cleanup.clearedVisibility}, источников вариантов ${cleanup.clearedOptionSources}, правил ${cleanup.removedRules}.` });
    }
  }

  function addQuestion(sectionIndex: number) {
    const next = allQuestions.length + 1;
    setDefinition((current) => ({ ...current, sections: current.sections.map((item, index) => index === sectionIndex ? { ...item, questions: [...item.questions, makeQuestion(next)] } : item) }));
    setSelected({ section: sectionIndex, question: definition.sections[sectionIndex].questions.length });
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    if (definition.sections[sectionIndex].questions.length < 2) return;
    const key = definition.sections[sectionIndex]?.questions[questionIndex]?.key;
    if (!key) return;
    const cleanup = removeSurveyQuestions(definition, [key]);
    setDefinition(cleanup.definition);
    setSelected({ section: sectionIndex, question: 0 });
    if (cleanup.clearedVisibility || cleanup.clearedOptionSources || cleanup.removedRules) {
      setNotice({ tone: 'success', text: `Вопрос удален. Очищено: условий ${cleanup.clearedVisibility}, источников вариантов ${cleanup.clearedOptionSources}, правил ${cleanup.removedRules}.` });
    }
  }

  function updateOptions(value: string) {
    const options = value.split('\n').map((label, index) => ({ key: keyFrom(label, `option_${index + 1}`), label: label.trim() })).filter((option) => option.label);
    updateQuestion({ options });
  }

  function setVisibility(condition?: SurveyCondition) {
    updateQuestion({ visibility: condition ? { all: [condition] } : undefined });
  }

  function updateRule(index: number, patch: Partial<SurveyClassificationRule>) {
    setDefinition((current) => ({ ...current, classificationRules: (current.classificationRules ?? []).map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) }));
  }

  function addRule() {
    const index = (definition.classificationRules?.length ?? 0) + 1;
    const source = allQuestions[0];
    if (!source) return;
    setDefinition((current) => ({ ...current, classificationRules: [...(current.classificationRules ?? []), { key: `rule_${index}`, title: `Правило ${index}`, priority: index * 10, when: { all: [{ question: source.key, operator: 'is_answered' }] }, actions: [{ type: 'create_task', title: 'Связаться по итогам анкеты', dueInDays: 1, priority: 'medium' }] }] }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${definition.survey.key || 'survey'}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function save(mode: 'save' | 'publish') {
    const finalValidation = validateSurveyDefinition(definition);
    if (!finalValidation.ok || !finalValidation.definition) {
      setNotice({ tone: 'error', text: finalValidation.errors[0] ?? 'Исправьте анкету перед сохранением.' });
      return;
    }
    const validDefinition = finalValidation.definition;
    startTransition(async () => {
      const result = await saveSurveyBuilderMutation({ surveyId, definition: validDefinition, mode });
      if (!result.ok) {
        const text = result.error === 'published-locked'
          ? 'Опубликованную анкету нельзя менять незаметно. Создайте копию для новой версии.'
          : result.validation?.errors[0] ?? 'Анкету не удалось сохранить.';
        setNotice({ tone: 'error', text });
        return;
      }
      setNotice({ tone: 'success', text: mode === 'publish' ? 'Анкета опубликована.' : 'Черновик сохранен.' });
      if (!surveyId && result.surveyId) router.replace(`/surveys/${result.surveyId}`);
    });
  }

  function duplicate() {
    if (!surveyId) return;
    startTransition(async () => {
      const result = await duplicateSurveyBuilderMutation(surveyId);
      if (!result.ok || !result.surveyId) { setNotice({ tone: 'error', text: 'Не удалось создать копию анкеты.' }); return; }
      router.replace(`/surveys/${result.surveyId}`);
    });
  }

  const currentVisibility = question?.visibility?.all?.[0] && 'question' in question.visibility.all[0]
    ? question.visibility.all[0] as SurveyCondition : undefined;

  return (
    <div className="space-y-5">
      {notice && <div role="status" className={`rounded-lg border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{notice.text}</div>}

      <section className="border-b border-app-line pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-app-text">Конструктор анкеты</h2>
            <p className="mt-1 text-sm text-app-muted">{displayValidation(validation)}. Стабильные ключи не меняются при редактировании текста.</p>
          </div>
          {canManage && <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={exportJson}><Download className="h-4 w-4" />JSON</Button>
            {surveyId && <Button type="button" size="sm" variant="secondary" onClick={duplicate} disabled={pending}>Создать копию</Button>}
            <Button type="button" size="sm" variant="secondary" onClick={() => save('save')} disabled={pending || !validation.ok}><Save className="h-4 w-4" />Сохранить</Button>
            <Button type="button" size="sm" onClick={() => save('publish')} disabled={pending || !validation.ok}><Send className="h-4 w-4" />Опубликовать</Button>
          </div>}
        </div>
        {canManage && <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto]">
          <input ref={inputRef} className="hidden" type="file" accept="application/json,.json" onChange={readFile} />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" />Загрузить JSON</Button>
          <Button type="button" variant="secondary" onClick={() => replaceDefinition(normalizeSurveyDefinition(individualMasterTemplate) ?? emptySurveyDefinition())}><FileJson2 className="h-4 w-4" />Шаблон мастера</Button>
          <Button type="button" variant="ghost" onClick={() => replaceDefinition(emptySurveyDefinition())}>Пустая анкета</Button>
        </div>}
        {canManage && <details className="mt-3 rounded-lg border border-app-line bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-bold text-app-text">Вставить JSON вручную</summary>
          <Textarea className="mt-3 min-h-36 font-mono text-xs" value={jsonText} onChange={(event) => setJsonText(event.target.value)} placeholder='{ "schemaVersion": "1.0", ... }' />
          <div className="mt-2"><Button type="button" size="sm" variant="secondary" onClick={() => importText(jsonText)}>Проверить и загрузить</Button></div>
        </details>}
      </section>

      <section className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="border border-app-line bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-app-text">Структура</p>{canManage && <Button type="button" size="sm" variant="ghost" onClick={addSection} aria-label="Добавить раздел"><Plus className="h-4 w-4" /></Button>}</div>
          <div className="space-y-2">
            {definition.sections.map((item, sectionIndex) => (
              <div key={item.key} className="border border-app-line p-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-bold text-app-text" onClick={() => setSelected({ section: sectionIndex, question: 0 })}>{item.title}</button>
                  {canManage && <button type="button" aria-label="Удалить раздел" className="p-1 text-red-600 disabled:opacity-30" disabled={definition.sections.length < 2} onClick={() => removeSection(sectionIndex)}><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
                <div className="mt-1 space-y-1 border-l border-app-line pl-2">
                  {item.questions.map((entry, questionIndex) => <button key={entry.key} type="button" className={`block w-full truncate px-1 py-1 text-left text-xs ${selected.section === sectionIndex && selected.question === questionIndex ? 'bg-purple-50 font-bold text-app-purple' : 'text-app-muted'}`} onClick={() => setSelected({ section: sectionIndex, question: questionIndex })}>{entry.title}</button>)}
                  {canManage && <button type="button" className="mt-1 flex items-center gap-1 text-xs font-bold text-app-purple" onClick={() => addQuestion(sectionIndex)}><Plus className="h-3.5 w-3.5" />Вопрос</button>}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="border border-app-line bg-white p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold text-app-text">Название анкеты</span><Input value={definition.survey.title} disabled={!canManage} onChange={(event) => updateSurvey({ title: event.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-bold text-app-text">Ключ анкеты</span><Input value={definition.survey.key} disabled={!canManage} onChange={(event) => updateSurvey({ key: keyFrom(event.target.value, 'survey') })} /></label>
            <label className="block"><span className="mb-1 block text-sm font-bold text-app-text">Сегмент</span><Input value={definition.survey.type ?? ''} disabled={!canManage} onChange={(event) => updateSurvey({ type: event.target.value })} /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold text-app-text">Описание</span><Textarea value={definition.survey.description ?? ''} disabled={!canManage} onChange={(event) => updateSurvey({ description: event.target.value })} /></label>
          </div>
          {section && <div className="mt-7 border-t border-app-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-app-text">Раздел</p><span className="text-xs text-app-muted">{section.key}</span></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><Input value={section.title} disabled={!canManage} onChange={(event) => setDefinition((current) => ({ ...current, sections: current.sections.map((item, index) => index === selected.section ? { ...item, title: event.target.value } : item) }))} /><Input value={section.key} disabled={!canManage} onChange={(event) => setDefinition((current) => ({ ...current, sections: current.sections.map((item, index) => index === selected.section ? { ...item, key: keyFrom(event.target.value, `section_${index + 1}`) } : item) }))} /></div>
          </div>}
          {question && <div className="mt-6 border-t border-app-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-app-text">Элемент</p>{canManage && <Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={section.questions.length < 2} onClick={() => removeQuestion(selected.section, selected.question)}><Trash2 className="h-4 w-4" />Удалить</Button>}</div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold text-app-text">Текст</span><Input value={question.title} disabled={!canManage} onChange={(event) => updateQuestion({ title: event.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-sm font-bold text-app-text">Стабильный ключ</span><Input value={question.key} disabled={!canManage} onChange={(event) => updateQuestion({ key: keyFrom(event.target.value, `question_${selected.question + 1}`) })} /></label>
              <label className="block"><span className="mb-1 block text-sm font-bold text-app-text">Тип</span><Select value={question.type} disabled={!canManage} onChange={(event) => updateQuestion({ type: event.target.value as SurveyElementType, ...(choiceTypes.has(event.target.value as SurveyElementType) && !(question.options?.length) ? { options: [{ key: 'option_1', label: 'Вариант 1' }, { key: 'option_2', label: 'Вариант 2' }] } : {}) })}>{surveyElementTypes.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</Select></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold text-app-text">Пояснение</span><Textarea value={question.description ?? ''} disabled={!canManage} onChange={(event) => updateQuestion({ description: event.target.value })} /></label>
              {question.type !== 'info' && question.type !== 'section_break' && <label className="flex items-center gap-2 text-sm font-bold text-app-text"><input type="checkbox" checked={Boolean(question.required)} disabled={!canManage} onChange={(event) => updateQuestion({ required: event.target.checked })} />Обязательный ответ</label>}
              {choiceTypes.has(question.type) && <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold text-app-text">Варианты, по одному в строке</span><Textarea value={(question.options ?? []).map((item) => item.label).join('\n')} disabled={!canManage || Boolean(question.optionsSource)} onChange={(event) => updateOptions(event.target.value)} /></label>}
              {['scale', 'rating'].includes(question.type) && <div className="grid grid-cols-2 gap-3 sm:col-span-2"><Input type="number" placeholder="Минимум" value={String(question.settings?.min ?? 1)} disabled={!canManage} onChange={(event) => updateQuestion({ settings: { ...question.settings, min: Number(event.target.value) } })} /><Input type="number" placeholder="Максимум" value={String(question.settings?.max ?? 5)} disabled={!canManage} onChange={(event) => updateQuestion({ settings: { ...question.settings, max: Number(event.target.value) } })} /></div>}
            </div>
          </div>}
        </div>

        <aside className="space-y-4 border border-app-line bg-white p-4">
          <div><p className="text-sm font-black text-app-text">Логика показа</p><p className="mt-1 text-xs leading-5 text-app-muted">Условие использует только ответы из вопросов выше. Для сложной вложенной логики используйте JSON-импорт.</p></div>
          {question && <>
            <Select value={currentVisibility?.question ?? ''} disabled={!canManage} onChange={(event) => {
              const source = event.target.value;
              setVisibility(source ? { question: source, operator: currentVisibility?.operator ?? 'equals', value: currentVisibility?.value ?? '' } : undefined);
            }}><option value="">Показывать всегда</option>{allQuestions.filter((item) => item.key !== question.key).map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</Select>
            {currentVisibility && <div className="mt-2 space-y-2"><Select value={currentVisibility.operator} disabled={!canManage} onChange={(event) => setVisibility({ ...currentVisibility, operator: event.target.value as SurveyCondition['operator'] })}>{conditionOperators.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>{!['is_answered', 'is_not_answered'].includes(currentVisibility.operator) && <Input value={Array.isArray(currentVisibility.value) ? currentVisibility.value.join(',') : String(currentVisibility.value ?? '')} disabled={!canManage} placeholder="Значение или список через запятую" onChange={(event) => setVisibility({ ...currentVisibility, value: ['in', 'not_in'].includes(currentVisibility.operator) ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean) : event.target.value })} />}</div>}
            {choiceTypes.has(question.type) && <div className="mt-5 border-t border-app-line pt-4"><p className="text-sm font-black text-app-text">Динамические варианты</p><Select className="mt-2" value={question.optionsSource?.question ?? ''} disabled={!canManage} onChange={(event) => updateQuestion({ optionsSource: event.target.value ? { type: 'selected_answers', question: event.target.value } : undefined })}><option value="">Обычные варианты</option>{allQuestions.filter((item) => item.key !== question.key && choiceTypes.has(item.type)).map((item) => <option key={item.key} value={item.key}>Выбранные в: {item.title}</option>)}</Select></div>}
            <div className="mt-5 border-t border-app-line pt-4"><p className="text-sm font-black text-app-text">Запись в контакт</p><Select className="mt-2" value={question.contactMapping?.field ?? ''} disabled={!canManage} onChange={(event) => updateQuestion({ contactMapping: event.target.value ? { field: event.target.value as NonNullable<SurveyQuestion['contactMapping']>['field'], mode: question.contactMapping?.mode ?? 'if_empty' } : undefined })}><option value="">Не записывать</option><option value="name">Имя</option><option value="email">Email</option><option value="phone">Телефон</option><option value="city">Город</option><option value="telegram">Telegram</option><option value="instagram">Instagram</option><option value="comment">Комментарий</option></Select>{question.contactMapping && <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-app-muted"><input type="checkbox" checked={question.contactMapping.mode === 'always'} disabled={!canManage} onChange={(event) => updateQuestion({ contactMapping: { ...question.contactMapping!, mode: event.target.checked ? 'always' : 'if_empty' } })} />Заменять существующее значение</label>}</div>
          </>}
          <div className="border-t border-app-line pt-4"><p className="text-sm font-black text-app-text">Проверка</p>{validation.errors.length ? <ul className="mt-2 space-y-1 text-xs leading-5 text-red-700">{validation.errors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}</ul> : <p className="mt-2 text-xs font-semibold text-emerald-700">Структура готова к сохранению.</p>}{validation.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{validation.warnings[0]}</p>}</div>
          <div className="border-t border-app-line pt-4"><div className="flex items-center justify-between"><p className="text-sm font-black text-app-text">Автоматизация</p>{canManage && <Button type="button" size="sm" variant="ghost" onClick={addRule}><Plus className="h-4 w-4" /></Button>}</div><div className="mt-2 space-y-3">{(definition.classificationRules ?? []).map((rule, index) => { const condition = rule.when.all?.[0] && 'question' in rule.when.all[0] ? rule.when.all[0] as SurveyCondition : undefined; const action = rule.actions[0]; return <div key={rule.key} className="border border-app-line p-2"><Input className="h-8 text-xs" value={rule.title} disabled={!canManage} onChange={(event) => updateRule(index, { title: event.target.value })} /><Select className="mt-2 h-8 text-xs" value={condition?.question ?? ''} disabled={!canManage} onChange={(event) => updateRule(index, { when: { all: [{ question: event.target.value, operator: condition?.operator ?? 'is_answered', ...(condition?.value !== undefined ? { value: condition.value } : {}) }] } })}>{allQuestions.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}</Select><Select className="mt-2 h-8 text-xs" value={action?.type ?? 'create_task'} disabled={!canManage} onChange={(event) => updateRule(index, { actions: event.target.value === 'set_contact_status' ? [{ type: 'set_contact_status', status: 'interested' }] : [{ type: 'create_task', title: 'Связаться по итогам анкеты', dueInDays: 1, priority: 'medium' }] })}><option value="create_task">Создать задачу</option><option value="set_contact_status">Изменить статус</option></Select>{action?.type === 'create_task' ? <Input className="mt-2 h-8 text-xs" value={action.title} disabled={!canManage} onChange={(event) => updateRule(index, { actions: [{ ...action, title: event.target.value }] })} /> : <Select className="mt-2 h-8 text-xs" value={action?.status ?? 'interested'} disabled={!canManage} onChange={(event) => updateRule(index, { actions: [{ type: 'set_contact_status', status: event.target.value }] })}><option value="interested">Заинтересован</option><option value="testing">Тестирует</option></Select>}</div>; })}{!(definition.classificationRules?.length) && <p className="text-xs text-app-muted">Правила можно добавить здесь или импортировать из JSON.</p>}</div></div>
        </aside>
      </section>
    </div>
  );
}
