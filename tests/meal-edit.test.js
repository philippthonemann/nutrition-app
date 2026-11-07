import { afterEach,test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/meal-edit.js';
import {mealEditPreview,portionFactor,nutrients} from '../lib/meal-edit.js';

const meal={id:'11111111-1111-4111-8111-111111111111',user_id:'owner',name:'Frühstück',calories:600,protein:40,carbs:60,fat:22,fiber:10,caffeine:80,water:200,estimated:false,edit_version:3};
test('portion changes scale every tracked nutrient without touching identity or date',()=>{
  const preview=mealEditPreview(meal,{type:'scale',factor:.5});
  assert.equal(preview.calories,300);assert.equal(preview.protein,20);assert.equal(preview.caffeine,40);assert.equal(preview.water,100);
  assert.equal(preview.estimated,false);assert.equal(preview.id,undefined);assert.equal(preview.date,undefined);assert.equal(meal.calories,600);
  assert.equal(portionFactor('nur halbe Portion'),.5);assert.equal(portionFactor('halbe Portion und 30 g Öl'),null);
});
test('added ingredients preserve the original nutrients and reject unsafe operations',()=>{
  const values=Object.fromEntries(nutrients.map(key=>[key,0]));Object.assign(values,{calories:90,fat:10});
  const preview=mealEditPreview(meal,{type:'add',addition_name:'10 g Öl',values,note:'10 g zusätzliches Öl.'});
  assert.equal(preview.calories,690);assert.equal(preview.protein,40);assert.equal(preview.fat,32);assert.equal(preview.caffeine,80);assert.equal(preview.estimated,true);
  assert.throws(()=>mealEditPreview(meal,{type:'add',values:{calories:-90},note:'Entfernen'}));
  assert.throws(()=>mealEditPreview(meal,{type:'scale',factor:100}));
  assert.throws(()=>mealEditPreview(meal,{type:'replace',values}));
});
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){}});
test('editing requires authentication before any provider or database request',async()=>{
  globalThis.fetch=()=>{throw new Error('must not run');};const res=response();await handler({method:'POST',headers:{},body:{}},res);assert.equal(res.code,401);
});
test('half portion preview reads only the owner meal, needs no AI and never writes',async()=>{
  let calls=0;globalThis.fetch=async(url,options)=>{
    calls++;assert.ok(url.startsWith('https://iunittdjpnmkhvlaizpo.supabase.co/'));assert.notEqual(options.method,'PATCH');
    if(calls===1)return{ok:true,json:async()=>({id:'owner',email_confirmed_at:'2026-01-01'})};
    if(calls===2)return{ok:true,json:async()=>[{user_id:'owner'}]};
    assert.ok(url.includes('user_id=eq.owner'));assert.ok(url.includes(meal.id));return{ok:true,json:async()=>[meal]};
  };
  const res=response();await handler({method:'POST',headers:{authorization:'Bearer test'},body:{meal_id:meal.id,instruction:'nur halbe Portion'}},res);
  assert.equal(res.code,200);assert.equal(res.body.preview.calories,300);assert.equal(res.body.version,3);assert.equal(calls,3);
});
