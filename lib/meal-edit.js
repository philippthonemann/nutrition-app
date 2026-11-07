export const nutrients = ['calories','protein','carbs','fat','fiber','sugar','sodium','caffeine','water','alcohol'];
const limits = {calories:15000,protein:2000,carbs:2000,fat:2000,fiber:2000,sugar:2000,sodium:100000,caffeine:10000,water:20000,alcohol:2000};

export function portionFactor(text) {
  const value = text.trim().toLowerCase().replace(/[.!]$/,'');
  if (/^(nur )?(die )?(halbe portion|hälfte|halb so viel|halbe menge)$/.test(value)) return .5;
  if (/^(die )?(doppelte portion|doppelte menge|doppelt so viel)$/.test(value)) return 2;
  return null;
}

export function mealEditPreview(meal, operation) {
  const patch = {name:meal.name,estimated:meal.estimated};
  if (operation.type === 'scale') {
    if (!Number.isFinite(operation.factor) || operation.factor <= 0 || operation.factor > 10) throw new Error('Bitte eine plausible Portionsgröße angeben.');
    for (const key of nutrients) patch[key] = Number(meal[key] || 0) * operation.factor;
    patch.edit_note = `Portion × ${operation.factor.toLocaleString('de-DE')}; vorhandene Werte proportional angepasst.`;
  } else if (operation.type === 'add') {
    if (!operation.note?.trim() || operation.note.length > 500) throw new Error('Keine verwertbare Ergänzung.');
    for (const key of nutrients) {
      const delta = operation.values?.[key];
      if (typeof delta !== 'number' || !Number.isFinite(delta) || delta < 0) throw new Error('Unplausible Nährwerte. Bitte genauer beschreiben.');
      patch[key] = Number(meal[key] || 0) + delta;
    }
    patch.name = `${meal.name} + ${String(operation.addition_name || 'Ergänzung').slice(0,80)}`.slice(0,240);
    patch.estimated = true;
    patch.edit_note = operation.note;
  } else throw new Error(operation.question || 'Bitte Portion oder zusätzliche Zutaten mit Menge beschreiben.');
  for (const key of nutrients) {
    if (!Number.isFinite(patch[key]) || patch[key]<0 || patch[key]>limits[key]) throw new Error('Die Änderung ergibt unplausible Werte.');
    patch[key] = key === 'calories' ? Math.round(patch[key]) : Math.round(patch[key]*10)/10;
  }
  return patch;
}
