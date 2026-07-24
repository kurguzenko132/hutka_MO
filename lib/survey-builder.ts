export const SURVEY_SCHEMA_VERSION = '1.0';
export const MAX_SURVEY_QUESTIONS = 500;

export const surveyElementTypes = [
  'info',
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'scale',
  'number',
  'email',
  'phone',
  'city',
  'section_break',
  // Kept for questionnaires created before the builder was introduced.
  'yes_no',
  'rating'
] as const;

export type SurveyElementType = (typeof surveyElementTypes)[number];
export type SurveyAnswers = Record<string, unknown>;

export type SurveyOption = {
  key: string;
  label: string;
  value?: string;
};

export type SurveyCondition = {
  question: string;
  operator: SurveyConditionOperator;
  value?: unknown;
};

export type SurveyConditionGroup = {
  all?: SurveyConditionNode[];
  any?: SurveyConditionNode[];
};

export type SurveyConditionNode = SurveyCondition | SurveyConditionGroup;
export type SurveyConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal'
  | 'is_answered'
  | 'is_not_answered';

export type SurveyOptionsSource = {
  type: 'selected_answers';
  question: string;
};

export type SurveyQuestion = {
  key: string;
  type: SurveyElementType;
  title: string;
  description?: string;
  required?: boolean;
  options?: SurveyOption[];
  optionsSource?: SurveyOptionsSource;
  visibility?: SurveyConditionGroup;
  validation?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  contactMapping?: {
    field: 'name' | 'email' | 'phone' | 'city' | 'telegram' | 'instagram' | 'comment';
    mode?: 'if_empty' | 'always';
  };
};

export type SurveySection = {
  key: string;
  title: string;
  description?: string;
  visibility?: SurveyConditionGroup;
  questions: SurveyQuestion[];
};

export type SurveyClassificationAction =
  | { type: 'set_contact_status'; status: string }
  | { type: 'create_task'; title: string; dueInDays?: number; priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent' };

export type SurveyClassificationRule = {
  key: string;
  title: string;
  priority: number;
  when: SurveyConditionGroup;
  actions: SurveyClassificationAction[];
};

export type SurveyDefinition = {
  schemaVersion: typeof SURVEY_SCHEMA_VERSION;
  survey: {
    key: string;
    title: string;
    type?: string;
    description?: string;
    settings?: Record<string, unknown>;
    startScreen?: { title?: string; description?: string };
    completionScreen?: { title?: string; description?: string; redirectUrl?: string };
  };
  sections: SurveySection[];
  classificationRules?: SurveyClassificationRule[];
};

export type SurveyValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: { sections: number; questions: number; branches: number; classificationRules: number };
  definition?: SurveyDefinition;
};

const validKey = /^[a-z][a-z0-9_]{1,99}$/;
const operators = new Set<SurveyConditionOperator>([
  'equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in',
  'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'is_answered', 'is_not_answered'
]);
const choiceTypes = new Set<SurveyElementType>(['single_choice', 'multiple_choice', 'yes_no']);
const contactFields = new Set(['name', 'email', 'phone', 'city', 'telegram', 'instagram', 'comment']);
const taskPriorities = new Set(['none', 'low', 'medium', 'high', 'urgent']);

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function copyObject(value: unknown): Record<string, unknown> | undefined {
  const item = object(value);
  return item ? structuredClone(item) : undefined;
}

function normalizeOption(value: unknown, index: number): SurveyOption | null {
  if (typeof value === 'string') {
    const label = value.trim();
    return label ? { key: `option_${index + 1}`, label, value: label } : null;
  }
  const item = object(value);
  if (!item) return null;
  const key = text(item.key);
  const label = text(item.label);
  const optionValue = text(item.value);
  return key && label ? { key, label, ...(optionValue ? { value: optionValue } : {}) } : null;
}

function normalizeCondition(value: unknown): SurveyConditionNode | null {
  const item = object(value);
  if (!item) return null;
  if (Array.isArray(item.all) || Array.isArray(item.any)) {
    const all = Array.isArray(item.all) ? item.all.map(normalizeCondition).filter((node): node is SurveyConditionNode => Boolean(node)) : undefined;
    const any = Array.isArray(item.any) ? item.any.map(normalizeCondition).filter((node): node is SurveyConditionNode => Boolean(node)) : undefined;
    return { ...(all ? { all } : {}), ...(any ? { any } : {}) };
  }
  const question = text(item.question);
  const operator = text(item.operator) as SurveyConditionOperator;
  return question && operators.has(operator) ? { question, operator, ...('value' in item ? { value: structuredClone(item.value) } : {}) } : null;
}

