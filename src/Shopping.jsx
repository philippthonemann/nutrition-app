import {useContext,useEffect,useRef,useState} from 'react';
import {AccountSettingsContext} from './AccountSettingsContext';
import ProfileMenu from './ProfileMenu.jsx';
import { BottomNav } from './NutritionNav.jsx';
import InfoTip from './InfoTip.jsx';
import Icon from './Icon.jsx';
import {authFetch} from './authFetch';
import Ingredients from './Ingredients.jsx';
import {flushSync} from 'react-dom';
import useShopping from './useShopping';
import {CATEGORIES,categoryFor,makeItem,normalize,pantry,priceFor,totals,money,researchKey} from '../lib/shopping.js';
import './theme.css';
import './shopping.css';

const shoppingMarkets = ['REWE', 'Lidl', 'Penny'];

const displayUnit=unit=>unit==='piece'?'Stk.':unit;
const quantityText=item=>`${Number(item.quantity).toLocaleString('de-DE',{maximumFractionDigits:2})} ${displayUnit(item.unit)}`;
function Modal({title,onClose,children}) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="q-meal-editor shop-modal" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><header><h2>{title}</h2><button aria-label="Schließen" onClick={onClose}><Icon name="close"/></button></header>{children}</dialog>;
}
function ItemEditor({item,onSave,onClose}) {
  const [quantity,setQuantity]=useState(String(item.quantity));
  const [category,setCategory]=useState(() => categoryFor(item.name, item.category));
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
  const current=activeLists.find(l=>l.id===selected) || activeLists.find(l=>normalize(l.document.name)==='wocheneinkauf') || activeLists[0];
  const [query,setQuery]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [unit,setUnit]=useState('piece');
  const [recipeOpen,setRecipeOpen]=useState(false);
  const [editing,setEditing]=useState(null);
  const [ingredientsOpen,setIngredientsOpen]=useState(false);
  const [grouped, setGrouped] = useState(() => {
    try { return localStorage.getItem('shopping-grouped') !== 'false'; }
    catch { return true; }
  });
  const [settings,setSettings]=useState(false);
  const [newName,setNewName]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [recentLimit,setRecentLimit]=useState(20);
  const [researchStatus,setResearchStatus]=useState('');
  const [priceDetails,setPriceDetails]=useState(null);
  const input=useRef(null);
  const listMenuRef=useRef(null);
  const doc=current?.document;
  const visible=doc?.items.filter(i=>!i.removed)||[];
  const openItems = visible.filter(item => !item.checked).map(item => ({
    ...item, category: categoryFor(item.name, item.category),
  }));
  const selectedMarket = shoppingMarkets.includes(doc?.retailer) ? doc.retailer : shoppingMarkets[0];
  const marketTotals = shoppingMarkets.map(retailer => ({
    retailer,
    total: totals(openItems, retailer, catalog).total,
  }));
  const order=[...new Set([...(doc?.categories||[]).filter(category => CATEGORIES.includes(category)),...CATEGORIES])];
  const openKeys = new Set(openItems.map(item => item.merge_key));
  const history = [
    ...visible.filter(item => item.checked).reverse(),
    ...lists.flatMap(list => list.document.items).reverse(),
  ];
  const recentByKey = new Map();
  for (const item of history) {
    if (!item.removed && !openKeys.has(item.merge_key) && !recentByKey.has(item.merge_key)) {
      recentByKey.set(item.merge_key, item);
    }
  }
  const recent = [...recentByKey.values()];
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
      const markets = [selectedMarket, ...shoppingMarkets.filter(market => market !== selectedMarket)];
      const missing=markets.flatMap(retailer=>doc.items.filter(i=>!i.removed&&priceFor(i,retailer,catalog).kind==='guide').map(item=>({item,retailer}))).find(({item,retailer})=>{
        const hit=catalog.research.find(r=>r.query_key===researchKey(item,retailer));
        return !hit||Date.now()-Date.parse(hit.checked_at)>86400000;
      });
      if(!missing)return;
      setResearchStatus('Preisrecherche läuft im Hintergrund …');
      try {
        const response=await authFetch('/api/shopping-prices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:missing.item.name,unit:missing.item.unit,retailer:missing.retailer,product_id:missing.item.product_id})});
        if(!response.ok)throw Error();
        const data=await response.json();
        if(!cancelled){setResearchStatus(data.status==='found'?'Onlinepreis ergänzt':data.status==='unavailable'?'Online-Recherche derzeit nicht verfügbar · Richtpreise aktiv':'Kein belastbarer Onlinepreis · Richtpreis bleibt');await store.refreshCatalog();}
      } catch {if(!cancelled)setResearchStatus('Online-Recherche derzeit nicht verfügbar · Richtpreise aktiv');}
    },1800);
    return()=>{cancelled=true;clearTimeout(timer);};
  // Only catalog research changes should restart a batch; name/retailer changes select a new query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[researchSignature,selectedMarket,catalog.research]);
  const listMenu = <details className="shop-list-menu" ref={listMenuRef}>
    <summary aria-label="Einkaufsliste wechseln">{doc?.name || 'Einkaufen'} <Icon name="down" size={18}/></summary>
    <div className="q-card shop-list-options">
      {activeLists.map(list => <button key={list.id} aria-pressed={list.id === current?.id} onClick={() => {
        select(list.id);
        listMenuRef.current.open = false;
      }}>{list.document.name}{list.id === current?.id && <Icon name="check" size={16}/>}</button>)}
      <button onClick={() => { listMenuRef.current.open = false; setCreateOpen(true); }}><Icon name="plus" size={18}/> Neue Liste</button>
    </div>
  </details>;
  const navigation = <BottomNav label="Einkaufsnavigation" active={ingredientsOpen ? 'ingredients' : settings && current ? 'settings' : 'list'} entries={[
        { key:'list', icon:'basket', title:'Liste', action:() => { setIngredientsOpen(false); setSettings(false); window.scrollTo(0, 0); } },
        { key:'recipe', icon:'utensils', title:'Rezepte', action:() => { setIngredientsOpen(false); current ? setRecipeOpen(true) : setCreateOpen(true); } },
        { key:'add', icon:'plus', title:'Artikel hinzufügen', primary:true, action:() => { flushSync(() => setIngredientsOpen(false)); current ? input.current?.focus() : setCreateOpen(true); } },
        { key:'ingredients', icon:'leaf', title:'Zutaten', action:() => { setIngredientsOpen(true); window.scrollTo(0, 0); } },
        { key:'settings', icon:'edit', title:'Verwalten', action:() => { setIngredientsOpen(false); current ? setSettings(value => !value) : setCreateOpen(true); } },
      ]}/>;
  if (ingredientsOpen) return <main className="shopping-page">
    <header className="q-topbar shop-header"><h1 className="shop-list-menu-title">Zutaten</h1><ProfileMenu shopping/></header>
    <div className="shop-main"><Ingredients userId={userId} onCatalogChange={store.refreshCatalog}/></div>
    {navigation}
  </main>;
  return <main className="shopping-page">
    <header className="q-topbar shop-header">{listMenu}<ProfileMenu shopping/></header>
    <div className="shop-main">{store.error&&<p className="shop-alert" role="status">{store.error}</p>}{!current?<section className="q-card shop-empty"><Icon name="basket" size={40}/><h2>Dein nächster Einkauf</h2><p>Erstelle eine Liste und füge Artikel oder ganze Rezepte hinzu.</p><button className="shop-primary" onClick={()=>setCreateOpen(true)}>Erste Liste erstellen</button></section>:<>
        <section className="shop-cost">
          <div className="q-energy-inset">
            <div className="q-energy-heading">
              <span><Icon name="wallet" size={17}/> Geschätzter Einkauf</span>
              <InfoTip label="Preisberechnung">Die Schätzung umfasst die offenen Artikel dieser Liste und rechnet mit ganzen Packungen. Tippe auf einen Markt, um dessen Artikelpreise anzuzeigen.</InfoTip>
            </div>
            <div className="shop-market-grid" aria-label="Geschätzte Preise nach Supermarkt">
              {marketTotals.map(market => <button key={market.retailer}
                aria-pressed={selectedMarket === market.retailer}
                onClick={() => void mutate(current.id, {type:'meta', patch:{retailer:market.retailer}})}>
                <span>{market.retailer}</span><strong>{money(market.total)}</strong>
              </button>)}
            </div>
          </div>
        </section>
        {settings&&<section className="q-card shop-settings"><h3>Liste bearbeiten</h3><form onSubmit={e=>{e.preventDefault();const name=new FormData(e.currentTarget).get('name').trim();if(name)void mutate(current.id,{type:'meta',patch:{name}});}}><label>Listenname<input name="name" defaultValue={doc.name} maxLength={100} required/></label><button>Umbenennen</button></form><h3>Kategorienreihenfolge</h3><ol>{order.map((c,index)=><li key={c}><span>{c}</span><button disabled={index===0} aria-label={`${c} nach oben`} onClick={()=>{const next=[...order];[next[index-1],next[index]]=[next[index],next[index-1]];void mutate(current.id,{type:'meta',patch:{categories:next}});}}><Icon name="up"/></button><button disabled={index===order.length-1} aria-label={`${c} nach unten`} onClick={()=>{const next=[...order];[next[index],next[index+1]]=[next[index+1],next[index]];void mutate(current.id,{type:'meta',patch:{categories:next}});}}><Icon name="down"/></button></li>)}</ol><button onClick={()=>void mutate(current.id,{type:'meta',patch:{archived:true}})}>Liste archivieren</button></section>}
        <div className="shop-add">
          <form onSubmit={event => {
            event.preventDefault();
            void add(catalog.ingredients.find(ingredient => normalize(ingredient.name) === normalize(query)) || null);
          }}>
            <div className="shop-add-entry">
              <label className="shop-search">
                <Icon name="search"/>
                <input ref={input} type="search" enterKeyHint="done" aria-label="Artikel suchen oder hinzufügen"
                  value={query} maxLength={160} onChange={event => setQuery(event.target.value)}
                  placeholder="Artikel hinzufügen" required autoComplete="off"/>
              </label>
              <button type="button" onClick={() => setRecipeOpen(true)}><Icon name="utensils"/> Rezept</button>
            </div>
            {query.trim() && <>
              <div className="shop-suggestions">{uniqueSuggestions.map(ingredient =>
                <button type="button" key={ingredient.id} onClick={() => void add(ingredient)}>{ingredient.name}</button>
              )}</div>
              <details className="shop-amount-options">
                <summary>Menge anpassen</summary>
                <div className="shop-add-amount">
                  <input aria-label="Menge" type="number" min="0.001" max="1000000" step="any"
                    required value={quantity} onChange={event => setQuantity(event.target.value)}/>
                  <select aria-label="Einheit" value={unit} onChange={event => setUnit(event.target.value)}>
                    {['piece','g','kg','ml','l'].map(value => <option key={value} value={value}>{displayUnit(value)}</option>)}
                  </select>
                </div>
              </details>
              <button type="submit" className="shop-primary shop-submit">Hinzufügen</button>
            </>}
          </form>
        </div>
        {openItems.length > 0 && <div className="shop-view-toggle" role="group" aria-label="Artikelansicht">
          {[['Kategorien', true], ['Alle', false]].map(([label, value]) =>
            <button key={label} type="button" aria-pressed={grouped === value} onClick={() => {
              setGrouped(value);
              try { localStorage.setItem('shopping-grouped', String(value)); } catch { /* preference is optional */ }
            }}>{label}</button>
          )}
        </div>}
        <div className="shop-articles">{(grouped ? order : ['Alle Artikel']).map(category=>{const items=grouped ? openItems.filter(i=>i.category===category) : openItems;return items.length?<section key={category} className="shop-category"><h3>{category}<small>{items.length}</small></h3><div className="shop-item-grid">{items.map(item=><Item key={item.id} item={item} price={priceFor(item,selectedMarket,catalog)} onToggle={()=>void mutate(current.id,{type:'item',id:item.id,patch:{checked:true}})} onEdit={()=>setEditing(item)} onPrice={()=>setPriceDetails(item)}/>)}</div></section>:null;})}
        {!openItems.length&&<p className="shop-empty-inline">Deine Liste ist leer.</p>}
        </div><RecentItems recent={recent} catalog={catalog} market={selectedMarket} onPrice={setPriceDetails} limit={recentLimit} onMore={()=>setRecentLimit(recentLimit+20)} onAdd={item=>void add(null,item)}/><p className="shop-research-status" role="status">{researchStatus}</p>
      </>}</div>
      {lists.some(l=>l.document.archived)&&<details className="shop-archive"><summary>Archivierte Listen</summary>{lists.filter(l=>l.document.archived).map(l=><button key={l.id} onClick={()=>void mutate(l.id,{type:'meta',patch:{archived:false}})}>{l.document.name} wiederherstellen</button>)}</details>}
      {createOpen&&<Modal title="Neue Einkaufsliste" onClose={()=>setCreateOpen(false)}><form onSubmit={create}><label>Name<input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} maxLength={100} required placeholder="Wocheneinkauf"/></label><button className="shop-primary" disabled={!newName.trim()}>Liste erstellen</button></form></Modal>}
      {recipeOpen&&<RecipePicker catalog={catalog} onClose={()=>setRecipeOpen(false)} onAdd={items=>mutate(current.id,{type:'add',items})}/>}
      {editing&&<ItemEditor key={editing.id} item={editing} onClose={()=>setEditing(null)} onSave={patch=>mutate(current.id,{type:'item',id:editing.id,patch})}/>}
      {priceDetails&&<Modal title={`Preis · ${priceDetails.name}`} onClose={()=>setPriceDetails(null)}>{(()=>{const p=priceFor(priceDetails,selectedMarket,catalog);return <div className="shop-price-detail"><p>{p.label}</p><strong>{money(p.total)}</strong><p>{p.packs} × {p.package_quantity} {displayUnit(p.package_unit)} zu {money(p.price_eur)} je Packung</p><p>Benötigt: {quantityText(priceDetails)}</p>{p.source_url&&<a href={p.source_url} target="_blank" rel="noreferrer">Preisquelle öffnen</a>}{p.kind==='guide'&&<p>Allgemeine Schätzung mit angenommener Packung. Kein bestätigter Ladenpreis.</p>}{p.kind==='online'&&<p>Online-Vergleichspreis. Der Preis vor Ort kann abweichen.</p>}</div>;})()}</Modal>}
      {navigation}
      {(store.pending > 0 || settings) && <p className="shop-sync" role="status">
        {store.pending ? `${store.pending} Änderungen ausstehend · ` : ''}{store.status}
        {settings && <button onClick={() => void store.sync()}>Synchronisieren</button>}
      </p>}
    </main>;
}
const categoryIcons = {
  'Obst & Gemüse': 'leaf',
  'Milch & Käse': 'drop',
  'Fleisch & Fisch': 'utensils',
  'Brot & Gebäck': 'grain',
  'Zutaten & Gewürze': 'drop',
  'Fertig- & Tiefkühlprodukte': 'snow',
  'Getränke': 'glass',
  'Haushalt': 'home',
};

