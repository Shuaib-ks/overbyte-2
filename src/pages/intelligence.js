/* Real inventory projections and rule-based insights. */
import { icon, foodArt } from "../icons.js";
import { barChart, sparkline } from "../charts.js";
import { fmtINR, fmtNum as formatNumber, esc, RISK_META } from "../util.js";
import { selectors, store } from "../store.js";
import { pageHead, aiHeader, emptyState, statusBadge } from "../ui.js";

const tones = { violet: ["var(--primary-dim)", "var(--primary-strong)", "sparkles"], teal: ["var(--accent-dim)", "var(--accent)", "wallet"], green: ["var(--success-dim)", "var(--success)", "trending"] };
const fmtNum = (value, decimals) => formatNumber(value, decimals ?? (Number.isInteger(Number(value)) ? 0 : 2));
const dailyRate = item => Number(item.effectiveDailyDemand ?? item.dailyDemand ?? (item.shelfHours > 0 ? item.demand * 24 / item.shelfHours : 0));
const daySeries = item => Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return { label: date.toLocaleDateString("en-IN", { weekday: "short" }), values: [Math.round(dailyRate(item) * 100) / 100] }; });

function insightCard(insight) {
  const [background, foreground, glyph] = tones[insight.tone] || tones.violet;
  return `<div class="card insight-card card-hover"><div class="ic-kind" style="color:${foreground}"><span class="badge" style="background:${background};color:${foreground}">${icon(glyph, 11)}${esc(insight.kind)}</span></div>
    <h3>${esc(insight.title)}</h3><p class="ic-body">${esc(insight.body)}</p><div class="ic-stats">${(insight.stats || []).map(([label, value]) => `<div class="ic-stat"><div class="v">${esc(value)}</div><div class="k">${esc(label)}</div></div>`).join("")}</div>
    <div class="ic-action"><div>${insight.impact ? `<div class="t-sm" style="color:var(--success);font-weight:580">${esc(insight.impact)}</div>` : `<div class="t-xs muted">Based on your current inventory and business activity</div>`}</div></div></div>`;
}

export function insights() {
  const s = store.get();
  const insights = Array.isArray(s.insights) ? s.insights : s.insights?.[s.bizId] || [];
  return `${pageHead("AI Insights", "Actionable explanations based on your inventory, demand and actual transactions", `<span class="ai-chip">${icon("sparkles", 10)}RULE-BASED INSIGHTS</span>`)}
    <div class="row gap-10" style="margin-bottom:18px">${aiHeader("BUSINESS INSIGHTS")}<span class="t-sm muted">· refreshed with your business data</span></div>
    ${insights.length ? `<div class="page-grid stagger" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))">${insights.map(insightCard).join("")}</div>` : emptyState({ icon: "sparkles", title: "Your insights start with your data", sub: "Add inventory and expected daily use, record consumption, or complete marketplace orders to see useful patterns and opportunities.", action: `<a class="btn btn-primary" href="#/app/inventory">Go to inventory</a>` })}`;
}