function normalizeQuestion(value: unknown): SurveyQuestion | null {
  const item = object(value);
  if (!item) return null;
  const key = text(item.key);
  const type = text(item.type) as SurveyElementType;
  const title = text(item.title) || (type === 'section_break' ? 'Новый раздел' : '');
  if (!key || !surveyElementTypes.includes(type) || !title) return null;
  const source = object(item.optionsSource);
  const sourceQuestion = source && source.type === 'selected_answers' ? text(source.question) : '';
  const mapping = object(item.contactMapping);
  const visibility = normalizeCondition(item.visibility);
  const options = Array.isArray(item.options)
    ? item.options.map(normalizeOption).filter((option): option is SurveyOption => Boolean(option))
    : undefined;
  return {
    key,
    type,
    title,
    ...(text(item.description) ? { description: text(item.description) } : {}),
    ...(item.required === true ? { required: true } : {}),
    ...(options?.length ? { options } : {}),
    ...(sourceQuestion ? { optionsSource: { type: 'selected_answers', question: sourceQuestion } } : {}),
    ...(visibility && object(item.visibility) ? { visibility: visibility as SurveyConditionGroup } : {}),
    ...(copyObject(item.validation) ? { validation: copyObject(item.validation) } : {}),
    ...(copyObject(item.settings) ? { settings: copyObject(item.settings) } : {}),
    ...(mapping && contactFields.has(text(mapping.field)) ? {
      contactMapping: {
        field: text(mapping.field) as NonNullable<SurveyQuestion['contactMapping']>['field'],
        ...(text(mapping.mode) === 'always' ? { mode: 'always' } : {})
      }
    } : {})
  };
}

function normalizeRule(value: unknown, index: number): SurveyClassificationRule | null {
  const item = object(value);
  if (!item) return null;
  const key = text(item.key);
  const title = text(item.title);
  const when = normalizeCondition(item.when);
  const actions: SurveyClassificationAction[] = Array.isArray(item.actions) ? item.actions.flatMap<SurveyClassificationAction>((raw) => {
    const action = object(raw);
    if (!action) return [];
    if (action.type === 'set_contact_status' && text(action.status)) return [{ type: 'set_contact_status' as const, status: text(action.status) }];
    if (action.type === 'create_task' && text(action.title)) {
      const priority = text(action.priority);
      return [{ type: 'create_task' as const, title: text(action.title), ...(Number.isFinite(Number(action.dueInDays)) ? { dueInDays: Math.max(0, Math.floor(Number(action.dueInDays))) } : {}), ...(taskPriorities.has(priority) ? { priority: priority as 'none' | 'low' | 'medium' | 'high' | 'urgent' } : {}) }];
    }
    return [];
  }) : [];
  return key && title && when && actions.length ? { key, title, priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : index + 1, when: when as SurveyConditionGroup, actions } : null;
}

