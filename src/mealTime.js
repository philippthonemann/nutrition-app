export function mealTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) throw new Error('Ungültige Mahlzeitenzeit.');
  return date.toISOString();
}

export function fastingHours(lastMealTime, now) {
  const timestamp = new Date(lastMealTime).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime() ? (now.getTime() - timestamp)/3600000 : null;
}
