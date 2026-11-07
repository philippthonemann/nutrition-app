export function goalOnDate(date, history, fallback) {
  const ordered = history.filter(item => Number(item.calories) > 0).slice().sort((a,b) => a.created_at.localeCompare(b.created_at));
  const previous = ordered.filter(item => item.day <= date);
  return Number(previous.at(-1)?.calories || ordered[0]?.calories || fallback || 2600);
}

export function trackingStatus(calories, hasMeals, record, goal) {
  if (record?.completion === 'complete') return 'complete';
  if (record?.completion === 'incomplete') return 'incomplete';
  if (!hasMeals) return 'empty';
  const target = Number(record?.calorie_goal || goal);
  return target > 0 && calories >= target * 2 / 3 ? 'complete' : 'incomplete';
}

export function summarizeDays(meals, records, history, fallback) {
  const days = {};
  for (const meal of meals) {
    const day = days[meal.date] ||= { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    day.count++;
    for (const key of ['calories','protein','carbs','fat']) day[key] += Number(meal[key]) || 0;
  }
  for (const record of records) if (record.completion === 'complete' && !days[record.date]) days[record.date] = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
  for (const [date, day] of Object.entries(days)) {
    const record = records.find(item => item.date === date);
    day.goal = Number(record?.calorie_goal || goalOnDate(date, history, fallback));
    day.status = trackingStatus(day.calories, day.count > 0, record, day.goal);
  }
  return days;
}

export function completeAverages(days) {
  const complete = Object.values(days).filter(day => day.status === 'complete');
  return { count: complete.length, ...Object.fromEntries(['calories','protein','carbs','fat'].map(key => [key, complete.length ? Math.round(complete.reduce((sum,day) => sum + day[key],0) / complete.length) : null])) };
}
