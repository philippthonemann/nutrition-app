import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProduct } from '../lib/products.js';
import { applyProduct, normalizeScan } from '../src/scan.js';
import { fastingHours, mealTimestamp } from '../src/mealTime.js';
test('product records need actual macro data, not fabricated zero values', () => {
  assert.equal(normalizeProduct({code:'123',product_name:'Riegel',nutriments:{}}),null);
  const result = normalizeProduct({code:'123',product_name:'Riegel',nutriments:{'energy-kcal_100g':400,proteins_100g:20,carbohydrates_100g:30,fat_100g:22}});
  assert.equal(result.per100g.calories,400);
});
test('selected product replaces one ingredient and scales from 100 g to the eaten quantity', () => {
  const result = normalizeScan({ name:'Snack',components:[{name:'Riegel',grams:50,calories:100,protein:1,carbs:10,fat:5},{name:'Banane',grams:100,calories:90,protein:1,carbs:20,fat:0}] });
  const next = applyProduct(result,0,{name:'Pistazienriegel',brand:'Beispiel',url:'https://example.com',per100g:{calories:400,protein:20,carbs:30,fat:22}},50);
  assert.equal(next.calories,290);
  assert.equal(next.protein,11);
  assert.equal(next.components.length,2);
  assert.equal(next.sources.length,1);
});
test('timestamps retain an explicit offset and future meal times never become negative fasting', () => {
  assert.equal(mealTimestamp('2026-11-07T21:50:00+01:00'),'2026-11-07T20:50:00.000Z');
  assert.equal(fastingHours('2026-11-07T21:50:00Z',new Date('2026-11-07T21:11:00Z')),null);
  assert.equal(fastingHours('2026-11-07T20:50:00Z',new Date('2026-11-07T21:50:00Z')),1);
});
