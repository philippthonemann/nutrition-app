export function normalizeProduct(product) {
  const n = product.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : undefined);
  const values = { calories: kcal, protein: n.proteins_100g, carbs: n.carbohydrates_100g, fat: n.fat_100g };
  if (!product.code || !product.product_name || Object.values(values).some(value => value == null || !Number.isFinite(Number(value)) || Number(value) < 0)) return null;
  if (Number(values.calories) > 1000 || ['protein','carbs','fat'].some(key => Number(values[key]) > 100)) return null;
  return { code: String(product.code), name: product.product_name, brand: product.brands || '',
    per100g: Object.fromEntries(Object.entries(values).map(([key,value]) => [key,Number(value)])),
    serving: product.serving_size || '',
    url: `https://world.openfoodfacts.org/product/${encodeURIComponent(product.code)}`,
    source: 'Open Food Facts',
  };
}