export function normalizeSurveyDefinition(value: unknown): SurveyDefinition | null {
  const source = object(value);
  const survey = source && object(source.survey);
  if (!source || !survey || text(source.schemaVersion) !== SURVEY_SCHEMA_VERSION) return null;
  const sections = Array.isArray(source.sections) ? source.sections.map((raw) => {
    const item = object(raw);
    if (!item) return null;
    const visibility = normalizeCondition(item.visibility);
    const questions = Array.isArray(item.questions) ? item.questions.map(normalizeQuestion).filter((question): question is SurveyQuestion => Boolean(question)) : [];
    const key = text(item.key);
    const title = text(item.title);
    return key && title ? { key, title, ...(text(item.description) ? { description: text(item.description) } : {}), ...(visibility && object(item.visibility) ? { visibility: visibility as SurveyConditionGroup } : {}), questions } : null;
  }).filter((section): section is SurveySection => Boolean(section)) : [];
  const rules = Array.isArray(source.classificationRules) ? source.classificationRules.map(normalizeRule).filter((rule): rule is SurveyClassificationRule => Boolean(rule)) : [];
  const normalized: SurveyDefinition = {
    schemaVersion: SURVEY_SCHEMA_VERSION,
    survey: {
      key: text(survey.key),
      title: text(survey.title),
      ...(text(survey.type) ? { type: text(survey.type) } : {}),
      ...(text(survey.description) ? { description: text(survey.description) } : {}),
      ...(copyObject(survey.settings) ? { settings: copyObject(survey.settings) } : {}),
      ...(object(survey.startScreen) ? { startScreen: { ...(text(object(survey.startScreen)?.title) ? { title: text(object(survey.startScreen)?.title) } : {}), ...(text(object(survey.startScreen)?.description) ? { description: text(object(survey.startScreen)?.description) } : {}) } } : {}),
      ...(object(survey.completionScreen) ? { completionScreen: { ...(text(object(survey.completionScreen)?.title) ? { title: text(object(survey.completionScreen)?.title) } : {}), ...(text(object(survey.completionScreen)?.description) ? { description: text(object(survey.completionScreen)?.description) } : {}) } } : {})
    },
    sections,
    ...(rules.length ? { classificationRules: rules } : {})
  };
  return normalized;
}

function collectConditionQuestions(condition: SurveyConditionNode | undefined, result: string[] = []): string[] {
  if (!condition) return result;
  if ('question' in condition) result.push(condition.question);
  else {
    condition.all?.forEach((item) => collectConditionQuestions(item, result));
    condition.any?.forEach((item) => collectConditionQuestions(item, result));
  }
  return result;
}

function conditionCount(condition: SurveyConditionNode | undefined): number {
  return collectConditionQuestions(condition).length;
}

export type SurveyReferenceCleanup = {
  definition: SurveyDefinition;
  clearedVisibility: number;
  clearedOptionSources: number;
  removedRules: number;
};

export function removeSurveyQuestions(
  definition: SurveyDefinition,
  questionKeys: Iterable<string>
): SurveyReferenceCleanup {
  const removed = new Set(questionKeys);
  if (removed.size === 0) return { definition, clearedVisibility: 0, clearedOptionSources: 0, removedRules: 0 };

  let clearedVisibility = 0;
  let clearedOptionSources = 0;
  const usesRemovedQuestion = (condition: SurveyConditionNode | undefined) => collectConditionQuestions(condition).some((key) => removed.has(key));
  const clearVisibility = <T extends { visibility?: SurveyConditionGroup }>(item: T) => {
    if (!usesRemovedQuestion(item.visibility)) return item;
    clearedVisibility += 1;
    const { visibility: _visibility, ...rest } = item;
    return rest as T;
  };

  const sections = definition.sections
    .map((section) => {
      const visibleSection = clearVisibility(section);
      return {
        ...visibleSection,
        questions: section.questions
          .filter((question) => !removed.has(question.key))
          .map((question) => {
            const visibleQuestion = clearVisibility(question);
            if (!visibleQuestion.optionsSource || !removed.has(visibleQuestion.optionsSource.question)) return visibleQuestion;
            clearedOptionSources += 1;
            const { optionsSource: _optionsSource, ...rest } = visibleQuestion;
            return rest as SurveyQuestion;
          })
      };
    })
    .filter((section) => section.questions.length > 0);

  const rules = (definition.classificationRules ?? []).filter((rule) => !usesRemovedQuestion(rule.when));
  return {
    definition: { ...definition, sections, classificationRules: rules },
    clearedVisibility,
    clearedOptionSources,
    removedRules: (definition.classificationRules?.length ?? 0) - rules.length
  };
}

