/* OverByte — local demo analytics. */
import { lineChart, barChart, donut } from "../charts.js";
import { ANALYTICS_LABELS, INSIGHTS } from "../data.js";
import { selectors, store } from "../store.js";
import { fmtINR, fmtNum, esc } from "../util.js";
import { pageHead, metricCard, emptyState } from "../ui.js";

export function render() {
  const s = store.get();
  const a = s.analytics[s.bizId] || {};
  const topSurplus = a.topSurplus || [];
  const topNeeded = a.topNeeded || [];
  const series = (values) => (values || []).map((value, index) => ({ x: ANALYTICS_LABELS[index] || String(index + 1), y: value }));
  const insightCount = (INSIGHTS[s.bizId] || []).length;
  return `${pageHead("Analytics", "Track recovered value, waste risk and purchasing patterns across your workspace")}
    <div class="kpi-row">
      ${metricCard({ label: "Food saved", value: fmtINR(a.foodSaved || 0, { compact: true }), foot: "cumulative", icon: "leaf", accent: "var(--success)" })}
      ${metricCard({ label: "Recovered stock", value: `${fmtNum(a.recoveredKg || 0)} kg`, foot: "redirected from waste", icon: "package" })}
      ${metricCard({ label: "Waste prevented", value: `${fmtNum(a.wastePreventedKg || 0)} kg`, foot: "estimated", icon: "shieldCheck", accent: "var(--info)" })}
      ${metricCard({ label: "Surplus revenue", value: fmtINR(a.surplusRevenue || 0, { compact: true }), foot: "from completed orders", icon: "wallet" })}
      ${metricCard({ label: "Insights", value: fmtNum(insightCount), foot: "ready to review", icon: "sparkles", accent: "var(--primary-strong)" })}
    </div>
    <div class="dash-grid" style="margin-top:20px">
      <div class="span-8 card chart-card"><div class="ch-head"><div><div class="card-title">Recovery and savings</div><div class="t-xs muted" style="margin-top:3px">Daily trend · local demo records</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Recovered value</span><span><i style="background:#22d3ee"></i>Purchase savings</span></div></div>${lineChart({ height: 245, series: [{ name: "Recovered value", color: "#8577ff", area: true, points: series(a.revenue) }, { name: "Purchase savings", color: "#22d3ee", points: series(a.savings) }], yFmt: (value) => `₹${Number(value).toFixed(1)}K`, xTickEvery: 3 })}</div>
      <div class="span-4 card chart-card"><div class="card-title">Surplus outcomes</div><div class="row gap-20" style="align-items:center;margin-top:18px"><div>${donut([{ label: "Sold", value: (a.sold || []).reduce((x, y) => x + y, 0), color: "#34d399" }, { label: "Created", value: (a.created || []).reduce((x, y) => x + y, 0), color: "#8577ff" }], 148, 17, "LIVE", "ACTIVITY")}</div><div class="col gap-10 t-sm secondary"><span><i class="dot" style="background:#34d399"></i>Sold <b>${fmtNum((a.sold || []).reduce((x, y) => x + y, 0))}</b></span><span><i class="dot" style="background:#8577ff"></i>Created <b>${fmtNum((a.created || []).reduce((x, y) => x + y, 0))}</b></span></div></div></div>
      <div class="span-6 card card-pad"><div class="card-title" style="margin-bottom:12px">Top surplus products</div>${topSurplus.length ? topSurplus.map(([name, value]) => `<div class="hbar-row"><span class="hb-label truncate">${esc(name)}</span><span class="hb-track"><i style="width:${Math.min(100, value / Math.max(1, topSurplus[0][1]) * 100)}%;background:#8577ff"></i></span><span class="hb-val">${fmtNum(value)} kg</span></div>`).join("") : emptyState({ icon: "package", title: "No surplus data", sub: "Completed listings will show up here." })}</div>
      <div class="span-6 card card-pad"><div class="card-title" style="margin-bottom:12px">Most needed products</div>${topNeeded.length ? topNeeded.map(([name, value]) => `<div class="hbar-row"><span class="hb-label truncate">${esc(name)}</span><span class="hb-track"><i style="width:${Math.min(100, value / Math.max(1, topNeeded[0][1]) * 100)}%;background:#22d3ee"></i></span><span class="hb-val">${fmtNum(value)} kg</span></div>`).join("") : emptyState({ icon: "trending", title: "No demand data", sub: "Inventory forecasts will appear here." })}</div>
    </div>`;
}

export function init() {}