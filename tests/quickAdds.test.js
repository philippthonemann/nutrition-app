import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quickRecipes, readPinned } from '../src/quickAdds.js';
const recipes = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Rezept ${i}` }));
test('pins precede recent history, duplicates and missing recipes are excluded, at most five', () => {
  const result = quickRecipes(recipes, [{ name: ' REZEPT 1 ' }, { name: 'Rezept 1' }, { name: 'Gelöscht' }, ...recipes.map(r => ({ name: r.name }))], ['7','missing']);
  assert.deepEqual(result.map(r => r.id), ['7','1','0','2','3']);
});
test('malformed saved pins do not break recipe loading', () => {
  const old = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '{broken' };
  assert.deepEqual(readPinned('test'), []);
  globalThis.localStorage = old;
});
