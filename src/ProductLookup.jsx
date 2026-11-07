import { useEffect, useState } from 'react';
import { authFetch } from './authFetch';
import { applyProduct } from './scan.js';

export default function ProductLookup({ query, componentIndex, result, onApply }) {
  const [term,setTerm] = useState(query);
  const [products,setProducts] = useState([]);
  const [selected,setSelected] = useState(null);
  const [grams,setGrams] = useState(result.components[componentIndex]?.grams || 100);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setBusy(true);
    authFetch(`/api/products?q=${encodeURIComponent(query)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Suche fehlgeschlagen.');
      if (active) { setProducts(data.products || []); setMessage(data.products?.length ? '' : 'Kein passender Datensatz gefunden. Suche präzisieren oder Schätzung verwenden.'); }
    }).catch(error => { if(active) setMessage(error.message); }).finally(() => { if(active) setBusy(false); });
    return () => { active = false; };
  },[query]);
  async function search(event) {
    event.preventDefault(); setBusy(true); setSelected(null); setMessage('');
    try {
      const response = await authFetch(`/api/products?q=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Suche fehlgeschlagen.');
      setProducts(data.products || []);
      if (!data.products?.length) setMessage('Kein Treffer. Die ursprüngliche Schätzung bleibt verfügbar.');
    } catch(error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="q-product-lookup">
    <h3>Markenprodukt prüfen</h3><p>Für: {result.components[componentIndex]?.name}. Bestätige Marke und Sorte; Datenbankeinträge können veraltet sein.</p>
    <form onSubmit={search} className="q-product-search"><input aria-label="Produkt suchen" value={term} onChange={event => setTerm(event.target.value)} minLength={3} maxLength={120} required/><button disabled={busy}>Suchen</button></form>
    {busy && <p role="status">Produktdaten werden gesucht…</p>}
    {message && <p role="status">{message}</p>}
    {products.map(product => <button key={product.code} className="q-product-choice" aria-pressed={selected?.code === product.code} onClick={() => setSelected(product)}><strong>{product.name}</strong><span>{product.brand} · {product.per100g.calories} kcal / 100 g</span></button>)}
    {selected && <div className="q-product-portion"><a href={selected.url} target="_blank" rel="noreferrer">Quelle: Open Food Facts · {selected.code}</a><label>Gegessene Menge in Gramm<input type="number" min="1" max="10000" value={grams} onChange={event => setGrams(event.target.value)}/></label><button disabled={busy || !(Number(grams)>0 && Number(grams)<=10000)} onClick={() => onApply(applyProduct(result,componentIndex,selected,Number(grams)))}>Produktwerte übernehmen</button></div>}
  </section>;
}
