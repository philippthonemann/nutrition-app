import Icon from './Icon.jsx';
import {useEffect, useMemo, useState} from 'react';
import {supabase} from './supabase';
import {CATEGORIES, categoryFor, money, normalize, priceFor} from '../lib/shopping.js';
import './Ingredients.css';

const tables = {
  ingredients: 'food_ingredients',
  products: 'food_products',
  nutrition: 'food_nutrition',
  prices: 'food_price_observations',
};
const nutrients = {
  calories_kcal: 'Energie (kcal)', protein_g: 'Protein (g)', carbs_g: 'Kohlenhydrate (g)',
  fat_g: 'Fett (g)', fiber_g: 'Ballaststoffe (g)', sugar_g: 'Zucker (g)', sodium_mg: 'Natrium (mg)',
};
const units = {g: 'g', ml: 'ml', piece: 'Stk.'};
const manual = 'Manuell in der Zutatenverwaltung erfasst';
const pageSize = 20;
const number = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 2});

async function loadRows(table, userId, signal) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const {data, error} = await supabase.from(table).select('*').eq('user_id', userId)
      .order('id').range(offset, offset + 499).abortSignal(signal);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

function SaveForm({children, save, label = 'Speichern'}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setStatus('');
    try {
      await save(values);
      setStatus('Gespeichert');
    } catch {
      setStatus('Speichern fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    <fieldset disabled={busy}>
      {children}
      <button className="shop-primary" type="submit">{busy ? 'Speichert …' : label}</button>
    </fieldset>
    <span role="status">{status}</span>
  </form>;
}

function NutritionEditor({row, owner, unit, save}) {
  return <SaveForm save={values => {
    const basis = {basis_quantity: Number(values.get('basis_quantity')), basis_unit: values.get('basis_unit')};
    const macros = Object.fromEntries(Object.keys(nutrients).map(key => {
      const value = values.get(key);
      return [key, value === '' ? null : Number(value)];
    }));
    if (Object.values(macros).every(value => value === null)) throw new Error('Missing nutrition');
    return save('nutrition', {...owner, ...basis, ...macros, source_type: 'label',
      source_note: manual, source_url: null, status: 'provisional',
      observed_at: new Date().toISOString()}, row?.source_note === manual ? row.id : undefined);
  }}>
    <div className="ingredient-fields">
      <label>Bezugsmenge<input type="number" name="basis_quantity" min="0.001" step="any" required defaultValue={row?.basis_quantity ?? (unit === 'piece' ? 1 : 100)}/></label>
      <label>Einheit<select name="basis_unit" defaultValue={row?.basis_unit ?? unit}>{Object.entries(units).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      {Object.entries(nutrients).map(([key, name]) => <label key={key}>{name}<input type="number" name={key} min="0" step="any" defaultValue={row?.[key] ?? ''}/></label>)}
    </div>
  </SaveForm>;
}

function Nutrition({row}) {
  if (!row) return <p className="ingredient-muted">Keine Nährwerte hinterlegt</p>;
  return <div>
    <p className="ingredient-muted">Je {number.format(row.basis_quantity)} {units[row.basis_unit]}{row.status !== 'verified' && ' · vorläufig'}</p>
    <dl className="ingredient-macros">{Object.entries(nutrients).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key] == null ? '–' : number.format(row[key])}</dd></div>)}</dl>
  </div>;
}

function PriceEditor({product, price, save}) {
  return <SaveForm label="Preis speichern" save={values => {
    const channel = values.get('channel');
    const retailer = String(values.get('retailer')).trim();
    if (!retailer) throw new Error('Missing retailer');
    return save('prices', {
      product_id: product.id, retailer, channel,
      observed_on: new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Berlin'}).format(new Date()),
      package_quantity: product.package_quantity, package_unit: product.package_unit,
      original_price: Number(values.get('price')), original_currency: 'EUR', eur_per_currency: 1,
      source_url: values.get('url') || null, source_note: manual,
      price_type: channel === 'estimate' ? 'estimate' : 'regular', status: 'provisional',
    }, price?.source_note === manual && !price.receipt_line_id ? price.id : undefined);
  }}>
    <div className="ingredient-fields">
      <label>Händler<input name="retailer" required defaultValue={price?.retailer}/></label>
      <label>Preisart<select name="channel" defaultValue={price?.channel ?? 'store'}><option value="store">Supermarkt</option><option value="online">Online</option><option value="estimate">Richtpreis</option></select></label>
      <label>EUR je {number.format(product.package_quantity)} {units[product.package_unit]}<input type="number" name="price" min="0.01" step="0.01" required defaultValue={price?.price_eur}/></label>
      <label>Quellenlink (optional)<input type="url" name="url" defaultValue={price?.source_url}/></label>
    </div>
  </SaveForm>;
}

