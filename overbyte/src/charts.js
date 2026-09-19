/* ============================================================
   OVERBYTE — SVG chart library (no dependencies)
   ringGauge · lineChart · barChart · sparkline · donut ·
   depletionChart · flowNetwork
   ============================================================ */

import { fmtINR, fmtNum } from "./util.js";

let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const s = document.createElement("style");
  s.id = "ob-chart-css";
  s.textContent = `
    .ch-line { animation: chDraw 1.3s cubic-bezier(.4,0,.2,1) forwards; }
    @keyframes chDraw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
    .ch-area { opacity: 0; animation: chFade .9s .35s ease forwards; }
    @keyframes chFade { to { opacity: 1; } }
    .ch-bar { transform-box: fill-box; transform-origin: bottom; animation: chRise .7s cubic-bezier(.22,1,.36,1) both; }
    @keyframes chRise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .ch-dot { opacity: 0; animation: chFade .4s .8s ease forwards; }
    .ch-txt { font-family: var(--font-mono); font-size: 10px; fill: #667083; }
    .ch-txt.strong { fill: #a2abbd; font-weight: 600; }
    .ch-flow { stroke-dasharray: 6 8; animation: chFlow 1.4s linear infinite; }
    @keyframes chFlow { to { stroke-dashoffset: -14; } }
    .ch-node-pulse { animation: chPulse 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes chPulse { 0% { opacity: .55; transform: scale(1); } 70%,100% { opacity: 0; transform: scale(1.9); } }
  `;
  document.head.appendChild(s);
}

let uidc = 0;

/* ---------------- Ring gauge ---------------- */
export function ringGauge({ value, size = 148, stroke = 11, color = "#8577ff", track = "rgba(255,255,255,.07)", label = "", sub = "", showValue = true, fs = 30 }) {
  ensureStyle();
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const id = `rg${++uidc}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label || "gauge"} ${Math.round(v)}%">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.65"/>
    </linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"
      style="animation: rgIn 1.2s cubic-bezier(.22,1,.36,1) forwards">
      <animate attributeName="stroke-dashoffset" from="${c}" to="${(c * (100 - v)) / 100}" dur="1.2s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
    </circle>
    <style>@keyframes rgIn { to { stroke-dashoffset: ${(c * (100 - v)) / 100}; } }</style>
    ${showValue ? `<text x="50%" y="${sub ? "48%" : "52%"}" text-anchor="middle" dominant-baseline="central"
      style="font-family:var(--font-mono);font-size:${fs}px;font-weight:640;letter-spacing:-0.03em;fill:#eef1f7">${Math.round(v)}%</text>` : ""}
    ${sub ? `<text x="50%" y="63%" text-anchor="middle" style="font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;fill:#667083;font-weight:600">${sub}</text>` : ""}
  </svg>`;
}

/* ---------------- Multi-series line/area chart ---------------- */
/**
 * series: [{ name, color, points:[{x label, y}], area?, dashed?, width? }]
 */