export function validateSurveyDefinition(input: unknown): SurveyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = object(input);
  if (!raw) return { ok: false, errors: ['Нужен JSON-объект анкеты.'], warnings, summary: { sections: 0, questions: 0, branches: 0, classificationRules: 0 } };
  if (text(raw.schemaVersion) !== SURVEY_SCHEMA_VERSION) errors.push(`Поддерживается только schemaVersion ${SURVEY_SCHEMA_VERSION}.`);
  const definition = normalizeSurveyDefinition(input);
  if (!definition) errors.push('Проверьте обязательные поля анкеты, разделов и вопросов.');
  if (!definition) return { ok: false, errors, warnings, summary: { sections: 0, questions: 0, branches: 0, classificationRules: 0 } };

  if (!validKey.test(definition.survey.key)) errors.push('Ключ анкеты: только латинские строчные буквы, цифры и _.');
  if (!definition.survey.title) errors.push('Укажите название анкеты.');
  if (!definition.sections.length) errors.push('Добавьте хотя бы один раздел.');

  const sectionKeys = new Set<string>();
  const questionKeys = new Set<string>();
  const orderedQuestions: SurveyQuestion[] = [];
  let branches = 0;
  definition.sections.forEach((section, sectionIndex) => {
    if (!validKey.test(section.key)) errors.push(`Некорректный ключ раздела ${sectionIndex + 1}.`);
    if (sectionKeys.has(section.key)) errors.push(`Ключ раздела «${section.key}» повторяется.`);
    sectionKeys.add(section.key);
    branches += conditionCount(section.visibility);
    if (!section.questions.length) warnings.push(`Раздел «${section.title}» пока пуст.`);
    section.questions.forEach((question) => {
      if (!validKey.test(question.key)) errors.push(`Некорректный ключ вопроса «${question.title}».`);
      if (questionKeys.has(question.key)) errors.push(`Ключ вопроса «${question.key}» повторяется.`);
      questionKeys.add(question.key);
      orderedQuestions.push(question);
      branches += conditionCount(question.visibility);
      const optionKeys = new Set<string>();
      (question.options ?? []).forEach((option) => {
        if (!validKey.test(option.key)) errors.push(`Некорректный ключ варианта «${option.label}» в «${question.key}».`);
        if (optionKeys.has(option.key)) errors.push(`Ключ варианта «${option.key}» в «${question.key}» повторяется.`);
        optionKeys.add(option.key);
      });
      if (choiceTypes.has(question.type) && !question.optionsSource && !(question.options?.length)) errors.push(`Для «${question.title}» нужны варианты ответа.`);
    });
  });
  if (orderedQuestions.length > MAX_SURVEY_QUESTIONS) errors.push(`В одной анкете допускается до ${MAX_SURVEY_QUESTIONS} элементов.`);

  const previous = new Set<string>();
  definition.sections.forEach((section) => {
    const refs = collectConditionQuestions(section.visibility);
    refs.forEach((key) => {
      if (!questionKeys.has(key)) errors.push(`Условие раздела «${section.title}» ссылается на отсутствующий вопрос «${key}».`);
      else if (!previous.has(key)) errors.push(`Условие раздела «${section.title}» должно ссылаться на вопрос выше по анкете: «${key}».`);
    });
    section.questions.forEach((question) => {
      collectConditionQuestions(question.visibility).forEach((key) => {
        if (!questionKeys.has(key)) errors.push(`Условие «${question.key}» ссылается на отсутствующий вопрос «${key}».`);
        else if (!previous.has(key)) errors.push(`Условие «${question.key}» должно ссылаться на предыдущий вопрос «${key}».`);
      });
      if (question.optionsSource) {
        if (!previous.has(question.optionsSource.question)) errors.push(`Динамические варианты «${question.key}» должны брать ответ из предыдущего вопроса.`);
        const source = orderedQuestions.find((item) => item.key === question.optionsSource?.question);
        if (source && !choiceTypes.has(source.type)) errors.push(`Источник вариантов «${question.optionsSource.question}» должен быть вопросом с выбором.`);
      }
      previous.add(question.key);
    });
  });

  const ruleKeys = new Set<string>();
  (definition.classificationRules ?? []).forEach((rule) => {
    if (!validKey.test(rule.key)) errors.push(`Некорректный ключ правила «${rule.title}».`);
    if (ruleKeys.has(rule.key)) errors.push(`Ключ правила «${rule.key}» повторяется.`);
    ruleKeys.add(rule.key);
    collectConditionQuestions(rule.when).forEach((key) => {
      if (!questionKeys.has(key)) errors.push(`Правило «${rule.title}» ссылается на отсутствующий вопрос «${key}».`);
    });
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      sections: definition.sections.length,
      questions: orderedQuestions.length,
      branches,
      classificationRules: definition.classificationRules?.length ?? 0
    },
    definition
  };
}

function values(answer: unknown): unknown[] {
  return Array.isArray(answer) ? answer : answer === null || answer === undefined || answer === '' ? [] : [answer];
}