function latestNutrition(rows, column, id) {
  return rows.filter(row => row[column] === id && row.status !== 'needs_review')
    .sort((a, b) => Number(b.source_note === manual) - Number(a.source_note === manual)
      || Number(b.status === 'verified') - Number(a.status === 'verified')
      || (b.observed_at ?? '').localeCompare(a.observed_at ?? ''))[0];
}

function IngredientPrices({products, observations, guide}) {
  const [limit, setLimit] = useState(pageSize);
  const byId = new Map(products.map(product => [product.id, product.name]));
  const prices = observations.filter(row => byId.has(row.product_id) && row.price_eur != null)
    .sort((a, b) => b.observed_on.localeCompare(a.observed_on) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  const rows = prices.slice(0, limit).map(row => ({
    ...row, product: byId.get(row.product_id),
    source: row.channel === 'estimate' ? 'Richtpreis' : row.retailer + (row.channel === 'online' ? ' · online' : ''),
    note: [row.observed_on, row.receipt_line_id ? 'Bon' : '', row.status === 'needs_review' ? 'Zu prüfen' : '',
      ({offer: 'Angebot', member: 'Mitgliedspreis', coupon: 'Coupon'})[row.price_type],
      row.valid_until ? 'bis ' + row.valid_until : ''].filter(Boolean).join(' · '),
  }));
  if (!prices.some(row => row.channel === 'estimate' && row.status !== 'needs_review')) rows.push({
    ...guide, id: 'guide', source: 'Richtpreis', note: 'Angenommene Menge',
  });
  return <>
    <table className="ingredient-price-table">
      <thead><tr><th scope="col">Quelle</th><th scope="col">Preis / Menge</th><th scope="col">Grundpreis</th></tr></thead>
      <tbody>{rows.map(row => {
        const unit = row.package_unit;
        const factor = unit === 'piece' ? 1 : 1000;
        return <tr key={row.id}>
          <th scope="row">{row.source}<small>{row.product}</small><small>{row.note}</small></th>
          <td><strong>{money(row.price_eur)}</strong><small>{number.format(row.package_quantity)} {units[unit]}</small></td>
          <td>{money(row.price_eur * factor / row.package_quantity)}<small>je {({g: 'kg', ml: 'l', piece: 'Stk.'})[unit]}</small></td>
        </tr>;
      })}</tbody>
    </table>
    {prices.length > limit && <button type="button" onClick={() => setLimit(limit + pageSize)}>Weitere laden ({limit} von {prices.length})</button>}
  </>;
}

function IngredientDetail({ingredient, catalog, save}) {
  const [editing, setEditing] = useState(false);
  const nutrition = latestNutrition(catalog.nutrition, 'ingredient_id', ingredient.id);
  const products = catalog.products.filter(product => product.ingredient_id === ingredient.id);
  const unit = ingredient.preferred_unit || 'g';
  const guide = priceFor({name: ingredient.name, category: ingredient.category, quantity: 1, unit}, '', {});
  return <section className="q-card ingredient-card">
    <header><h2>{ingredient.name}</h2><button type="button" aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? 'Bearbeitung schließen' : 'Bearbeiten'}</button></header>
    {editing && <SaveForm save={values => {
      const name = String(values.get('name')).trim();
      if (!name) throw new Error('Missing name');
      return save('ingredients', {name, category: values.get('category') || null}, ingredient.id);
    }}>
      <div className="ingredient-fields">
        <label>Name<input name="name" required defaultValue={ingredient.name}/></label>
        <label>Kategorie<select name="category" defaultValue={ingredient.category ?? ''}><option value="">Automatisch</option>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
      </div>
    </SaveForm>}
    <h3>Nährwerte</h3>
    {nutrition && <><h4>Allgemein</h4><Nutrition row={nutrition}/></>}
    {!nutrition && !products.some(product => latestNutrition(catalog.nutrition, 'product_id', product.id)) && <Nutrition/>}
    {products.map(product => {
      const row = latestNutrition(catalog.nutrition, 'product_id', product.id);
      return row && <div key={product.id}><h4>{product.name}</h4><Nutrition row={row}/></div>;
    })}
    {editing && <NutritionEditor key={nutrition?.id} row={nutrition} owner={{ingredient_id: ingredient.id}} unit={unit} save={save}/>}
    <h3>Produkte und Preise</h3>
    <IngredientPrices products={products} observations={catalog.prices} guide={guide}/>
    {editing && products.map(product => {
      const prices = catalog.prices.filter(price => price.product_id === product.id)
        .sort((a, b) => b.observed_on.localeCompare(a.observed_on) || b.created_at.localeCompare(a.created_at));
      const productNutrition = latestNutrition(catalog.nutrition, 'product_id', product.id);
      return <details key={product.id}>
        <summary>{product.name}{product.package_quantity ? ` · ${number.format(product.package_quantity)} ${units[product.package_unit]}` : ''}</summary>
        {editing && <details><summary>Produktnährwerte bearbeiten</summary><NutritionEditor key={productNutrition?.id} row={productNutrition} owner={{product_id: product.id}} unit={unit} save={save}/></details>}
        {!prices.length && <p className="ingredient-muted">Keine Preise hinterlegt</p>}
        <ul className="ingredient-prices">{prices.map(price => <li key={price.id}>
          <span>{price.retailer} · {({store: 'Supermarkt', online: 'Online', estimate: 'Richtpreis'})[price.channel]} · {price.observed_on}{price.receipt_line_id && ' · Bon'}</span>
          <strong>{price.price_eur == null ? '–' : money(price.price_eur)} / {number.format(price.package_quantity)} {units[price.package_unit]}</strong>
          {editing && product.package_quantity && <details><summary>{price.source_note === manual && !price.receipt_line_id ? 'Preis bearbeiten' : 'Neuen Preis erfassen'}</summary><PriceEditor product={product} price={price} save={save}/></details>}
        </li>)}</ul>
        {editing && (product.package_quantity ? <details><summary>Preis hinzufügen</summary><PriceEditor product={product} save={save}/></details> : <p className="ingredient-muted">Für neue Preise fehlt die Packungsgröße.</p>)}
      </details>;
    })}
  </section>;
}

