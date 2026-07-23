import assert from 'node:assert/strict';
import test from 'node:test';
import individualMasterTemplate from '../data/surveys/individual-master-survey-v1.json' with { type: 'json' };
import detailedIndividualMasterTemplate from '../data/surveys/individual-master-research-2026.json' with { type: 'json' };
import {
  classificationActions,
  evaluateCondition,
  inactiveAnswers,
  normalizeSurveyDefinition,
  questionOptions,
  validateSurveyDefinition,
  visibleSurveySections
} from '../lib/survey-builder.ts';

const definition = normalizeSurveyDefinition(individualMasterTemplate);
assert.ok(definition, 'The bundled master questionnaire must parse');

test('individual master template validates and can round-trip through JSON', () => {
  const validation = validateSurveyDefinition(definition);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.ok(validation.summary.questions > 40);
  const exported = JSON.parse(JSON.stringify(definition));
  assert.deepEqual(normalizeSurveyDefinition(exported), definition);
});

test('detailed individual master research survey validates before it is loaded into Supabase', () => {
  const validation = validateSurveyDefinition(detailedIndividualMasterTemplate);
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(validation.summary.questions, 71);
  assert.ok(validation.summary.branches > 100);
});

test('branching hides the booking-service branch that does not match the answer', () => {
  const sections = visibleSurveySections(definition!, { current_booking_service: 'never' });
  const questions = sections.flatMap((section) => section.questions.map((question) => question.key));
  assert.ok(questions.includes('service_refusal_reasons'));
  assert.ok(!questions.includes('service_satisfaction'));
});

test('nested conditions and comparisons evaluate without eval', () => {
  assert.equal(evaluateCondition({ all: [{ question: 'score', operator: 'greater_or_equal', value: 4 }, { any: [{ question: 'choice', operator: 'equals', value: 'yes' }, { question: 'choice', operator: 'equals', value: 'maybe' }] }] }, { score: '4', choice: 'yes' }), true);
  assert.equal(evaluateCondition({ all: [{ question: 'score', operator: 'greater_than', value: 4 }] }, { score: '4' }), false);
});

test('dynamic options use selected answers from a preceding question', () => {
  const topProblems = definition!.sections.flatMap((section) => section.questions).find((question) => question.key === 'top_problems')!;
  const options = questionOptions(topProblems, { work_problems: ['clients', 'time'] });
  assert.deepEqual(options.map((option) => option.value), ['clients', 'time']);
});

test('inactive branch answers remain available but are excluded from final active answers', () => {
  const answers = { current_booking_service: 'never', service_satisfaction: '5' };
  assert.deepEqual(inactiveAnswers(definition!, answers), { service_satisfaction: '5' });
});

test('classification rules are selected only for matching answers', () => {
  const actions = classificationActions(definition!, { demo_interest: 'yes' });
  assert.ok(actions.some((item) => item.rule.key === 'interested'));
  assert.ok(actions.some((item) => item.action.type === 'create_task'));
});
