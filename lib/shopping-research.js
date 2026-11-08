import {normalize} from './shopping.js';
export function validateResearch(data,response,unit,today) {
  if(!data||data.found!==true||data.package_unit!==unit||!Number.isFinite(data.price_eur)||data.price_eur<=0||data.price_eur>1000||!Number.isFinite(data.package_quantity)||data.package_quantity<=0||data.package_quantity>100000||typeof data.retailer!=='string'||data.retailer.length>80) return null;
  // A model-authored URL alone is never accepted as evidence.
  const citations=(response.content||[]).flatMap(b=>b.citations||[]).filter(c=>c.type==='web_search_result_location');
  const cited=citations.find(c=>c.url===data.source_url);
  if(!cited)return null;
  let source;try{source=new URL(data.source_url);}catch{return null;}
  if(source.protocol!=='https:')return null;
  // Reject marketplace, voucher and paid membership prices in research prompts.
  const deposit=data.deposit_eur==null?null:Number(data.deposit_eur);
  if(deposit!=null&&(!Number.isFinite(deposit)||deposit<0||deposit>30))return null;
  return {name:String(data.name||'').slice(0,160),retailer:data.retailer,price_eur:Math.round(data.price_eur*100)/100,package_quantity:data.package_quantity,package_unit:unit,source_url:source.href,observed_on:today,deposit_eur:deposit,source_title:String(cited.title||'Preisquelle').slice(0,200)};
}
export function validResearchRequest(body) {
  return body&&typeof body.name==='string'&&body.name.trim().length>0&&body.name.length<=160&&typeof body.retailer==='string'&&body.retailer.length>0&&body.retailer.length<=80&&['g','ml','piece'].includes(body.unit)&&(!body.product_id||/^[0-9a-f-]{36}$/i.test(body.product_id))&&normalize(body.name).length>0;
}