export default function Ingredients({userId, onCatalogChange}) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(Object.entries(tables).map(async ([key, table]) => [key, await loadRows(table, userId, controller.signal)]))
      .then(entries => { if (!controller.signal.aborted) setCatalog({userId, ...Object.fromEntries(entries)}); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [userId, retry]);

  const current = catalog?.userId === userId ? catalog : null;
  const filtered = useMemo(() => {
    const search = normalize(query);
    return (current?.ingredients ?? []).filter(item =>
      normalize([item.name, ...(item.aliases ?? [])].join(' ')).includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [current, query]);

  async function save(key, fields, id) {
    const table = supabase.from(tables[key]);
    const write = id ? table.update(fields).eq('user_id', userId).eq('id', id) : table.insert({...fields, user_id: userId});
    const {data, error} = await write.select().single();
    if (error) throw error;
    setCatalog(previous => previous?.userId === userId ? {
      ...previous, [key]: [...previous[key].filter(row => row.id !== data.id), data],
    } : previous);
    onCatalogChange?.();
  }

  const ingredient = current?.ingredients.find(row => row.id === selected);
  return <section className="ingredients-page" aria-label="Zutatenverwaltung">
    {error && <p role="alert">Zutaten konnten nicht geladen werden. <button onClick={() => {setError(false); setRetry(retry + 1);}}>Erneut versuchen</button></p>}
    {!current && !error && <p role="status">Zutaten werden geladen …</p>}
    {current && (ingredient ? <>
      <button type="button" onClick={() => setSelected(null)}>Zur Zutatenliste</button>
      <IngredientDetail key={ingredient.id} ingredient={ingredient} catalog={current} save={save}/>
    </> : <>
      <label className="shop-search ingredient-search"><Icon name="search"/><input aria-label="Zutat suchen" placeholder="Zutat suchen" type="search" value={query} onChange={event => {setQuery(event.target.value); setLimit(pageSize);}}/></label>
      <p className="ingredient-muted" role="status">{Math.min(limit, filtered.length)} von {filtered.length} Zutaten</p>
      <ul className="ingredient-list">
        {filtered.slice(0, limit).map(item => {
          const row = latestNutrition(current.nutrition, 'ingredient_id', item.id);
          return <li key={item.id}><button type="button" onClick={() => setSelected(item.id)}>
            <strong>{item.name}</strong><span>{categoryFor(item.name, item.category)}{row?.calories_kcal != null && ` · ${number.format(row.calories_kcal)} kcal je ${number.format(row.basis_quantity)} ${units[row.basis_unit]}`}</span>
          </button></li>;
        })}
      </ul>
      {filtered.length > limit && <button type="button" onClick={() => setLimit(limit + pageSize)}>Weitere laden</button>}
    </>)}
  </section>;
}
