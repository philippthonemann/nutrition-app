import {useContext,useEffect,useRef,useState} from 'react';
import {AccountSettingsContext} from './AccountSettingsContext';
import ProfileMenu from './ProfileMenu.jsx';
import InfoTip from './InfoTip.jsx';
import Icon from './Icon.jsx';
import {authFetch} from './authFetch';
import useShopping from './useShopping';
import {CATEGORIES,makeItem,normalize,pantry,priceFor,totals,money,researchKey} from '../lib/shopping.js';
import './theme.css';
import './shopping.css';

const displayUnit=unit=>unit==='piece'?'Stk.':unit;
const quantityText=item=>`${Number(item.quantity).toLocaleString('de-DE',{maximumFractionDigits:2})} ${displayUnit(item.unit)}`;
function Modal({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="q-meal-editor shop-modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><header><h2>{title}</h2><button aria-label="Schließen" onClick={onClose}><Icon name="close"/></button></header>{children}</dialog>;
}
function ItemEditor({item,onSave,onClose}) {
  const [quantity,setQuantity]=useState(String(item.quantity));
  const [category,setCategory]=useState(item.category);
  return <Modal title={item.name} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();if(await onSave({quantity:Number(quantity),category}))onClose();}}>
    <label>Menge ({displayUnit(item.unit)})<input autoFocus type="number" min="0.001" max="10000000" step="any" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Kategorie<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
    {item.note&&<p>{item.note}</p>}
    <button className="shop-primary" type="submit">Speichern</button><button type="button" onClick={async()=>{if(await onSave({removed:true}))onClose();}}>Von Liste entfernen</button>
  </form></Modal>;
}
function RecipePicker({catalog,onAdd,onClose}) {
  const [recipeId,setRecipeId]=useState('');
  const [servings,setServings]=useState(4);
  const [excluded,setExcluded]=useState([]);
  const recipe=catalog.recipes.find(r=>r.id===recipeId);
  const lines=catalog.recipeIngredients.filter(r=>r.recipe_id===recipeId).sort((a,b)=>a.position-b.position);
  const nameFor=line=>catalog.ingredients.find(i=>i.id===line.ingredient_id)?.name||line.original_text;
  const selected=lines.filter(l=>!excluded.includes(l.id));
  const [busy,setBusy]=useState(false);
  async function add() {
    setBusy(true);
    const items=selected.map(line=>{
      const ingredient=catalog.ingredients.find(i=>i.id===line.ingredient_id);
      const unit=line.unit||line.original_unit_code||'piece';
      const normalized=['g','ml','piece','kg','l'].includes(unit);
      const rawQuantity=line.quantity||line.original_quantity;
      const quantity=rawQuantity?Number(rawQuantity)*Number(servings)/Number(recipe.servings||1):1;
      return makeItem({name:nameFor(line),quantity:normalized?quantity:1,unit:normalized?unit:'piece',ingredient,product_id:line.product_id,note:!line.quantity||!normalized?`Menge prüfen: ${line.original_text}`:''});
    });
    if(await onAdd(items))onClose();else setBusy(false);
  }
  return <Modal title="Aus Rezept hinzufügen" onClose={onClose}><label>Rezept<select autoFocus value={recipeId} onChange={e=>{setRecipeId(e.target.value);setExcluded(catalog.recipeIngredients.filter(l=>l.recipe_id===e.target.value&&(l.optional||pantry(nameFor(l)))).map(l=>l.id));}}><option value="">Rezept auswählen</option>{catalog.recipes.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {recipe&&<><label>Portionen<input type="number" min="0.25" max="100" step="0.25" value={servings} onChange={e=>setServings(e.target.value)}/></label><p>Vorratszutaten und optionale Zutaten sind abgewählt. Bitte kurz prüfen.</p><div className="shop-recipe-lines">{lines.map(l=><label key={l.id}><input type="checkbox" checked={!excluded.includes(l.id)} onChange={()=>setExcluded(excluded.includes(l.id)?excluded.filter(id=>id!==l.id):[...excluded,l.id])}/><span>{nameFor(l)}<small>{l.quantity?quantityText({quantity:Number(l.quantity)*Number(servings)/Number(recipe.servings||1),unit:l.unit}):l.original_text}{pantry(nameFor(l))?' · vermutlich vorhanden':''}</small></span></label>)}</div><button className="shop-primary" disabled={busy||!selected.length||!Number.isFinite(Number(servings))||Number(servings)<=0||Number(servings)>100} onClick={add}>{selected.length} Zutaten übernehmen</button></>}
    {!catalog.recipes.length&&<p>Keine Rezepte geladen. Verbinde dich zum ersten Laden mit dem Internet.</p>}
  </Modal>;
}
export default function Shopping() {
  const {userId}=useContext(AccountSettingsContext);
  const store=useShopping(userId);
  const {lists,catalog,mutate}=store;
  const activeLists=lists.filter(l=>!l.document.archived);
  const [selected,setSelected]=useState(()=>{try{return localStorage.getItem(`nutrition:shopping:selected:${userId}`)||'';}catch{return '';}});
  const current=activeLists.find(l=>l.id===selected)||activeLists[0];
  const [query,setQuery]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [unit,setUnit]=useState('piece');
  const [recipeOpen,setRecipeOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [settings,setSettings]=useState(false);
  const [newName,setNewName]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [recentLimit,setRecentLimit]=useState(20);
  const [researchStatus,setResearchStatus]=useState('');
  const [priceDetails,setPriceDetails]=useState(null);
  const input=useRef(null);
  const doc=current?.document;
  const visible=doc?.items.filter(i=>!i.removed)||[];
  const summary=totals(visible,doc?.retailer,catalog);
  const order=[...new Set([...(doc?.categories||[]),...CATEGORIES])];
  const recent=lists.flatMap(l=>l.document.items).reverse().filter((item,index,all)=>all.findIndex(i=>i.merge_key===item.merge_key)===index);
  const suggestions=catalog.ingredients.filter(i=>normalize(i.name).includes(normalize(query))||(i.aliases||[]).some(a=>normalize(a).includes(normalize(query))));
  const uniqueSuggestions=[...new Map(suggestions.map(i=>[`${normalize(i.canonical_key)}:${normalize(i.name)}`,i])).values()].slice(0,8);
  function select(id) {setSelected(id);setSettings(false);try{localStorage.setItem(`nutrition:shopping:selected:${userId}`,id);}catch{/* selection is optional */}}
  async function create(e) {e.preventDefault();const id=crypto.randomUUID();if(await mutate(id,{type:'create',name:newName.trim(),categories:CATEGORIES})){select(id);setNewName('');setCreateOpen(false);}}
  async function add(ingredient=null,previous=null) {
    if(!current)return false;
    const name=ingredient?.name||previous?.name||query.trim();
    if(!name||(!previous&&(!Number.isFinite(Number(quantity))||Number(quantity)<=0||Number(quantity)>1000000)))return false;
    const item=makeItem({name,quantity:previous?.quantity||Number(quantity),unit:previous?.unit||unit,ingredient:ingredient||catalog.ingredients.find(i=>i.id===previous?.ingredient_id),product_id:previous?.product_id||null,category:previous?.category});
    const ok=await mutate(current.id,{type:'add',items:[item]});
    if(ok){setQuery('');setQuantity(1);input.current?.focus();}return ok;
  }
  // Non-blocking research: one ingredient at a time, cache failures as well as matches.
  const researchSignature=JSON.stringify(visible.map(i=>[i.name,i.unit,i.product_id]));
  useEffect(()=>{
    if(!doc||!navigator.onLine)return;
    let cancelled=false;
    const timer=setTimeout(async()=>{
      const missing=doc.items.filter(i=>!i.removed&&priceFor(i,doc.retailer,catalog).kind==='guide').find(i=>{
        const hit=catalog.research.find(r=>r.query_key===researchKey(i,doc.retailer));
        return !hit||Date.now()-Date.parse(hit.checked_at)>86400000;
      });
      if(!missing)return;
      setResearchStatus('Preisrecherche läuft im Hintergrund …');
      try {
        const response=await authFetch('/api/shopping-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:missing.name,unit:missing.unit,retailer:doc.retailer,product_id:missing.product_id})});
        if(!response.ok)throw Error();
        const data=await response.json();
        if(!cancelled){setResearchStatus(data.status==='found'?'Onlinepreis ergänzt':data.status==='unavailable'?'Online-Recherche derzeit nicht verfügbar · Richtpreise aktiv':'Kein belastbarer Onlinepreis · Richtpreis bleibt');await store.refreshCatalog();}
      } catch {if(!cancelled)setResearchStatus('Online-Recherche derzeit nicht verfügbar · Richtpreise aktiv');}
    },1800);
    return()=>{cancelled=true;clearTimeout(timer);};
  // Only catalog research changes should restart a batch; name/retailer changes select a new query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[researchSignature,doc?.retailer,catalog.research]);
  return <main className="shopping-page"><header className="shop-header"><a className="shop-back" href="/"><Icon name="home"/> Nutrition</a><ProfileMenu/></header><div className="shop-heading"><div><span className="shop-eyebrow">NUTRITION</span><h1>Einkaufen</h1></div><button onClick={()=>setCreateOpen(true)}><Icon name="plus"/> Neue Liste</button></div>
    <div className="shop-layout"><aside className="shop-sidebar"><h2>Deine Listen</h2><nav aria-label="Einkaufslisten">{activeLists.map(l=><button key={l.id} aria-current={current?.id===l.id?'page':undefined} onClick={()=>select(l.id)}><Icon name="basket"/><span>{l.document.name}</span><small>{l.document.items.filter(i=>!i.removed&&!i.checked).length}</small></button>)}</nav><span className="shop-sync" role="status">{store.pending?`${store.pending} Änderungen ausstehend · `:''}{store.status}</span><button onClick={()=>void store.sync()}><Icon name="refresh"/> Synchronisieren</button></aside>
      <div className="shop-main">{store.error&&<p className="shop-alert" role="status">{store.error}</p>}{!current?<section className="q-card shop-empty"><Icon name="basket" size={40}/><h2>Dein nächster Einkauf</h2><p>Erstelle eine Liste und füge Artikel oder ganze Rezepte hinzu.</p><button className="shop-primary" onClick={()=>setCreateOpen(true)}>Erste Liste erstellen</button></section>:<>
        <div className="shop-list-heading"><h2>{doc.name}</h2><button aria-label="Liste und Kategorien bearbeiten" aria-expanded={settings} onClick={()=>setSettings(!settings)}><Icon name="edit"/></button></div>
        <section className="q-card q-energy-card shop-cost"><div className="q-energy-inset"><div className="q-energy-heading"><span><Icon name="wallet" size={17}/> Geschätzter Einkauf</span><InfoTip label="Preisberechnung">Passender Händlerpreis, recherchierter Onlinepreis, sonst Richtpreis. Ganze Packungen werden aufgerundet. Abgehakte Artikel bleiben im Gesamtpreis. Preisdetails pro Artikel zeigen Quelle, Datum und Packungsannahme. Pfand wird nur bei bekannter Höhe addiert.</InfoTip></div><div className="q-energy-reading"><span>≈ {money(summary.total+summary.deposit)}</span></div><div className="shop-cost-footer"><div><small>Noch einzukaufen</small><strong>≈ {money(summary.remaining+summary.remainingDeposit)}</strong></div><div><small>Pfand enthalten</small><strong>{money(summary.deposit)}{summary.unknownDeposit?' · teils unbekannt':''}</strong></div></div></div><div className="shop-cost-controls"><label>Supermarkt<select value={doc.retailer} onChange={e=>void mutate(current.id,{type:'meta',patch:{retailer:e.target.value}})}>{['REWE','Lidl','Penny','Aldi','Edeka','Kaufland','dm','Sonstiger'].map(r=><option key={r}>{r}</option>)}</select></label><span>{visible.filter(i=>!i.checked).length} offen · {visible.length} Artikel</span></div></section>
        {settings&&<section className="q-card shop-settings"><h3>Liste bearbeiten</h3><form onSubmit={e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name').trim();if(name)void mutate(current.id,{type:'meta',patch:{name}});}}><label>Listenname<input name="name" defaultValue={doc.name} maxLength={100} required/></label><button>Umbenennen</button></form><h3>Kategorienreihenfolge</h3><ol>{order.map((c,index)=><li key={c}><span>{c}</span><button disabled={index===0} aria-label={`${c} nach oben`} onClick={()=>{const next=[...order];[next[index-1],next[index]]=[next[index],next[index-1]];void mutate(current.id,{type:'meta',patch:{categories:next}});}}><Icon name="up"/></button><button disabled={index===order.length-1} aria-label={`${c} nach unten`} onClick={()=>{const next=[...order];[next[index],next[index+1]]=[next[index+1],next[index]];void mutate(current.id,{type:'meta',patch:{categories:next}});}}><Icon name="down"/></button></li>)}</ol><button onClick={()=>void mutate(current.id,{type:'meta',patch:{archived:true}})}>Liste archivieren</button></section>}
        <section className="q-card shop-add"><form onSubmit={e=>{e.preventDefault();void add(catalog.ingredients.find(i=>normalize(i.name)===normalize(query))||null);}}><label className="shop-search"><Icon name="search"/><input ref={input} aria-label="Artikel hinzufügen" value={query} maxLength={160} onChange={e=>setQuery(e.target.value)} placeholder="Was brauchst du?" required autoComplete="off"/></label><div className="shop-add-amount"><input aria-label="Menge" type="number" min="0.001" max="1000000" step="any" required value={quantity} onChange={e=>setQuantity(e.target.value)}/><select aria-label="Einheit" value={unit} onChange={e=>setUnit(e.target.value)}>{['piece','g','kg','ml','l'].map(u=><option key={u} value={u}>{displayUnit(u)}</option>)}</select><button className="shop-primary" type="submit" aria-label="Artikel hinzufügen" disabled={!query.trim()||Number(quantity)<=0}><Icon name="plus"/></button></div></form>{query.trim()&&<div className="shop-suggestions">{uniqueSuggestions.map(i=><button key={i.id} onClick={()=>void add(i)}>{i.name}<Icon name="plus" size={16}/></button>)}</div>}<button className="shop-recipe-button" onClick={()=>setRecipeOpen(true)}><Icon name="utensils"/> Aus Rezept hinzufügen</button></section>
        <div className="shop-articles">{order.map(category=>{const items=visible.filter(i=>i.category===category&&!i.checked);return items.length?<section key={category} className="shop-category"><h3>{category}<small>{items.length}</small></h3><div className="shop-item-grid">{items.map(item=><Item key={item.id} item={item} price={priceFor(item,doc.retailer,catalog)} onToggle={()=>void mutate(current.id,{type:'item',id:item.id,patch:{checked:true}})} onEdit={()=>setEditing(item)} onPrice={()=>setPriceDetails(item)}/>)}</div></section>:null;})}
        {!visible.length&&<p className="shop-empty-inline">Deine Liste ist bereit. Füge deinen ersten Artikel hinzu.</p>}
        {visible.some(i=>i.checked)&&<section className="shop-category shop-completed"><h3>Im Einkaufswagen<small>{visible.filter(i=>i.checked).length}</small></h3><div className="shop-item-grid">{visible.filter(i=>i.checked).map(item=><Item key={item.id} item={item} price={priceFor(item,doc.retailer,catalog)} onToggle={()=>void mutate(current.id,{type:'item',id:item.id,patch:{checked:false}})} onEdit={()=>setEditing(item)} onPrice={()=>setPriceDetails(item)}/>)}</div></section>}
        </div><section className="q-card shop-recents"><h3>Zuletzt verwendet</h3>{!recent.length&&<p>Deine verwendeten Artikel erscheinen hier.</p>}<div className="shop-recent-grid">{recent.slice(0,recentLimit).map(i=><button key={i.merge_key} onClick={()=>void add(null,i)}><Icon name="plus" size={16}/><span>{i.name}<small>{quantityText(i)}</small></span></button>)}</div>{recent.length>0&&<small>{Math.min(recentLimit,recent.length)} von {recent.length}</small>}{recent.length>recentLimit&&<button onClick={()=>setRecentLimit(recentLimit+20)}>Weitere laden</button>}</section><p className="shop-research-status" role="status">{researchStatus}</p>
      </>}</div></div>
      {lists.some(l=>l.document.archived)&&<details className="shop-archive"><summary>Archivierte Listen</summary>{lists.filter(l=>l.document.archived).map(l=><button key={l.id} onClick={()=>void mutate(l.id,{type:'meta',patch:{archived:false}})}>{l.document.name} wiederherstellen</button>)}</details>}
      {createOpen&&<Modal title="Neue Einkaufsliste" onClose={()=>setCreateOpen(false)}><form onSubmit={create}><label>Name<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} maxLength={100} required placeholder="Wocheneinkauf"/></label><button className="shop-primary" disabled={!newName.trim()}>Liste erstellen</button></form></Modal>}
      {recipeOpen&&<RecipePicker catalog={catalog} onClose={()=>setRecipeOpen(false)} onAdd={items=>mutate(current.id,{type:'add',items})}/>}
      {editing&&<ItemEditor key={editing.id} item={editing} onClose={()=>setEditing(null)} onSave={patch=>mutate(current.id,{type:'item',id:editing.id,patch})}/>}
      {priceDetails&&<Modal title={`Preis · ${priceDetails.name}`} onClose={()=>setPriceDetails(null)}>{(()=>{const p=priceFor(priceDetails,doc.retailer,catalog);return <div className="shop-price-detail"><p>{p.label}</p><strong>≈ {money(p.total)}</strong><p>{p.packs} × {p.package_quantity} {displayUnit(p.package_unit)} zu {money(p.price_eur)} je Packung</p><p>Benötigt: {quantityText(priceDetails)}</p><p>Pfand: {p.deposit==null?'unbekannt, nicht addiert':money(p.deposit)}</p>{p.source_url&&<a href={p.source_url} target="_blank" rel="noreferrer">Preisquelle öffnen</a>}{p.kind==='guide'&&<p>Allgemeine Schätzung mit angenommener Packung. Kein bestätigter Ladenpreis.</p>}{p.kind==='online'&&<p>Online-Vergleichspreis. Der Preis vor Ort kann abweichen.</p>}</div>;})()}</Modal>}
    </main>;
}
function Item({item,price,onToggle,onEdit,onPrice}) {
  return <article className={`q-card shop-item ${item.checked?'is-checked':''}`}><button className="shop-item-toggle" onClick={onToggle} aria-pressed={item.checked} aria-label={`${item.name} ${item.checked?'wieder auf die Liste':'abhaken'}`}><span className="shop-check">{item.checked&&<Icon name="check" size={17}/>}</span><span className="shop-item-name">{item.name}<small>{quantityText(item)}{item.note?' · Menge prüfen':''}</small></span></button><div className="shop-item-actions"><button className="shop-item-price" onClick={onPrice} aria-label={`Preisdetails ${item.name}`}><strong>≈ {money(price.total)}</strong><small>{price.kind==='known'?'Händlerpreis':price.kind==='online'?'Onlinepreis':'Richtpreis'}</small></button><button aria-label={`Menge bearbeiten: ${item.name}`} onClick={onEdit}><Icon name="edit" size={16}/></button></div></article>;
}
