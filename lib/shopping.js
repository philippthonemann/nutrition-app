export const CATEGORIES = ['Obst & Gemüse','Kühlregal','Fleisch & Fisch','Brot & Backwaren','Vorrat','Gewürze & Saucen','Tiefkühl','Getränke','Haushalt','Sonstiges'];
export const money = n => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n);
export const normalize = value => String(value || '').toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
// Reviewed equivalences for shopping only. Original records and product sizes stay intact.
export function identity(ingredient) {
  const key = normalize(ingredient?.canonical_key || ingredient?.name);
  if (['ingwer','ingwer frisch'].includes(key)) return 'ingwer';
  if (['knoblauch','knoblauchzehen'].includes(key)) return 'knoblauch';
  return key;
}
export function categoryFor(name, category) {
  if (CATEGORIES.includes(category)) return category;
  const n = normalize(name);
  if (/\btk\b|tiefkuhl|edamame|frozen/.test(n)) return 'Tiefkühl';
  if (/milch|skyr|joghurt|quark|kase|butter|tofu|eier/.test(n)) return 'Kühlregal';
  if (/fleisch|hack|hahnchen|huhn|lachs|fisch|garnelen/.test(n)) return 'Fleisch & Fisch';
  if (/brot|brotchen|toast/.test(n)) return 'Brot & Backwaren';
  if (/banan|avocado|beeren|brokkoli|kohl|karott|paprika|zwiebel|knoblauch|ingwer|limett|zitron|salat|tomat|spinat|kartoffel|mango|koriander|petersilie|apfel|gurke/.test(n)) return 'Obst & Gemüse';
  if (/sauce|sosse|salz|pfeffer|gewurz|essig|ol\b|paste|sriracha|sesam/.test(n)) return 'Gewürze & Saucen';
  if (/wasser|saft|cola|limonade|kaffee|espresso|bier/.test(n)) return 'Getränke';
  if (/spul|papier|seife|wasch|mull|zahnpasta/.test(n)) return 'Haushalt';
  if (/nudel|spaghetti|reis|mus|honig|sirup|starke|mehl|hafer|protein|chia|linse|bohne/.test(n)) return 'Vorrat';
  return 'Sonstiges';
}
export const pantry = name => /^(salz|pfeffer|wasser|speisestarke|olivenol|neutrales ol|sesamol)$/.test(normalize(name));
export function baseQuantity(quantity,unit) {
  const map = {kg:['g',1000],g:['g',1],l:['ml',1000],ml:['ml',1],piece:['piece',1]};
  const [base,factor] = map[unit] || [unit,1];
  return {quantity:Math.round(Number(quantity)*factor*10000)/10000,unit:base};
}
export function makeItem({name,quantity=1,unit='piece',ingredient=null,product_id=null,category=null,note=''}) {
  const base = baseQuantity(quantity,unit);
  const key = ingredient ? identity(ingredient) : normalize(name);
  // Garlic cloves and bulbs must never be merged as piece; grams can be combined.
  const kind = key === 'knoblauch' && base.unit === 'piece' ? normalize(ingredient?.name || name) : key;
  return {id:crypto.randomUUID(),name:name.trim(),...base,ingredient_id:ingredient?.id || null,product_id,
    merge_key:[kind,base.unit,product_id || ''].join('|'),category:categoryFor(name,category || ingredient?.category),note,checked:false,removed:false};
}
export function applyAction(document, action) {
  const doc = structuredClone(document || {name:'Einkauf',retailer:'REWE',categories:CATEGORIES,items:[],archived:false});
  if(action.type === 'meta') Object.assign(doc,action.patch);
  if(action.type === 'add') for(const incoming of action.items) {
    const item = doc.items.find(i=>!i.removed && !i.checked && i.merge_key === incoming.merge_key);
    if(item) { item.quantity = Math.round((Number(item.quantity)+Number(incoming.quantity))*10000)/10000; item.alias_ids=[...new Set([...(item.alias_ids||[]),incoming.id])]; }
    else doc.items.push({...incoming});
  }
  if(action.type === 'item') doc.items = doc.items.map(i=>(i.id === action.id || i.alias_ids?.includes(action.id)) ? {...i,...action.patch} : i);
  return doc;
}
function fallback(item) {
  const category = item.category || categoryFor(item.name);
  const n=normalize(item.name);
  // Broad German retail guide values, explicitly estimates, per whole assumed pack.
  let pack = item.unit === 'g' ? 500 : item.unit === 'ml' ? 1000 : 1;
  let price = {'Obst & Gemüse':1.99,'Kühlregal':1.99,'Fleisch & Fisch':5.99,'Brot & Backwaren':2.49,'Vorrat':2.49,'Gewürze & Saucen':2.49,'Tiefkühl':2.99,'Getränke':1.49,'Haushalt':2.99,'Sonstiges':2.99}[category];
  if(/avocado/.test(n)) {pack=item.unit==='g'?200:1;price=1.29;}
  if(/milch/.test(n)&&item.unit==='ml') {pack=1000;price=1.19;}
  if(/skyr|joghurt/.test(n)&&item.unit==='g') {pack=500;price=1.49;}
  if(/starke/.test(n)&&item.unit==='g') {pack=400;price=1.29;}
  if(/knoblauchzehen/.test(n)&&item.unit==='piece') {pack=10;price=0.79;}
  return {price_eur:price,package_quantity:pack,package_unit:item.unit,kind:'guide',label:'Richtpreis · angenommene Packung',deposit_eur:null};
}
export function priceFor(item,retailer,catalog,now=new Date()) {
  const ingredients=catalog.ingredients || [], products=catalog.products || [];
  const ingredient=ingredients.find(i=>i.id===item.ingredient_id);
  const ids=new Set(ingredient ? ingredients.filter(i=>identity(i)===identity(ingredient)).map(i=>i.id) : []);
  const eligible=products.filter(p=>item.product_id ? p.id===item.product_id : ids.has(p.ingredient_id));
  const productIds=new Set(eligible.map(p=>p.id));
  const today=now.toISOString().slice(0,10);
  const prices=(catalog.prices || []).filter(p=>productIds.has(p.product_id)&&eligible.some(product=>product.id===p.product_id&&product.package_unit===p.package_unit&&Number(product.package_quantity)===Number(p.package_quantity))&&p.original_currency==='EUR'&&Number(p.price_eur)>0&&p.package_unit===item.unit&&Number(p.package_quantity)>0&&p.status!=='needs_review'&&(!p.valid_until||p.valid_until>=today)&&!['member','coupon'].includes(p.price_type)&&p.observed_on<=today);
  const exact = p=>normalize(p.retailer)===normalize(retailer)&&p.channel!=='estimate'&&p.price_type!=='estimate';
  const online = p=>p.channel==='online'&&p.source_url;
  prices.sort((a,b)=>Number(exact(b))-Number(exact(a))||Number(online(b))-Number(online(a))||b.observed_on.localeCompare(a.observed_on));
  const known=prices.find(exact), comparison=prices.find(online);
  const key = researchKey(item,retailer);
  const research=(catalog.research || []).find(r=>r.query_key===key&&r.status==='found'&&r.result?.package_unit===item.unit&&r.result?.price_eur>0&&now-Date.parse(r.checked_at)<7*86400000);
  let chosen;
  if(known) chosen={...known,kind:'known',label:`${known.retailer} · ${known.observed_on}`,deposit_eur:null};
  else if(research) chosen={...research.result,kind:'online',label:`Online · ${research.result.retailer} · ${research.result.observed_on}`};
  else if(comparison) chosen={...comparison,kind:'online',label:`Vergleich · ${comparison.retailer} · ${comparison.observed_on}`,deposit_eur:null};
  else chosen=fallback(item);
  const packs=Math.ceil((Number(item.quantity)-1e-9)/Number(chosen.package_quantity));
  return {...chosen,packs,total:Math.round(packs*Number(chosen.price_eur)*100)/100,deposit:chosen.deposit_eur==null?null:Math.round(packs*Number(chosen.deposit_eur)*100)/100};
}
export const researchKey=(item,retailer)=>[normalize(retailer),item.product_id||normalize(item.name),item.unit].join('|');
export function totals(items,retailer,catalog) {
  return items.filter(i=>!i.removed).reduce((sum,item)=>{const p=priceFor(item,retailer,catalog);return {total:sum.total+p.total,remaining:sum.remaining+(item.checked?0:p.total),deposit:sum.deposit+(p.deposit||0),remainingDeposit:sum.remainingDeposit+(item.checked?0:p.deposit||0),unknownDeposit:sum.unknownDeposit||p.deposit==null};},{total:0,remaining:0,deposit:0,remainingDeposit:0,unknownDeposit:false});
}

export const COMPARISON_RETAILERS = ['REWE','Penny','Lidl','Edeka'];
export function compareRetailers(items,catalog) {
  const markets=COMPARISON_RETAILERS.map(retailer=>{
    const sum=totals(items,retailer,catalog);
    const kinds=items.filter(i=>!i.removed).map(i=>priceFor(i,retailer,catalog).kind);
    return {retailer,...sum,known:kinds.filter(k=>k==='known').length,online:kinds.filter(k=>k==='online').length,guides:kinds.filter(k=>k==='guide').length};
  });
  const mean=key=>markets.reduce((sum,m)=>sum+m[key],0)/markets.length;
  return {markets,total:mean('total'),remaining:mean('remaining'),deposit:mean('deposit'),remainingDeposit:mean('remainingDeposit'),unknownDeposit:markets.some(m=>m.unknownDeposit)};
}