export function lineChart({ series, height = 220, yFmt = (v) => fmtNum(v), xTickEvery = 4, xUnit = "", minZero = true }) {
  ensureStyle();
  const W = 720, H = height, pl = 52, pr = 18, pt = 16, pb = 30;
  const all = series.flatMap((s) => s.points);
  const ys = all.map((p) => p.y);
  let max = Math.max(...ys), min = minZero ? 0 : Math.min(...ys);
  max = max === min ? max + 1 : max;
  const span = max - min;
  max += span * 0.08; if (minZero && min === 0) min = 0;
  const n = Math.max(...series.map((s) => s.points.length));
  const X = (i) => pl + (i / (n - 1)) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);

  let grid = "", yLabels = "";
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = min + ((max - min) * t) / ticks;
    const y = Y(v);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    yLabels += `<text x="${pl - 10}" y="${y + 3}" text-anchor="end" class="ch-txt">${yFmt(v)}</text>`;
  }
  let xLabels = "";
  const labels = series[0].points.map((p) => p.x);
  for (let i = 0; i < n; i += xTickEvery) {
    xLabels += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="ch-txt">${labels[i]}${xUnit}</text>`;
  }

  let defs = "", body = "";
  series.forEach((s, si) => {
    const id = `lc${++uidc}`;
    const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(" ");
    if (s.area) {
      defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity="0.28"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
      body += `<path class="ch-area" d="${d} L${X(s.points.length - 1).toFixed(1)} ${Y(min)} L${X(0)} ${Y(min)} Z" fill="url(#${id})"/>`;
    }
    body += `<path class="ch-line" d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.2}"
      ${s.dashed ? 'stroke-dasharray="1" pathLength="1" style="stroke-dasharray:5 5!important"' : `pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"`}
      stroke-linecap="round" stroke-linejoin="round"/>`;
    if (s.dashed) { /* dashed uses CSS pattern, not draw animation */ }
    if (s.points !== undefined && s.markers !== false && s.points.length <= 16) {
      body += s.points.map((p, i) =>
        `<circle class="ch-dot" cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${s.color}" stroke="#0e1016" stroke-width="1.5"><title>${s.name}: ${p.y}</title></circle>`).join("");
    }
    // last value flag
    const lp = s.points[s.points.length - 1];
    body += `<circle cx="${X(s.points.length - 1).toFixed(1)}" cy="${Y(lp.y).toFixed(1)}" r="4" fill="${s.color}"/>
      <text x="${X(s.points.length - 1).toFixed(1)}" y="${Y(lp.y).toFixed(1) - 10}" text-anchor="middle"
        style="font-family:var(--font-mono);font-size:10.5px;font-weight:600;fill:${s.color}">${yFmt(lp.y)}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img">
    <defs>${defs}</defs>${grid}${yLabels}${body}${xLabels}</svg>`;
}

