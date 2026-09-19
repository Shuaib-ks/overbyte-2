/* ============================================================
   OVERBYTE — Simulated intelligence layer
   Deterministic engines wired for a real ML backend later:
     Demand Prediction · Surplus Detection · Waste Risk ·
     Shortage Prediction · Price Recommendation · Marketplace Matching
   All functions are pure — they receive plain data, return plain data.
   ============================================================ */

import { clamp, seededRand, riskOf } from "./util.js";

/* perishability baseline (points added to waste risk by category) */
const PERISH_BASE = {
  "Meat & Poultry": 8, "Seafood": 9, "Dairy": 6, "Bakery": 7,
  "Produce": 5, "Fruits": 6, "Grocery": 2, "Frozen": 3, "Beverages": 4,
};

/**
 * WASTE RISK ENGINE
 * probability that remaining stock will not sell before expiry.
 */
export function wasteRisk({ stock, expectedDemand, shelfHours, category, seed = "x" }) {
  const coverage = expectedDemand / Math.max(stock, 0.001);       // fraction expected to sell
  const unsold = clamp(1 - coverage, 0, 1);
  const shelfNorm = clamp(shelfHours / 72, 0, 1);                 // shorter shelf → riskier
  const base = PERISH_BASE[category] ?? 5;
  const jitter = seededRand(seed)() * 6;
  const probability = clamp(Math.round(unsold ** 0.85 * 58 + (1 - shelfNorm) * 26 + base + jitter), 2, 96);
  const factors = [];
  if (coverage < 0.6) factors.push(`Expected demand is ${Math.round((1 - coverage) * 100)}% below the stock on hand for this window.`);
  else if (coverage < 0.85) factors.push(`Only ${Math.round(coverage * 100)}% of current stock is expected to sell before expiry.`);
  if (shelfHours <= 24) factors.push(`Only ${Math.round(shelfHours)} hours remain before estimated expiry.`);
  else if (shelfHours <= 48) factors.push(`Under 48 hours of shelf life remain.`);
  if (stock >= expectedDemand * 1.8) factors.push(`Inventory is ${(stock / expectedDemand).toFixed(1)}× higher than expected demand.`);
  if (!factors.length) factors.push("Historical sell-through for this window covers most of the current stock.");
  return { probability, risk: riskOf(probability), factors };
}

/**
 * SURPLUS DETECTION ENGINE — expected unsold quantity range.
 */
export function surplusEstimate({ stock, expectedDemand }) {
  const mid = Math.max(0, stock - expectedDemand);
  if (mid <= 0) return { mid: 0, low: 0, high: 0 };
  return { mid: Math.round(mid), low: Math.max(0, Math.round(mid * 0.85)), high: Math.round(mid * 1.15) };
}

/**
 * PRICE RECOMMENDATION ENGINE
 * Range based on remaining shelf life, local demand, market price and quantity.
 */
export function priceRecommendation({ market, shelfHours, wasteProb, qty, unit }) {
  const shelfNorm = clamp(shelfHours / 72, 0, 1);
  const urgency = 1 - wasteProb / 100;            // fresher/higher risk of not selling → cheaper
  const low = market * (0.60 + 0.24 * shelfNorm) * (0.94 + 0.10 * urgency) * (qty > 15 ? 0.97 : 1);
  const high = low * 1.22;
  const round = (v) => Math.max(1, Math.round(v / 5) * 5);
  return { low: round(low), high: round(high), basis: ["Remaining shelf life", "Local demand index", "Market price", "Quantity available", "Buyer distance"] };
}

/**
 * SHORTAGE PREDICTION ENGINE — items that will run out before demand is met.
 */
export function shortageOf({ stock, expectedDemand, seed = "s" }) {
  if (expectedDemand <= stock) return null;
  const gap = Math.round((expectedDemand - stock) * 10) / 10;
  const r = seededRand(seed)();
  const byHour = Math.round(18 + r * 16);         // 18–34h ahead
  const hourOfDay = 11 + Math.round(r * 6);       // 11:00–17:00-ish window
  return {
    qty: gap,
    byHour,
    byLabel: `Tomorrow ~${hourOfDay}:${r > 0.5 ? "30" : "15"} PM`.replace(":15 PM", ":15 PM"),
  };
}

/**
 * MARKETPLACE MATCHING ENGINE
 * Weighted compatibility between a buyer need and a surplus listing.
 */
export function matchScore(need, listing, distanceKm) {
  const parts = [];
  const sameProduct = need.product.toLowerCase() === listing.product.toLowerCase();
  const sameCategory = need.category === listing.category;
  parts.push({
    key: "demand", weight: 30,
    score: sameProduct ? 30 : sameCategory ? 19 : 6,
    ok: sameProduct || sameCategory,
    detail: sameProduct ? `You need ${need.label} — listing is ${listing.product}` : sameCategory ? `Same category (${listing.category})` : "Different category",
  });

  const qtyFit = clamp(Math.min(need.qty, listing.qty) / Math.max(need.qty, listing.qty), 0, 1);
  parts.push({
    key: "qty", weight: 20,
    score: 20 * qtyFit,
    ok: qtyFit >= 0.55,
    detail: qtyFit >= 1 ? `Listing covers your ${need.qty} ${need.unit} requirement` : `Listing has ${listing.qty} ${listing.unit} of your ${need.qty} ${need.unit} need`,});

  const prox = clamp(1 - distanceKm / 12, 0, 1);
  parts.push({
    key: "distance", weight: 20,
    score: 20 * prox,
    ok: distanceKm <= 6,
    detail: `${distanceKm.toFixed(1)} km away`,
  });

  const shelfFit = clamp(listing.shelfHours / Math.max(need.byHours || 12, 1), 0, 1);
  parts.push({
    key: "shelf", weight: 15,
    score: 15 * shelfFit,
    ok: shelfFit >= 0.8,
    detail: shelfFit >= 0.8 ? `Expires after your expected usage` : `Tight shelf life vs your usage window`,
  });

  const priceFit = clamp((need.normalCost - listing.price) / (need.normalCost || 1), 0, 1);
  parts.push({
    key: "price", weight: 10,
    score: 10 * (0.4 + 0.6 * priceFit),
    ok: priceFit > 0,
    detail: priceFit > 0 ? `Price is below your normal purchasing cost` : `At your usual cost`,
  });

  parts.push({ key: "pickup", weight: 5, score: 4.4, ok: true, detail: `Pickup window matches your schedule` });

  const raw = parts.reduce((a, p) => a + p.score, 0);
  const score = clamp(Math.round(raw), 5, 99);
  return {
    score,
    parts,
    reasons: parts.filter((p) => p.ok).map((p) => p.detail),
  };
}

/**
 * DEMAND PREDICTION ENGINE — 7-day forecast with weekday seasonality.
 */
export function demandForecast({ base, seed = "f", unit = "kg" }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const season = [0.86, 0.9, 0.95, 1.02, 1.24, 1.3, 1.05];
  const r = seededRand(seed);
  return days.map((d, i) => ({
    day: d,
    value: Math.round(base * season[i] * (0.92 + r() * 0.16)),
    unit,
  }));
}

/**
 * AI INSIGHTS ENGINE — narrative cards derived from data deltas.
 * (Simulated for prototype; deterministic so demos are stable.)
 */
export function buildInsights(biz) {
  const r = seededRand(biz.id + "ins");
  return (biz.insights || []).map((tpl) => ({
    ...tpl,
    confidence: 78 + Math.round(r() * 16),
  }));
}