export function predictions() {
  const inventory = selectors.enrichedInventory(store.get());
  const sorted = [...inventory].sort((a, b) => (b.risk?.probability ?? -1) - (a.risk?.probability ?? -1));
  const featured = sorted.find(item => item.forecastAvailable && item.shelfHours > 0);
  return `${pageHead("Predictions", "Demand, surplus and supply gaps calculated from your business data", `<span class="ai-chip">${icon("sparkles", 10)}EXPLAINABLE FORECASTS</span>`)}
    ${!sorted.length ? emptyState({ icon: "trending", title: "No predictions yet", sub: "Add inventory and expected daily use, or record consumption, to enable forecasting.", action: `<a class="btn btn-primary" href="#/app/inventory">Add inventory</a>` }) : `
    <div class="tbl-wrap" style="margin-bottom:24px"><table class="tbl"><thead><tr><th>Product</th><th>Daily demand</th><th class="td-right">Stock</th><th class="td-right">Projected surplus</th><th class="td-right">Shortage</th><th>Risk score</th><th>Recommendation</th></tr></thead><tbody>
      ${sorted.map(item => `<tr><td><div class="prod"><span class="p-art">${foodArt(item.product)}</span><div><a class="p-name" href="#/app/inventory/${encodeURIComponent(item.id)}">${esc(item.product)}</a><div class="p-sub">${esc(item.category)} · ${item.forecastAvailable ? item.demandSource === "planned" ? "Planned demand" : "Recorded consumption" : "No demand data"}</div></div></div></td>
        <td>${item.forecastAvailable ? `<div class="row gap-10">${sparkline(daySeries(item).map(day => day.values[0]), "#22d3ee", 84, 26)}<span class="num" style="font-size:12px;color:var(--text-muted)">${fmtNum(dailyRate(item), 2)} ${esc(item.unit)}/day</span></div>` : `<span class="t-xs muted">Needs demand data</span>`}</td>
        <td class="td-right num">${fmtNum(item.qty)} ${esc(item.unit)}</td>
        <td class="td-right num" style="color:var(--primary-strong)">${item.forecastAvailable && item.shelfHours > 0 ? `${fmtNum(item.surplus.mid)} ${esc(item.unit)}<div class="t-xs muted">${fmtINR(item.surplus.mid * item.cost)} at cost</div>` : "—"}</td>
        <td class="td-right num" style="color:var(--info)">${item.shortage ? `${fmtNum(item.shortage.qty)} ${esc(item.unit)}` : "—"}</td>
        <td>${item.risk.probability != null ? `<div class="num" style="font-size:12.5px">${item.risk.probability}/100</div><div class="risk-meter"><i style="width:${item.risk.probability}%;background:${(RISK_META[item.risk.risk] || RISK_META.low).color}"></i></div>` : "—"}</td>
        <td>${item.shelfHours <= 0 ? statusBadge("Expired") : !item.forecastAvailable ? `<a class="btn btn-secondary btn-sm" href="#/app/inventory/${encodeURIComponent(item.id)}">Set demand</a>` : item.shortage ? `<a class="btn btn-secondary btn-sm" href="#/app/surplus?need=${encodeURIComponent(item.product)}">Find Surplus</a>` : item.surplus.mid > 0 && (item.availableToList ?? item.qty) > 0 && store.get().settings.listingSuggestions !== false ? `<a class="btn btn-primary btn-sm" href="#/app/surplus/new?item=${encodeURIComponent(item.id)}">Review Listing</a>` : `<span class="t-xs muted">Monitor stock</span>`}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="dash-grid"><div class="span-7 card chart-card"><div class="ch-head"><div><div class="card-title">Demand outlook${featured ? ` — ${esc(featured.product)}` : ""}</div><div class="t-xs muted" style="margin-top:3px">7-day constant-rate projection for your business</div></div><span class="ai-chip">${icon("sparkles", 10)}FORECAST</span></div>
      ${featured ? barChart({ height: 200, colors: ["#8577ff"], seriesNames: [`Demand (${esc(featured.unit)})`], data: daySeries(featured) }) : emptyState({ icon: "trending", title: "Awaiting demand data", sub: "Enter expected daily use or record consumption for an active batch." })}
      ${featured ? `<p class="t-xs muted" style="margin-top:10px">${fmtNum(dailyRate(featured), 2)} ${esc(featured.unit)}/day from ${featured.demandSource === "planned" ? "your expected-use setting" : "recorded consumption"}. Surplus is calculated against the batch’s actual expiry.</p>` : ""}</div>
    <div class="span-5 card ai-panel" style="padding:20px"><div class="row-between">${aiHeader("HOW FORECASTS WORK")}</div><div class="col gap-10" style="margin-top:14px">
      ${[["Demand basis", "Uses the daily demand you enter, or learns an average from recorded consumption."], ["Stock and reservations", "Tracks physical inventory and quantities committed to marketplace listings."], ["Time to expiry", "Projects how much can be used before each batch’s expiry."], ["Surplus and shortage", "Compares available inventory with projected use to identify a gap."]].map(([title, body]) => `<div class="row gap-10"><span style="width:30px;height:30px;border-radius:8px;background:var(--primary-dim);color:var(--primary-strong);display:flex;align-items:center;justify-content:center;flex:none">${icon("cpu", 14)}</span><div><div class="t-sm" style="font-weight:580">${title}</div><div class="t-xs muted">${body}</div></div></div>`).join("")}
    </div><div class="t-xs muted" style="margin-top:14px;line-height:1.6;border-top:1px solid var(--border);padding-top:12px">${icon("info", 12)} These are rule-based estimates, not trained machine-learning predictions. Forecasts improve with accurate inventory and consumption records. No sales history, seasonal adjustment or accuracy score is invented.</div></div></div>`}`;
}
export function init() {}