/* ---------------- Grouped bar chart ---------------- */
export function barChart({ data, height = 220, yFmt = (v) => fmtNum(v), seriesNames = [], colors = ["#8577ff", "#22d3ee"] }) {
  ensureStyle();
  const W = 720, H = height, pl = 52, pr = 14, pt = 14, pb = 30;
  const max = Math.max(...data.flatMap((d) => d.values)) * 1.1 || 1;
  const Y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const groupW = (W - pl - pr) / data.length;
  let grid = "", yLabels = "";
  for (let t = 0; t <= 4; t++) {
    const v = (max * t) / 4, y = Y(v);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="rgba(255,255,255,.05)"/>`;
    yLabels += `<text x="${pl - 10}" y="${y + 3}" text-anchor="end" class="ch-txt">${yFmt(v)}</text>`;
  }
  let bars = "";
  data.forEach((d, gi) => {
    const gw = groupW * 0.56;
    const x0 = pl + gi * groupW + (groupW - gw) / 2;
    const bw = gw / d.values.length;
    d.values.forEach((v, vi) => {
      const x = x0 + vi * bw + bw * 0.12, w = bw * 0.76;
      const y = Y(v), h = H - pb - y;
      bars += `<rect class="ch-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}"
        rx="3" fill="${colors[vi % colors.length]}" opacity="${vi ? 0.85 : 1}" style="animation-delay:${gi * 60 + vi * 30}ms"><title>${d.label} · ${seriesNames[vi] || ""}: ${v}</title></rect>`;
    });
    bars += `<text x="${pl + gi * groupW + groupW / 2}" y="${H - 8}" text-anchor="middle" class="ch-txt">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${grid}${yLabels}${bars}</svg>`;
}

/* ---------------- Sparkline ---------------- */
export function sparkline(points, color = "#8577ff", w = 92, h = 30, area = true) {
  ensureStyle();
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const X = (i) => (i / (points.length - 1)) * (w - 2) + 1;
  const Y = (v) => h - 3 - ((v - min) / span) * (h - 8);
  const d = points.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const id = `sp${++uidc}`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".35"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${area ? `<path d="${d} L${X(points.length - 1)} ${h} L0 ${h} Z" fill="url(#${id})"/>` : ""}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------------- Donut ---------------- */
export function donut(slices, size = 130, thickness = 14, centerLabel = "", centerSub = "") {
  ensureStyle();
  const r = (size - thickness) / 2 - 4, c = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let off = c * 0.25; // start at top
  let segs = "";
  slices.forEach((s) => {
    const len = (s.value / total) * c;
    segs += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
      stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${off}" stroke-linecap="butt"><title>${s.label}: ${s.value}</title></circle>`;
    off -= len;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${segs}
    <text x="50%" y="${centerSub ? "47%" : "50%"}" text-anchor="middle" dominant-baseline="central"
      style="font-family:var(--font-mono);font-size:16px;font-weight:640;fill:#eef1f7;letter-spacing:-.03em">${centerLabel}</text>
    ${centerSub ? `<text x="50%" y="62%" text-anchor="middle" style="font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;fill:#667083;font-weight:600">${centerSub}</text>` : ""}
  </svg>`;
}

/* ---------------- Inventory depletion / surplus chart ---------------- */
/**
 * Shows projected inventory vs cumulative expected demand, with expiry
 * marker and shaded predicted-surplus zone.
 */
export function depletionChart({ stock, demandTotal, hours = 48, expiryH, color = "#8577ff", demandColor = "#22d3ee" }) {
  ensureStyle();
  const W = 720, H = 260, pl = 52, pr = 20, pt = 18, pb = 32;
  // consumption rate curve: meal-time bumps (hours 7-10, 12-15, 19-22 heavier)
  const rate = (h) => {
    const meal = (c, w) => Math.exp(-((h - c) ** 2) / (2 * w * w));
    return 0.35 + 1.5 * meal(8.5, 1.6) + 1.9 * meal(13, 1.8) + 1.6 * meal(20, 2.0);
  };
  const norm = demandTotal / hours; // avg rate needed to hit demandTotal
  let s = stock, cum = 0;
  const stockPts = [], demandPts = [];
  const step = hours / 48;
  for (let h = 0; h <= hours; h += step) {
    stockPts.push({ h, v: s });
    demandPts.push({ h, v: Math.min(cum, stock) });
    const used = Math.min(s, rate(h) * norm * step * 1.18);
    s = Math.max(0, s - used);
    cum += rate(h) * norm * step * 1.18;
  }
  const maxY = Math.max(stock, demandTotal) * 1.12;
  const X = (h) => pl + (h / hours) * (W - pl - pr);
  const Y = (v) => pt + (1 - v / maxY) * (H - pt - pb);
  const dStock = stockPts.map((p, i) => `${i ? "L" : "M"}${X(p.h).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const dDemand = demandPts.map((p, i) => `${i ? "L" : "M"}${X(p.h).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  // surplus zone: between curves up to expiry
  const zonePts = [...stockPts.filter((p) => p.h <= expiryH), ...demandPts.filter((p) => p.h <= expiryH).reverse()];
  const dZone = zonePts.map((p, i) => `${i ? "L" : "M"}${X(p.h).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ") + " Z";

  let grid = "", yLabels = "";
  for (let t = 0; t <= 4; t++) {
    const v = (maxY * t) / 4, y = Y(v);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="rgba(255,255,255,.05)"/>`;
    yLabels += `<text x="${pl - 10}" y="${y + 3}" text-anchor="end" class="ch-txt">${fmtNum(v, v < 10 && v % 1 ? 1 : 0)} kg</text>`;
  }
  let xLabels = "";
  for (let h = 0; h <= hours; h += hours / 8) {
    xLabels += `<text x="${X(h)}" y="${H - 8}" text-anchor="middle" class="ch-txt">${h >= 24 ? `${Math.round(h / 24)}d` : `${Math.round(h)}h`}</text>`;
  }
  const ex = X(expiryH);
  const id = `dp${++uidc}`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}${yLabels}
    <path d="${dStock} L${X(hours)} ${Y(0)} L${X(0)} ${Y(0)} Z" fill="url(#${id})" class="ch-area"/>
    <path d="${dZone}" fill="rgba(133,119,255,.10)" stroke="none" class="ch-area"/>
    <path class="ch-line" d="${dDemand}" fill="none" stroke="${demandColor}" stroke-width="1.8" stroke-dasharray="5 5" opacity=".9"/>
    <path class="ch-line" d="${dStock}" fill="none" stroke="${color}" stroke-width="2.4" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" stroke-linecap="round"/>
    <line x1="${ex}" y1="${pt}" x2="${ex}" y2="${H - pb}" stroke="#f0564a" stroke-width="1.4" stroke-dasharray="4 4" opacity=".8"/>
    <text x="${ex}" y="${pt + 2}" dy="-4" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;font-weight:600;fill:#f0564a">EXPIRY</text>
    <circle class="ch-dot" cx="${X(0)}" cy="${Y(stock)}" r="3.5" fill="${color}"/>
    ${xLabels}
  </svg>`;
}

/* ---------------- Landing network flow ---------------- */
export function flowNetwork() {
  ensureStyle();
  const W = 960, H = 420;
  const node = (x, y, label, sub, color) => `
    <g transform="translate(${x} ${y})">
      <circle class="ch-node-pulse" r="30" fill="none" stroke="${color}" stroke-width="1.5"/>
      <circle r="26" fill="#0e1016" stroke="${color}" stroke-width="1.5"/>
      <circle r="5" fill="${color}"/>
      <text y="46" text-anchor="middle" style="font-size:12.5px;font-weight:600;fill:#eef1f7">${label}</text>
      <text y="62" text-anchor="middle" style="font-size:10px;fill:#667083">${sub}</text>
    </g>`;
  const link = (x1, y1, x2, y2, color, dur) => `
    <line class="ch-flow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.8" opacity=".8">
      <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="${dur}s" repeatCount="indefinite"/>
    </line>
    <circle r="2.5" fill="${color}"><animateMotion dur="${dur}s" repeatCount="indefinite" path="M${x1} ${y1} L${x2} ${y2}"/></circle>`;
  return `<div class="net-canvas"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="OverByte surplus matching network">
    <defs>
      <radialGradient id="fnGlow" cx="50%" cy="42%" r="55%">
        <stop offset="0%" stop-color="rgba(133,119,255,.14)"/><stop offset="100%" stop-color="rgba(133,119,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fnGlow)"/>
    <text x="${W / 2}" y="205" text-anchor="middle" style="font-family:var(--font-mono);font-size:12px;letter-spacing:.28em;fill:#8577ff;font-weight:600">OVERBYTE AI</text>
    <text x="${W / 2}" y="226" text-anchor="middle" style="font-size:11px;fill:#667083">detects surplus · matches demand</text>
    <g>
      ${link(210, 120, 385, 165, "#8577ff", 1.6)}
      ${link(210, 300, 385, 260, "#22d3ee", 2.1)}
      ${link(575, 165, 750, 120, "#34d399", 1.9)}
      ${link(575, 260, 750, 300, "#f5a524", 1.5)}
    </g>
    ${node(165, 120, "GreenFork Kitchen", "SURPLUS · 12 kg chicken", "#8577ff")}
    ${node(165, 300, "Urban Crumb Bakery", "SURPLUS · 40 croissants", "#22d3ee")}
    ${node(795, 120, "Harvest Table", "NEED · 12 kg chicken", "#34d399")}
    ${node(795, 300, "Daily Grind Café", "NEED · 18 croissants", "#f5a524")}
    <g transform="translate(${W / 2} ${H / 2 + 24})">
      <circle r="34" fill="#0e1016" stroke="rgba(133,119,255,.5)" stroke-width="1.5"/>
      <circle class="ch-node-pulse" r="34" fill="none" stroke="#8577ff" stroke-width="1.5"/>
      <text text-anchor="middle" dominant-baseline="central" style="font-family:var(--font-mono);font-size:13px;font-weight:640;fill:#cdc9ff">AI</text>
    </g>
  </svg></div>`;
}
