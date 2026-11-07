import { requireOwner } from '../lib/require-owner.js';
import { validBarcode } from '../lib/barcode.js';
import { normalizeProduct } from '../lib/products.js';

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!await requireOwner(req,res)) return;
  const barcode = String(req.query?.barcode || '').trim();
  if(barcode) {
    if(!validBarcode(barcode)) return res.status(400).json({error:'Ungültiger Barcode.'});
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,nutriments,serving_size,nutrition_data_per`,{headers:{'User-Agent':'NutritionApp/1.0 (https://github.com/philippthonemann/nutrition-app)'},signal:AbortSignal.timeout(12000)});
      if(response.status === 404) return res.status(200).json({products:[]});
      if(!response.ok) return res.status(502).json({error:'Produktdatenbank derzeit nicht verfügbar.'});
      const data = await response.json();const product=data.product && normalizeProduct(data.product);
      return res.status(200).json({products:product?[product]:[],source:'Open Food Facts'});
    } catch { return res.status(502).json({error:'Produktsuche hat nicht geantwortet.'}); }
  }
  const query = String(req.query?.q || '').trim();
  if (query.length < 3 || query.length > 120) return res.status(400).json({ error: 'Bitte Produktname, Marke und Sorte eingeben (3–120 Zeichen).' });
  try {
    const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    url.search = new URLSearchParams({ search_terms:query,search_simple:'1',action:'process',json:'1',page_size:'8',fields:'code,product_name,brands,nutriments,serving_size,nutrition_data_per' }).toString();
    const response = await fetch(url,{ headers: { 'User-Agent':'NutritionApp/1.0 (https://github.com/philippthonemann/nutrition-app)' },signal:AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error:'Produktdatenbank ist momentan nicht verfügbar. Bitte später erneut versuchen.' });
    const data = await response.json();
    return res.status(200).json({ products:(data.products || []).map(normalizeProduct).filter(Boolean).slice(0,5),source:'Open Food Facts' });
  } catch { return res.status(502).json({ error:'Die Produktsuche hat nicht geantwortet. Deine Schätzung bleibt verfügbar.' }); }
}
