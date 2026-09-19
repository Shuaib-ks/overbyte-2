const DAY_MS = 86400000;
const dayNumber = (timestamp) =>
  Math.floor(new Date(timestamp).getTime() / DAY_MS);

/** Small UTC-calendar-day weighted average. Today is partial, never extrapolated.
 * Empty observed days count as zero; days before tracking began do not count.
 * The service distinguishes a genuine zero-sales window from no history at all.
 */
export function weightedDailySales(
  sales,
  { now = Date.now(), startedAt = now, windowDays = 7 } = {},
) {
  const today = dayNumber(now);
  const days = Math.max(1, Math.min(7, Math.floor(windowDays) || 7));
  const firstTracked = dayNumber(startedAt);
  const first = Math.max(
    today - days + 1,
    Math.min(today, Number.isFinite(firstTracked) ? firstTracked : today),
  );
  const totals = new Map();
  for (const sale of sales) {
    const time = new Date(sale.createdAt).getTime();
    const day = dayNumber(time);
    const qty = Number(sale.qty);
    if (
      day < first ||
      day > today ||
      time > new Date(now).getTime() ||
      !Number.isFinite(qty) ||
      qty <= 0
    )
      continue;
    totals.set(day, (totals.get(day) || 0) + qty);
  }
  const dailyTotals = [];
  let weighted = 0,
    weightSum = 0;
  for (let day = first; day <= today; day++) {
    const weight = days - (today - day);
    const qty = Math.round((totals.get(day) || 0) * 100) / 100;
    weighted += qty * weight;
    weightSum += weight;
    dailyTotals.push({
      day: new Date(day * DAY_MS).toISOString().slice(0, 10),
      qty,
      weight,
    });
  }
  return {
    averageDailySales: Math.round((weighted / weightSum) * 100) / 100,
    observationDays: dailyTotals.length,
    windowDays: days,
    dailyTotals,
  };
}
