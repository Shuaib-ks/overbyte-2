/* OverByte — dashboard built from the local demo data. */
import { icon, foodArt } from "../icons.js";
import { lineChart, ringGauge, sparkline } from "../charts.js";
import { selectors, actions, store } from "../store.js";
import { ANALYTICS_LABELS } from "../data.js";
import { fmtINR, fmtNum, esc, agoFromMins, RISK_META } from "../util.js";
import { pageHead, metricCard, aiHeader, statusBadge, emptyState, toast } from "../ui.js";

function alertCard(alert) {
  const isSurplus = alert.kind === "surplus";
  const item = selectors.enrichedInventory(store.get()).find((entry) => entry.id === alert.item);
  const unit = alert.unit || item?.unit || "kg";
  return `<article class="ai-alert-item">
    <div class="a-art">${foodArt(alert.product)}</div>
    <div class="flex-1" style="min-width:0">
      <div class="a-title">${esc(alert.product)} ${statusBadge(isSurplus ? "Surplus risk" : "Shortage")}</div>
      <div class="a-meta">
        <span class="am">${isSurplus ? "On hand" : "Stock"} <b>${fmtNum(alert.qty ?? alert.stock)} ${unit}</b></span>
        <span class="am">${isSurplus ? "Waste risk" : "Shortage"} <b>${isSurplus ? `${alert.wasteProb}%` : `${alert.shortage} ${unit}`}</b></span>
        <span class="am">${isSurplus ? "Expires in" : "Expected by"} <b>${isSurplus ? `${alert.shelfHours}h` : esc(alert.byLabel)}</b></span>
      </div>
    </div>
    <div class="a-actions">
      ${isSurplus ? `<a class="btn btn-primary btn-sm" href="#/app/surplus/new?alert=${encodeURIComponent(alert.id)}&item=${encodeURIComponent(alert.item)}">Review listing</a>` : `<a class="btn btn-secondary btn-sm" href="#/app/surplus?need=${encodeURIComponent(alert.product)}">Find surplus</a>`}
      <button class="btn btn-ghost btn-sm" data-dismiss-alert="${esc(alert.id)}">Dismiss</button>
    </div>
  </article>`;
}

export function render() {
  const s = store.get();
  const inventory = selectors.enrichedInventory(s);
  const analytics = s.analytics[s.bizId] || {};
  const pending = selectors.pendingAlerts(s);
  const risk = inventory.length ? Math.round(inventory.reduce((sum, item) => sum + item.risk.probability, 0) / inventory.length) : 0;
  const chart = analytics.invValue?.map((value, index) => ({ x: ANALYTICS_LABELS[index] || String(index + 1), y: value })) || [];
  const activity = selectors.notificationsFor(s).slice(0, 4);

  return `${pageHead(`Good to see you, ${esc(selectors.biz(s)?.name?.split(" ")[0] || "there")}`, "Your inventory intelligence workspace · updated from the local demo data", `
      <div class="quick-actions"><a class="qa-btn primary" href="#/app/surplus/new">${icon("plus", 14)}Create listing</a><a class="qa-btn" href="#/app/inventory">${icon("package", 14)}Update inventory</a></div>`)}
    <div class="dashboard-metrics">
      ${metricCard({ label: "Inventory value", value: fmtINR(selectors.totalInventoryValue(s), { compact: true }), delta: "8.4%", deltaDir: "up", foot: "vs last 14 days", icon: "package", spark: sparkline(analytics.invValue || [72, 75, 78, 80, 84], "#8577ff") })}
      ${metricCard({ label: "Waste risk", value: `${risk}%`, delta: "12%", deltaDir: "up", foot: "lower is better", icon: "flame", accent: risk > 55 ? "var(--danger)" : "var(--success)", spark: sparkline(analytics.riskSeries || [31, 28, 25, 21, risk], "#34d399") })}
      ${metricCard({ label: "Value recovered", value: fmtINR(analytics.foodSaved || 0, { compact: true }), delta: "18%", deltaDir: "down", foot: "this period", icon: "wallet", accent: "var(--success)" })}
      ${metricCard({ label: "Open alerts", value: fmtNum(pending.length), foot: "need your review", icon: "sparkles", accent: pending.length ? "var(--primary-strong)" : "var(--success)" })}
    </div>
    <div class="dash-grid" style="margin-top:20px">
      <div class="span-8 card chart-card"><div class="ch-head"><div><div class="card-title">Inventory value trend</div><div class="t-xs muted" style="margin-top:3px">Current business · last 14 days</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Inventory value (₹K)</span></div></div>
        ${chart.length ? lineChart({ height: 230, series: [{ name: "Inventory value", color: "#8577ff", area: true, points: chart }], yFmt: (value) => `₹${Math.round(value)}K`, xTickEvery: 3 }) : emptyState({ icon: "chart", title: "No trend data yet", sub: "Add inventory and OverByte will start tracking value." })}
      </div>
      <div class="span-4 card risk-block"><div>${ringGauge({ value: risk, size: 132, stroke: 10, color: risk > 55 ? "#f0564a" : "#34d399", sub: "WASTE RISK" })}</div><div class="risk-legend"><div class="t-cap">Portfolio signal</div><div class="rl-row"><span class="sq" style="background:#f0564a"></span>High risk<span class="rl-val">${inventory.filter((item) => item.risk.risk === "high").length}</span></div><div class="rl-row"><span class="sq" style="background:#f5a524"></span>Watch<span class="rl-val">${inventory.filter((item) => item.risk.risk === "medium").length}</span></div><div class="rl-row"><span class="sq" style="background:#34d399"></span>Healthy<span class="rl-val">${inventory.filter((item) => item.risk.risk === "low").length}</span></div></div></div>
      <div class="span-8 card card-pad"><div class="row-between" style="margin-bottom:14px">${aiHeader("REQUIRES YOUR REVIEW")}<span class="t-xs muted">${pending.length} pending</span></div><div class="col gap-10">${pending.length ? pending.slice(0, 4).map(alertCard).join("") : emptyState({ icon: "checkCircle", title: "No urgent alerts", sub: "New surplus and shortage signals will appear here as your demo inventory changes." })}</div>${pending.length > 4 ? `<a class="btn btn-ghost btn-sm" href="#/app/insights" style="margin-top:12px">View all insights</a>` : ""}</div>
      <div class="span-4 card card-pad"><div class="row-between" style="margin-bottom:8px"><div class="card-title">Recent activity</div><a class="t-xs muted" href="#/app/notifications">View all</a></div>${activity.map((item) => `<div class="feed-item"><span class="f-dot" style="background:${item.prio === "critical" ? "var(--danger)" : item.prio === "high" ? "var(--warning)" : "var(--primary)"}"></span><div style="min-width:0"><div class="f-title">${esc(item.title)}</div><div class="f-sub">${esc(item.body)}</div></div><span class="f-time">${agoFromMins(item.mins || 0)}</span></div>`).join("")}</div>
    </div>`;
}

export function init(root) {
  root.querySelectorAll("[data-dismiss-alert]").forEach((button) => button.addEventListener("click", () => {
    actions.dismissAlert(button.dataset.dismissAlert);
    toast("Alert dismissed", "The signal is removed from your pending review list.", "info");
  }));
}