function equals(left: unknown, right: unknown) {
  return String(left) === String(right);
}

export function evaluateCondition(condition: SurveyConditionNode | undefined, answers: SurveyAnswers): boolean {
  if (!condition) return true;
  if (!('question' in condition)) {
    const all = condition.all?.every((item) => evaluateCondition(item, answers)) ?? true;
    const any = condition.any?.length ? condition.any.some((item) => evaluateCondition(item, answers)) : true;
    return all && any;
  }
  const answer = answers[condition.question];
  const answerValues = values(answer);
  const targetValues = values(condition.value);
  const numeric = Number(answer);
  const targetNumeric = Number(condition.value);
  switch (condition.operator) {
    case 'is_answered': return answerValues.length > 0;
    case 'is_not_answered': return answerValues.length === 0;
    case 'equals': return answerValues.some((item) => equals(item, condition.value));
    case 'not_equals': return answerValues.every((item) => !equals(item, condition.value));
    case 'contains': return answerValues.some((item) => targetValues.some((target) => String(item).includes(String(target)) || equals(item, target)));
    case 'not_contains': return answerValues.every((item) => targetValues.every((target) => !String(item).includes(String(target)) && !equals(item, target)));
    case 'in': return answerValues.some((item) => targetValues.some((target) => equals(item, target)));
    case 'not_in': return answerValues.every((item) => targetValues.every((target) => !equals(item, target)));
    case 'greater_than': return Number.isFinite(numeric) && numeric > targetNumeric;
    case 'greater_or_equal': return Number.isFinite(numeric) && numeric >= targetNumeric;
    case 'less_than': return Number.isFinite(numeric) && numeric < targetNumeric;
    case 'less_or_equal': return Number.isFinite(numeric) && numeric <= targetNumeric;
    default: return false;
  }
}

export function questionOptions(question: SurveyQuestion, answers: SurveyAnswers): SurveyOption[] {
  if (!question.optionsSource) return question.options ?? [];
  const selected = values(answers[question.optionsSource.question]).map(String);
  return selected.map((value, index) => ({ key: `${question.optionsSource?.question}_${index + 1}`, label: value, value }));
}

export function surveyOptionLabel(definition: SurveyDefinition, questionKey: string, value: unknown): string {
  const questions = definition.sections.flatMap((section) => section.questions);
  const visited = new Set<string>();
  const findLabel = (key: string): string => {
    if (visited.has(key)) return String(value);
    visited.add(key);
    const question = questions.find((item) => item.key === key);
    if (!question) return String(value);
    const stored = String(value);
    const option = question.options?.find((item) => (item.value ?? item.key) === stored || item.key === stored);
    if (option) return option.label;
    return question.optionsSource ? findLabel(question.optionsSource.question) : stored;
  };

  return findLabel(questionKey);
}

export function visibleSurveySections(definition: SurveyDefinition, answers: SurveyAnswers) {
  return definition.sections
    .filter((section) => evaluateCondition(section.visibility, answers))
    .map((section) => ({
      ...section,
      questions: section.questions.filter((question) => evaluateCondition(question.visibility, answers))
    }))
    .filter((section) => section.questions.length > 0);
}

export function activeQuestionKeys(definition: SurveyDefinition, answers: SurveyAnswers) {
  return new Set(visibleSurveySections(definition, answers).flatMap((section) => section.questions.map((question) => question.key)));
}

export function inactiveAnswers(definition: SurveyDefinition, answers: SurveyAnswers) {
  const active = activeQuestionKeys(definition, answers);
  return Object.fromEntries(Object.entries(answers).filter(([key]) => !active.has(key)));
}

export function classificationActions(definition: SurveyDefinition, answers: SurveyAnswers) {
  return (definition.classificationRules ?? [])
    .filter((rule) => evaluateCondition(rule.when, answers))
    .sort((a, b) => a.priority - b.priority)
    .flatMap((rule) => rule.actions.map((action) => ({ rule, action })));
}

export function emptySurveyDefinition(): SurveyDefinition {
  return {
    schemaVersion: SURVEY_SCHEMA_VERSION,
    survey: { key: 'new_survey', title: 'Новая анкета', type: 'Общий' },
    sections: [{ key: 'main', title: 'Основное', questions: [{ key: 'question_1', type: 'short_text', title: 'Новый вопрос' }] }]
  };
}
