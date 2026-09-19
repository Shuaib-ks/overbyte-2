/* Actual inventory and transaction analytics; new accounts start empty. */
import { lineChart, barChart, donut } from "../charts.js";
import { fmtINR, fmtNum as formatNumber, esc } from "../util.js";
import { store, selectors } from "../store.js";
import { pageHead, metricCard, emptyState } from "../ui.js";
const fmtNum = (value, decimals) => formatNumber(value, decimals ?? (Number.isInteger(Number(value)) ? 0 : 2));

function horizontalBars(rows, color) {
  if (!rows.length) return `<p class="t-sm muted" style="padding:20px 0;line-height:1.6">No recorded activity in this period.</p>`;
  const max = Math.max(1, ...rows.map(row => row[1]));
  return rows.map(([label, count]) => `<div class="hbar-row"><span class="hb-label truncate">${esc(label)}</span><span class="hb-track"><i style="width:${Math.round(count / max * 100)}%;background:${color}"></i></span><span class="hb-val">${fmtNum(count)}</span></div>`).join("");
}
const money = value => fmtINR(value || 0, { compact: true });
const chartEmpty = (title, sub) => emptyState({ icon: "trending", title, sub });
const activityPresent = values => values.some(value => value !== 0 && value != null);

export function render() {
  const s = store.get();
  const biz = selectors.biz(s);
  const a = s.analytics?.[s.bizId] || {};
  const labels = a.labels || [];
  const values = a.invValue || [];
  const risks = a.riskSeries || (Array.isArray(a.wasteRisk) ? a.wasteRisk : []);
  const created = a.created || [];
  const sold = a.sold || [];
  const revenue = a.revenue || [];
  const savings = a.savings || [];
  const topSurplus = a.topSurplus || [];
  const topNeeded = a.topNeeded || [];
  const totalListings = topSurplus.reduce((sum, row) => sum + row[1], 0);
  const slices = topSurplus.map(([label, value], index) => ({ label, value, color: ["#8577ff", "#22d3ee", "#34d399", "#f5a524", "#f0564a"][index % 5] }));
  const points = data => data.map((value, index) => ({ x: labels[index] || "", y: Number(value || 0) }));
  return `${pageHead("Analytics", `${esc(biz?.name || "Your business")} · last 14 days · based on recorded inventory and transactions`)}
    <div class="kpi-row stagger" style="margin-bottom:20px">
      ${metricCard({ label: "Value recovered", value: money(a.foodSaved), foot: "surplus transferred through orders", icon: "wallet" })}
      ${metricCard({ label: "Inventory recovered", value: `${fmtNum(a.recoveredKg || 0)} kg`, foot: "handed-over stock · weight units only", icon: "package" })}
      ${metricCard({ label: "Waste recorded", value: `${fmtNum(a.wasteKg || 0)} kg`, foot: "recorded stock disposals · weight only", icon: "leaf" })}
      ${metricCard({ label: "Surplus sales value", value: money(a.surplusRevenue), foot: "from handed-over orders", icon: "tag" })}
      ${metricCard({ label: "Purchasing savings", value: money(a.purchaseSavings), foot: "vs your previous recorded purchase cost", icon: "percent" })}
    </div>
    <div class="dash-grid"><div class="span-8 card chart-card"><div class="ch-head"><div><div class="card-title">Inventory value over time</div><div class="t-xs muted" style="margin-top:3px">Recorded inventory at purchase cost · ₹</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Inventory value</span></div></div>
      ${values.length > 1 && activityPresent(values) ? lineChart({ height: 220, series: [{ name: "Inventory value", color: "#8577ff", area: true, points: points(values) }], yFmt: money }) : chartEmpty("Inventory history starts here", "Add stock to begin tracking its value over time.")}</div>
    <div class="span-4 card chart-card"><div class="ch-head"><div><div class="card-title">Waste risk trend</div><div class="t-xs muted" style="margin-top:3px">Recorded rule-based risk scores · 0–100</div></div></div>
      ${risks.length > 1 && activityPresent(risks) ? lineChart({ height: 220, series: [{ name: "Risk score", color: "#f5a524", area: true, points: points(risks) }], yFmt: value => fmtNum(value, 0), xTickEvery: 3 }) : chartEmpty("No risk history yet", "Risk history builds as you track inventory and demand.")}</div>
    <div class="span-6 card chart-card"><div class="ch-head"><div><div class="card-title">Surplus created vs sold</div><div class="t-xs muted" style="margin-top:3px">Published listings and handed-over sales · counts</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Listings</span><span><i style="background:#22d3ee"></i>Sales</span></div></div>
      ${activityPresent(created) || activityPresent(sold) ? barChart({ height: 210, seriesNames: ["Listings", "Handed-over sales"], colors: ["#8577ff", "#22d3ee"], data: created.map((value, index) => ({ label: labels[index] || "", values: [value, sold[index] || 0] })) }) : chartEmpty("No surplus activity yet", "Publish listings and hand over orders to see your activity.")}</div>
    <div class="span-6 card chart-card"><div class="ch-head"><div><div class="card-title">Sales value &amp; purchase savings</div><div class="t-xs muted" style="margin-top:3px">Handed-over orders by day · ₹</div></div><div class="chart-legend"><span><i style="background:#34d399"></i>Sales value</span><span><i style="background:#f5a524"></i>Savings</span></div></div>
      ${activityPresent(revenue) || activityPresent(savings) ? barChart({ height: 210, yFmt: money, seriesNames: ["Sales value", "Savings"], colors: ["#34d399", "#f5a524"], data: revenue.map((value, index) => ({ label: labels[index] || "", values: [value, savings[index] || 0] })) }) : chartEmpty("Your value recovery will appear here", "Sales value and savings are recorded at handover.")}</div>
    <div class="span-4 card chart-card"><div class="card-title" style="margin-bottom:8px">Most frequently surplus products</div><p class="t-xs muted" style="margin-bottom:12px">Published listing count</p>${horizontalBars(topSurplus, "#8577ff")}</div>
    <div class="span-4 card chart-card"><div class="card-title" style="margin-bottom:8px">Most frequently needed products</div><p class="t-xs muted" style="margin-bottom:12px">Purchase count</p>${horizontalBars(topNeeded, "#22d3ee")}</div>
    <div class="span-4 card chart-card row gap-20" style="align-items:center"><div>${donut(slices, 132, 15, String(totalListings), "LISTINGS")}</div><div class="flex-1"><div class="card-title" style="margin-bottom:10px">Surplus by product</div>${slices.length ? slices.map(slice => `<div class="row gap-8" style="padding:3px 0;font-size:12px;color:var(--text-secondary)"><i style="width:9px;height:9px;border-radius:3px;background:${slice.color};flex:none"></i><span class="flex-1 truncate">${esc(slice.label)}</span><span class="t-num" style="font-size:11px">${Math.round(slice.value / Math.max(1, totalListings) * 100)}%</span></div>`).join("") : `<p class="t-xs muted">No listings recorded yet.</p>`}</div></div></div>
    <p class="t-xs muted" style="margin-top:14px;line-height:1.6">Weight metrics include kg and g only; litres and piece counts are not converted to weight. Savings compare the order price with your previous recorded purchase cost for the same product and unit. Payments are settled at pickup. All currency values are in Indian rupees.</p>`;
}
export function init() {}