const priceSources = {
  known: { icon: 'receipt', label: 'Erfasster Preis' },
  guide: { icon: 'target', label: 'Richtpreis' },
  online: { icon: 'globe', label: 'Onlinepreis' },
};

const productIcons = [
  [/kokosmilch|kokoscreme/, 'coconut'],
  [/mandel(?:milch|drink)|hafer(?:milch|drink)|soja(?:milch|drink)|milch/, 'milk'],
  [/banan/, 'banana'],
  [/apfel/, 'apple'],
  [/brot|brotchen|toast/, 'bread'],
  [/reis/, 'rice'],
  [/haferflocken/, 'grain'],
  [/brokkoli/, 'broccoli'],
  [/sojasauce|sojasosse/, 'bottle'],
  [/kaffee|espresso/, 'coffee'],
  [/eier|\bei\b/, 'egg'],
];

function Item({item, price, onToggle, onEdit, onPrice, recent = false}) {
  const source = priceSources[price.kind];
  const priceLabel = `${money(price.total)} · ${source.label}`;
  const priceContent = <><strong>{money(price.total)}</strong><Icon name={source.icon} size={13}/></>;
  return <article className={`q-card shop-item${recent ? ' shop-item-recent' : ''}`}>
    <button type="button" className="shop-item-toggle" onClick={onToggle}
      aria-label={`${item.name}: ${recent ? 'zur Liste hinzufügen' : 'als gekauft markieren'}`}>
      <Icon name={productIcons.find(([pattern]) => pattern.test(normalize(item.name)))?.[1] || categoryIcons[item.category] || 'basket'} size={36}/>
      <span className="shop-item-name">{item.name}<small>{quantityText(item)}{item.note ? ' · Menge prüfen' : ''}</small></span>
    </button>
    <div className="shop-item-actions">
      {onPrice
        ? <button type="button" className="shop-item-price" title={priceLabel}
            aria-label={`Preisdetails für ${item.name}: ${priceLabel}`} onClick={onPrice}>{priceContent}</button>
        : <span className="shop-item-price" title={priceLabel} aria-label={priceLabel}>{priceContent}</span>}
      {onEdit && <button type="button" aria-label={`Menge bearbeiten: ${item.name}`} onClick={onEdit}><Icon name="edit" size={16}/></button>}
    </div>
  </article>;
}

function RecentItems({recent, catalog, market, limit, onMore, onAdd, onPrice}) {
  return <section className="shop-recents">
    <h3>Zuletzt verwendet</h3>
    {recent.length === 0 && <p>Hier erscheinen Artikel, die du wieder auf die Liste setzen kannst.</p>}
    <div className="shop-item-grid">
      {recent.slice(0, limit).map(item => <Item key={item.merge_key} item={item}
        price={priceFor(item, market, catalog)} recent onToggle={() => onAdd(item)}
        onPrice={onPrice ? () => onPrice(item) : undefined}/>)}
    </div>
    {onMore && recent.length > limit && <button onClick={onMore}>Weitere laden</button>}
  </section>;
}

