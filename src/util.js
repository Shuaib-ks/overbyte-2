/* ============================================================
   OVERBYTE — Shared utilities
   ============================================================ */

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function fmtINR(n, opts = {}) {
  const rounded = Math.round(n);
  if (opts.compact) {
    if (Math.abs(rounded) >= 1e7) return `₹${(rounded / 1e7).toFixed(2)}Cr`;
    if (Math.abs(rounded) >= 1e5) return `₹${(rounded / 1e5).toFixed(2)}L`;
    if (Math.abs(rounded) >= 1000) return `₹${(rounded / 1000).toFixed(1)}K`;
  }
  return "₹" + rounded.toLocaleString("en-IN");
}

export const fmtNum = (n, d = 0) =>
  Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtQty = (qty, unit) => `${fmtNum(qty, qty % 1 ? 1 : 0)} ${unit}`;

/** Hours → human readable "~18h" / "1d 6h" / "45d" */
export function fmtShelf(hours) {
  if (hours >= 24 * 20) return `${Math.round(hours / 24)}d`;
  if (hours >= 24) {
    const d = Math.floor(hours / 24), h = Math.round(hours % 24);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  return `~${Math.max(1, Math.round(hours))}h`;
}

/** Compact relative label for timestamps stored as minutes-ago */
export function agoFromMins(mins) {
  if (mins < 1) return "now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/** Deterministic pseudo-random from string seed (stable across renders) */
export function seededRand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export function riskOf(p) { return p >= 55 ? "high" : p >= 30 ? "medium" : "low"; }

export const RISK_META = {
  high: { label: "High risk", badge: "badge-high", color: "#f0564a" },
  medium: { label: "Medium risk", badge: "badge-medium", color: "#f5a524" },
  low: { label: "Low risk", badge: "badge-low", color: "#34d399" },
};
