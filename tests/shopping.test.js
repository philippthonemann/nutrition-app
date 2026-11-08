import test from 'node:test';
import assert from 'node:assert/strict';
import {makeItem,applyAction,priceFor,totals,identity,baseQuantity} from '../lib/shopping.js';
import {validateResearch} from '../lib/shopping-research.js';
import handler from '../api/shopping-prices.js';
const ingredient={id:'ingredient',name:'Joghurt',canonical_key:'joghurt'};
const product={id:'p',ingredient_id:'ingredient',package_quantity:500,package_unit:'g'};
const price={product_id:'p',retailer:'REWE',package_quantity:500,package_unit:'g',price_eur:1.49,original_currency:'EUR',observed_on:'2026-11-08',channel:'store',price_type:'regular',status:'verified'};
const catalog={ingredients:[ingredient],products:[product],prices:[price],research:[]};
const now=new Date('2026-11-08T12:00:00Z');
test('whole packs round up and checked goods stay in total',()=>{
 const item=makeItem({name:'Joghurt',quantity:750,unit:'g',ingredient});
 assert.equal(priceFor(item,'REWE',catalog,now).total,2.98);
 assert.equal(priceFor(item,'REWE',catalog,now).packs,2);
 const total=totals([{...item,checked:true}], 'REWE',catalog);
 assert.equal(total.total,2.98);assert.equal(total.remaining,0);
});
test('unit conversion merges only compatible units, keeping concrete products separate',()=>{
 assert.deepEqual(baseQuantity(1.5,'kg'),{quantity:1500,unit:'g'});
 const a=makeItem({name:'Joghurt',quantity:0.5,unit:'kg',ingredient});
 const b=makeItem({name:'Joghurt',quantity:250,unit:'g',ingredient});
 const c=makeItem({name:'Joghurt',quantity:100,unit:'ml',ingredient});
 const d=applyAction({items:[a]}, {type:'add',items:[b,c]});
 assert.equal(d.items.length,2);assert.equal(d.items[0].quantity,750);
 const e=applyAction(d,{type:'item',id:b.id,patch:{checked:true}});
 assert.equal(e.items[0].checked,true,'merged incoming identity survives server reconciliation');
});
test('reviewed starch and ginger duplicates share shopping identity; garlic pieces remain distinct',()=>{
 assert.equal(identity({canonical_key:'speisestaerke'}),identity({canonical_key:'speisestaerke',preparation_state:'powder'}));
 assert.equal(identity({canonical_key:'ingwer'}),identity({canonical_key:'ingwer-frisch'}));
 assert.notEqual(makeItem({name:'Knoblauch',ingredient:{name:'Knoblauch',canonical_key:'knoblauch'}}).merge_key,makeItem({name:'Knoblauchzehen',ingredient:{name:'Knoblauchzehen',canonical_key:'knoblauchzehen'}}).merge_key);
});
test('missing prices always return an explicit positive estimate, not zero',()=>{
 const p=priceFor(makeItem({name:'Spülmittel'}),'Lidl',{});assert.equal(p.kind,'guide');assert.ok(p.total>0);
});
test('foreign converted, membership, expired and pack-count-only prices are not treated as known',()=>{
 for(const patch of [{original_currency:'USD'},{price_type:'member'},{valid_until:'2000-01-01'},{package_unit:'piece'}]){
  const p=priceFor(makeItem({name:'Joghurt',quantity:500,unit:'g',ingredient}),'REWE',{...catalog,prices:[{...price,...patch}]},now);
  assert.equal(p.kind,'guide');
 }
});
test('known selected retailer beats online comparison and fallback',()=>{
 const item=makeItem({name:'Joghurt',quantity:500,unit:'g',ingredient});
 assert.equal(priceFor(item,'REWE',{...catalog,prices:[{...price,channel:'online',retailer:'Combi',source_url:'https://example.com',price_eur:1},price]},now).kind,'known');
 assert.equal(priceFor(item,'Lidl',{...catalog,prices:[{...price,channel:'online',source_url:'https://example.com'}]},now).kind,'online');
});
test('research must have real provider citations, valid unit and package, and known deposit',()=>{
 const data={found:true,package_unit:'g',price_eur:2,package_quantity:500,retailer:'REWE',source_url:'https://example.com/p',deposit_eur:null};
 assert.equal(validateResearch(data,{content:[]},'g','2026-11-08'),null);
 const evidence={content:[{citations:[{type:'web_search_result_location',url:data.source_url,title:'Product'}]}]};
 assert.equal(validateResearch(data,evidence,'ml','2026-11-08'),null);
 assert.equal(validateResearch(data,evidence,'g','2026-11-08').deposit_eur,null);
});
test('price research rejects unauthenticated access before provider calls',async()=>{
 const response={setHeader(){},status(code){this.code=code;return this;},json(value){this.value=value;return this;},end(){}};
 await handler({method:'POST',headers:{},body:{name:'Milk'}},response);assert.equal(response.code,401);
});
