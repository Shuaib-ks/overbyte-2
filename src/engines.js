/* Explainable, deterministic rules. No trained model or fabricated confidence. */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = n => Math.round(n * 100) / 100;
export function wasteRisk({ stock, expectedDemand, shelfHours }) {
  if (expectedDemand == null) return { probability: null, risk: 'unknown', factors: ['Enter daily demand or record consumption to enable a projection.'] };
  const probability = stock > 0 ? Math.round(clamp((stock - expectedDemand) / stock, 0, 1) * 100) : 0;
  return { probability, risk: probability >= 55 ? 'high' : probability >= 30 ? 'medium' : 'low',
    factors: [`${round(expectedDemand)} units projected to be consumed before this batch expires.`,
      `${round(Math.max(0, stock - expectedDemand))} units may remain unsold.`,
      `${round(Math.max(0, shelfHours))} hours remain. This is a projected unsold share, not a calibrated probability.`] };
}
export function surplusEstimate({ stock, expectedDemand }) {
  const mid = expectedDemand == null ? 0 : round(Math.max(0, stock - expectedDemand));
  return { mid, low: mid, high: mid };
}
export function priceRecommendation({ market, cost, shelfHours }) {
  const reference = Number(market || cost || 0);
  const factor = clamp(.55 + Math.max(0, shelfHours) / 240, .55, .9);
  return { low: round(reference * factor), high: round(reference * Math.min(1, factor + .15)),
    basis: [market ? 'Seller-entered reference price (not independently verified)' : 'Recorded purchase cost', 'Remaining shelf life', 'Rule-based markdown; seller controls final price'] };
}
export function shortageOf({ stock, expectedDemand }) {
  if (expectedDemand == null || expectedDemand <= stock) return null;
  const byHour = round(24 * stock / expectedDemand);
  return { qty: round(expectedDemand - stock), byHour, byLabel: `In approximately ${byHour} hours` };
}
export function matchScore(need, listing, distanceKm) {
  const parts = [];
  if (need && need.qty > 0 && need.unit === listing.unit) {
    const same = need.product.toLowerCase() === listing.product.toLowerCase();
    parts.push({ key:'demand', weight:40, score:same ? 40 : 0, ok:same, detail:same ? `Matches your recorded need for ${need.product}` : 'Does not match your projected shortage' });
    const fit = Math.min(need.qty, listing.qty) / Math.max(need.qty, listing.qty);
    parts.push({ key:'qty',weight:25,score:25*fit,ok:listing.qty>=need.qty,detail:`${listing.qty} ${listing.unit} available against your ${need.qty} ${need.unit} projected shortage` });
    const fitShelf = listing.shelfHours >= (need.byHours || 24);
    parts.push({key:'shelf',weight:20,score:fitShelf?20:Math.max(0,20*listing.shelfHours/(need.byHours||24)),ok:fitShelf,detail:fitShelf?'Shelf life covers your projected usage window':'Confirm you can use this before expiry'});
    if (need.normalCost > 0) parts.push({key:'price',weight:15,score:15*clamp(need.normalCost/listing.price/1.25,0,1),ok:listing.price<need.normalCost,detail:listing.price<need.normalCost?'Below your recorded purchase cost':'At or above your recorded purchase cost'});
  }
  if (Number.isFinite(distanceKm)) parts.push({key:'distance',weight:20,score:20*clamp(1-distanceKm/50,0,1),ok:distanceKm<=10,detail:`${round(distanceKm)} km straight-line distance; travel time not estimated`});
  const total=parts.reduce((n,p)=>n+p.weight,0);
  return {score:need && total ? Math.round(100*parts.reduce((n,p)=>n+p.score,0)/total):null,parts,
    reasons:parts.filter(p=>p.ok).map(p=>p.detail),method:'Rule-based compatibility using available inputs; pickup must be confirmed.'};
}
export function demandForecast({ base, unit='kg' }) {
  return Array.from({length:7},(_,i)=>({ day:new Date(Date.now()+i*86400000).toLocaleDateString('en-IN',{weekday:'short'}),value:round(Math.max(0,Number(base)||0)),unit }));
}
export function buildInsights(biz) { return biz?.insights || []; }