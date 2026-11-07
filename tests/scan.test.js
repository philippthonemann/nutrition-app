import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScan, resizeComponent } from '../src/scan.js';

const meal = { name: 'Reis mit Hähnchen', calories: 9999, protein: 999, carbs: 999, fat: 999, components: [
  { name: 'Reis, gekocht', grams: 200, calories: 260, protein: 5, carbs: 56, fat: 1 },
  { name: 'Hähnchen, gegart', grams: 100, calories: 165, protein: 31, carbs: 0, fat: 4 },
] };
test('totals are calculated from ingredients rather than inconsistent model totals', () => {
  const result = normalizeScan(meal);
  assert.equal(result.calories, 425);
  assert.equal(result.protein, 36);
});
test('portion corrections scale only the selected ingredient and clear old uncertainty range', () => {
  const corrected = resizeComponent(normalizeScan(meal), 0, 100);
  assert.equal(corrected.calories, 295);
  assert.equal(corrected.components[1].grams, 100);
  assert.equal(corrected.calorie_range, null);
});
test('invalid scans cannot become zero-calorie logged meals', () => {
  for (const value of [null, { error: 'Kein Essen erkannt' }, { ...meal, components: [{ ...meal.components[0], calories: -10 }] }, { ...meal, components: [{ ...meal.components[0], protein: 'viel' }] }]) {
    assert.throws(() => normalizeScan(value));
  }
});
test('follow-up questions are optional, bounded to two, and assigned distinct identifiers', () => {
  const result = normalizeScan({ ...meal, questions: [{ id: 'oil', question: 'War Öl dabei?' }, { id: 'oil', question: 'War es frittiert?' }, { question: 'Dritte Frage?' }] });
  assert.equal(result.questions.length, 2);
  assert.notEqual(result.questions[0].id, result.questions[1].id);
  assert.deepEqual(normalizeScan(meal).questions, []);
});
