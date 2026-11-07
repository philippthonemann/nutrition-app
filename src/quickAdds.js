export function quickRecipes(recipes, history, pinnedIds) {
  const normalize = name => String(name || '').trim().toLocaleLowerCase('de-DE');
  const byName = new Map(recipes.map(recipe => [normalize(recipe.name), recipe]));
  const byId = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const result = [];
  for (const recipe of [...pinnedIds.map(id => byId.get(id)), ...history.map(meal => byName.get(normalize(meal.name)))]) {
    if (recipe && !result.some(item => item.id === recipe.id)) result.push(recipe);
    if (result.length === 5) break;
  }
  return result;
}

export function readPinned(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(0, 5) : [];
  } catch { return []; }
}
