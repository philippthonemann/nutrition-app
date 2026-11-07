import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackingStatus, summarizeDays, completeAverages, goalOnDate } from '../src/tracking.js';
test('two-thirds cutoff distinguishes no log from incomplete and complete', () => {
  assert.equal(trackingStatus(0,false,null,2600),'empty');
  assert.equal(trackingStatus(1733,true,null,2600),'incomplete');
  assert.equal(trackingStatus(1734,true,null,2600),'complete');
  assert.equal(trackingStatus(3400,true,null,2600),'complete');
});
test('manual overrides take precedence over the calorie heuristic', () => {
  assert.equal(trackingStatus(3000,true,{completion:'incomplete'},2600),'incomplete');
  assert.equal(trackingStatus(1200,true,{completion:'complete'},2600),'complete');
});
test('averages exclude partial days and use the same denominator for zero-protein days', () => {
  const days = summarizeDays([{date:'2026-11-01',calories:2000,protein:0},{date:'2026-11-02',calories:2200,protein:100},{date:'2026-11-03',calories:300,protein:20}],[],[],2600);
  assert.deepEqual(completeAverages(days),{count:2,calories:2100,protein:50,carbs:0,fat:0});
  assert.equal(completeAverages({}).calories,null);
});
test('historical goal changes and stored daily targets are honored', () => {
  const history = [{created_at:'2026-01-01',day:'2026-01-01',calories:2400},{created_at:'2026-11-01',day:'2026-11-01',calories:3000}];
  assert.equal(goalOnDate('2026-10-01',history,2600),2400);
  const days = summarizeDays([{date:'2026-10-01',calories:1700}],[],history,2600);
  assert.equal(days['2026-10-01'].status,'complete');
  assert.equal(trackingStatus(1700,true,{calorie_goal:3000},2400),'incomplete');
});
