/* Inventory health, current alerts and actual business activity. */
import { icon, foodArt } from "../icons.js";
import { ringGauge, sparkline, barChart } from "../charts.js";
import { fmtINR, fmtNum as formatNumber, esc, agoFromMins, RISK_META } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { metricCard, riskPill, statusBadge, aiHeader, aiRec, pageHead, toast, confirmDialog, emptyState } from "../ui.js";
import { openAddInventory } from "../inventory-form.js";
import { openSalePicker, openRegisterSale, saleProducts } from "../sale-form.js";
const fmtNum = (value, decimals) => formatNumber(value, decimals ?? (Number.isInteger(Number(value)) ? 0 : 2));

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
const shelf = hours => hours <= 0 ? "Expired" : hours >= 48 ? `${fmtNum(hours / 24, 1)}d` : `${fmtNum(hours, 1)}h`;
const quantity = (value, unit) => `${fmtNum(value || 0)} ${esc(unit || "")}`;
const range = (values, unit) => Array.isArray(values) ? `${fmtNum(values[0])}–${fmtNum(values[1])} ${esc(unit)}` : values && typeof values === "object" ? quantity(values.mid, unit) : quantity(values, unit);
const alertRisk = alert => alert.wasteProb >= 55 ? "high" : alert.wasteProb >= 30 ? "medium" : "low";

function quickActions() {
  return `<div class="quick-actions">
    <button class="qa-btn primary" id="qa-sale">${icon("receipt", 15)}Register Sale</button>
    <button class="qa-btn" id="qa-add">${icon("plus", 15)}Add Inventory</button>
    <a class="qa-btn" href="#/app/surplus/new"><span class="qa-ic">${icon("tag", 15)}</span>Create Surplus Listing</a>
    <a class="qa-btn" href="#/app/surplus"><span class="qa-ic">${icon("search", 15)}</span>Find Surplus</a>
    <a class="qa-btn" href="#/app/notifications"><span class="qa-ic">${icon("bell", 15)}</span>View AI Alerts</a>
  </div>`;
}

function alertItem(alert) {
  const shortage = alert.kind === "shortage";
  const suggestions = store.get().settings.listingSuggestions !== false;
  const expired = alert.kind === "expiry" || alert.shelfHours <= 0;
  const risk = alertRisk(alert);
  const itemLink = `#/app/inventory/${encodeURIComponent(alert.item || alert.itemId || alert.inventoryItemId || "")}`;
  const recommendation = expired ? "Review this expired batch and record any disposal. It cannot be listed for sale."
    : shortage ? `Search the marketplace for <b>${quantity(alert.shortage, alert.unit)}</b> of ${esc(alert.product)}. Review availability and pickup before ordering.`
    : !suggestions ? "Surplus risk detected. Review your stock and demand. Listing suggestions are off in Settings." : `Review a surplus listing for <b>${range(alert.surplus, alert.unit)}</b> of ${esc(alert.product)}. You control the final quantity and price.`;
  return `<div class="ai-alert-item" data-alert="${esc(alert.id)}">
    <div class="a-art">${foodArt(alert.product)}</div>
    <div class="flex-1" style="min-width:0"><div class="a-title">${esc(alert.product)} ${riskPill(expired ? "high" : shortage ? "medium" : risk)}<span class="badge badge-neutral">${expired ? "EXPIRED" : shortage ? "SHORTAGE" : "SURPLUS"}</span></div>
      <div class="a-meta">
        <span class="am">Current stock <b>${quantity(alert.stock ?? alert.qty, alert.unit)}</b></span>
        ${expired ? "" : `<span class="am">Expected demand <b>${range(alert.expectedDemand ?? alert.demand, alert.unit)}</b></span>`}
        ${shortage ? `<span class="am">Projected shortage <b style="color:var(--warning)">${quantity(alert.shortage, alert.unit)}</b></span><span class="am">Expected <b>${esc(alert.byLabel || "In the next demand window")}</b></span>` : `<span class="am">Expiry <b>${shelf(alert.shelfHours)}</b></span>${alert.wasteProb != null ? `<span class="am">Risk score <b style="color:${RISK_META[risk].color}">${alert.wasteProb}/100</b></span>` : ""}`}
      </div>${aiRec(recommendation)}
    </div><div class="a-actions">
      ${expired ? `<a class="btn btn-secondary btn-sm" href="${itemLink}">Review Batch</a>` : shortage ? `<a class="btn btn-primary btn-sm" href="#/app/surplus?need=${encodeURIComponent(alert.product)}">${icon("search", 13)}Find Surplus</a>` : !suggestions ? `<a class="btn btn-secondary btn-sm" href="${itemLink}">Review Batch</a>` : `<a class="btn btn-primary btn-sm" href="#/app/surplus/new?alert=${encodeURIComponent(alert.id)}">${icon("tag", 13)}Review Listing</a>`}
      <button class="btn btn-ghost btn-sm" data-dismiss="${esc(alert.id)}">Dismiss</button>
    </div></div>`;
}

function commandCenter(alerts, inventory) {
  const ready = inventory.filter(item => item.forecastAvailable).length;
  return `<div class="card ai-panel" style="padding:0">
    <div class="card-head" style="padding:18px 20px 14px"><div class="row gap-10">${aiHeader("OVERBYTE AI")}<span class="t-sm" style="font-weight:560">Inventory intelligence</span></div><span class="badge badge-violet">${alerts.length} alert${alerts.length === 1 ? "" : "s"} to review</span></div>
    <div class="row gap-8" style="padding:0 20px 12px;color:var(--text-muted);font-size:12px"><span class="pulse-dot"></span>${ready} of ${inventory.length} batches have a demand forecast · rule-based estimates</div>
    <div class="col gap-10" style="padding:4px 20px 20px">${alerts.length ? alerts.map(alertItem).join("") : emptyState({ icon: inventory.length ? "checkCircle" : "package", title: !inventory.length ? "Connect your first inventory batch" : ready < inventory.length ? "Add demand data to see more" : "No alerts to review", sub: !inventory.length ? "Add stock and expected daily use. OverByte will calculate surplus, expiry risk and supply gaps." : ready < inventory.length ? "Set expected daily use or record consumption on each batch to enable forecasting." : "Your current inventory and demand do not require a new action.", action: !inventory.length ? `<button class="btn btn-primary btn-sm" id="cc-add">Add Inventory</button>` : ready < inventory.length ? `<a class="btn btn-secondary btn-sm" href="#/app/inventory">Review inventory</a>` : "" })}</div>
  </div>`;
}

function watchlist(inventory) {
  const rows = [...inventory].sort((a, b) => (b.risk?.probability ?? -1) - (a.risk?.probability ?? -1)).slice(0, 5);
  const available = saleProducts(inventory);
  return `<div class="card" style="padding:0"><div class="card-head"><span class="card-title">Inventory watchlist</span><a class="btn btn-ghost btn-sm" href="#/app/inventory">Full inventory ${icon("arrowRight", 13)}</a></div>
    ${!rows.length ? emptyState({ icon: "package", title: "No inventory yet", sub: "Your highest-priority batches will appear here." }) : `<div style="overflow-x:auto;padding:14px 8px 8px"><table class="tbl" style="min-width:640px"><thead><tr><th>Product</th><th class="td-right">Stock</th><th class="td-right">Demand to expiry</th><th class="td-right">Expiry</th><th>AI status</th></tr></thead><tbody>${rows.map(item => `<tr class="clickable" data-go="#/app/inventory/${encodeURIComponent(item.id)}">
      <td><div class="prod"><span class="p-art">${foodArt(item.product)}</span><div><a class="p-name" href="#/app/inventory/${encodeURIComponent(item.id)}">${esc(item.product)}</a><div class="p-sub">${esc(item.category)}</div></div></div></td>
      <td class="td-right num">${quantity(item.qty, item.unit)}</td><td class="td-right num">${item.forecastAvailable ? quantity(item.demand, item.unit) : "—"}</td><td class="td-right num">${shelf(item.shelfHours)}</td>
      <td>${item.shelfHours <= 0 ? statusBadge("Expired") : !item.forecastAvailable ? statusBadge("Needs demand data") : item.shortage ? statusBadge("Shortage") : riskPill(item.risk.risk)}
      ${available.some(product => product.product.trim().toLowerCase() === item.product.trim().toLowerCase() && product.unit === item.unit) ? `<button type="button" class="btn btn-ghost btn-sm" data-sale="${esc(item.id)}" aria-label="Register sale of ${esc(item.product)}" style="margin-left:8px">${icon("receipt", 13)}Sell</button>` : ""}</td></tr>`).join("")}</tbody></table></div>`}</div>`;
}

function activityFeed(s) {
  const feed = selectors.notificationsFor(s).slice(0, 6);
  return `<div class="card" style="padding:20px 20px 8px"><div class="row-between" style="margin-bottom:10px"><span class="card-title">Recent activity</span><a class="btn btn-ghost btn-sm" href="#/app/notifications">View all</a></div>
    ${feed.length ? feed.map(notification => `<div class="feed-item"><span class="f-dot" style="background:${notification.kind === "AI ALERT" ? "var(--primary)" : notification.kind === "SHORTAGE" ? "var(--warning)" : notification.kind === "ORDER" ? "var(--success)" : "var(--info)"}"></span><div class="flex-1" style="min-width:0"><div class="f-title truncate">${esc(notification.title)}</div><div class="f-sub">${esc(notification.kind)}</div></div><span class="f-time">${agoFromMins(notification.createdAt ? Math.max(0, (Date.now() - new Date(notification.createdAt).getTime()) / 60000) : notification.mins || 0)}</span></div>`).join("") : emptyState({ icon: "bell", title: "Ready for your first update", sub: "Inventory changes, marketplace activity and orders will appear here." })}</div>`;
}

export function render() {
  const s = store.get();
  const biz = selectors.biz(s);
  const inventory = selectors.enrichedInventory(s);
  const alerts = selectors.pendingAlerts(s);
  const analytics = s.analytics?.[s.bizId] || {};
  const known = inventory.filter(item => item.risk?.probability != null);
  const safeValue = known.filter(item => item.risk.risk === "low" && !item.shortage && item.shelfHours > 0).reduce((sum, item) => sum + item.value, 0);
  const atRisk = known.filter(item => item.risk.risk !== "low").reduce((sum, item) => sum + item.value, 0);
  const predictedSurplus = inventory.filter(item => item.forecastAvailable && item.shelfHours > 0).reduce((sum, item) => sum + (item.surplus?.mid || 0) * item.cost, 0);
  const lastRisk = Array.isArray(analytics.wasteRisk) ? analytics.wasteRisk.at(-1) : analytics.wasteRisk;
  const wasteRisk = known.length ? lastRisk ?? Math.round(known.reduce((sum, item) => sum + item.risk.probability, 0) / known.length) : null;
  const counts = Object.fromEntries(["high", "medium", "low"].map(risk => [risk, known.filter(item => item.risk.risk === risk).length]));
  const created = analytics.created || [];
  const sold = analytics.sold || [];
  return `${pageHead(`${greeting()}, ${esc(biz?.name || "your business")}`, `${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${inventory.length} inventory batches · your business overview`)}
    ${quickActions()}<div class="dash-grid" style="margin-top:20px">
      <div class="span-8 dashboard-metrics stagger">
        ${metricCard({ label: "Total inventory", value: fmtINR(selectors.totalInventoryValue(s)), foot: "at purchase cost", spark: analytics.invValue?.length > 1 ? sparkline(analytics.invValue, "#8577ff", 96, 28) : "", icon: "package" })}
        ${metricCard({ label: "Safe inventory", value: fmtINR(safeValue), foot: "forecast available · low risk", icon: "checkCircle" })}
        ${metricCard({ label: "At-risk inventory", value: fmtINR(atRisk), foot: "batches requiring attention", icon: "flame", accent: "var(--warning)" })}
        ${metricCard({ label: "Predicted surplus", value: fmtINR(predictedSurplus), foot: "projected remaining stock at cost", icon: "sparkles", accent: "var(--primary-strong)" })}
      </div><div class="card span-4 risk-block card-hover"><div style="position:relative">
        ${ringGauge({ value: wasteRisk || 0, size: 132, stroke: 10, color: wasteRisk > 30 ? "#f5a524" : "#34d399", sub: "RISK SCORE", showValue: wasteRisk != null })}${wasteRisk == null ? `<span class="t-num-lg" style="position:absolute;left:50%;top:37%;transform:translateX(-50%);color:var(--text-muted)">—</span>` : ""}
      </div><div class="risk-legend"><div class="row gap-8"><span class="t-xs muted">${known.length ? `${known.length} batches assessed` : "Awaiting inventory and demand"}</span></div>
        ${["high", "medium", "low"].map(risk => `<div class="rl-row"><span class="sq" style="background:${RISK_META[risk].color}"></span>${risk === "low" ? "Low risk" : risk === "high" ? "High risk" : "Medium risk"}<span class="rl-val">${counts[risk]} items</span></div>`).join("")}
        <div class="t-xs muted" style="line-height:1.5">${inventory.length - known.length} batches need demand data. Rule-based risk scores reflect current inventory and expiry.</div>
      </div></div><div class="span-12">${commandCenter(alerts, inventory)}</div><div class="span-7">${watchlist(inventory)}</div><div class="span-5">${activityFeed(s)}</div>
      <div class="span-12"><div class="card chart-card"><div class="ch-head"><div><div class="card-title">Surplus activity</div><div class="t-xs muted" style="margin-top:3px">Published listings and handed-over sales · last 14 days</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Listings</span><span><i style="background:#22d3ee"></i>Sales</span></div></div>
        ${created.some(value => value > 0) || sold.some(value => value > 0) ? barChart({ height: 190, seriesNames: ["Listings", "Sales"], colors: ["#8577ff", "#22d3ee"], data: created.map((count, index) => ({ label: esc(analytics.labels?.[index] || ""), values: [count, sold[index] || 0] })) }) : emptyState({ icon: "trending", title: "Your surplus activity will appear here", sub: "Publish a listing and complete a sale to start tracking value recovered." })}
      </div></div></div>`;
}

export function init(root) {
  root.querySelector("#qa-sale")?.addEventListener("click", openSalePicker);
  root.querySelectorAll("[data-sale]").forEach(button => button.addEventListener("click", () => {
    const item = selectors.enrichedInventory().find(item => item.id === button.dataset.sale);
    if (item) openRegisterSale(item);
  }));
  root.querySelector("#qa-add")?.addEventListener("click", openAddInventory);
  root.querySelector("#cc-add")?.addEventListener("click", openAddInventory);
  root.querySelectorAll("[data-go]").forEach(row => row.addEventListener("click", event => { if (!event.target.closest("a,button")) location.hash = row.dataset.go; }));
  root.querySelectorAll("[data-dismiss]").forEach(button => button.addEventListener("click", () => {
    const alert = store.get().alerts.find(item => item.id === button.dataset.dismiss);
    if (!alert) return;
    confirmDialog({ title: "Dismiss this alert?", body: `Dismiss the current alert for <b>${esc(alert.product)}</b>. Inventory tracking continues.`, confirmLabel: "Dismiss", onConfirm: async () => {
      try { await actions.dismissAlert(alert.id); toast("Alert dismissed", `${esc(alert.product)} alert dismissed.`, "info"); }
      catch (error) { toast("Unable to dismiss alert", esc(error.message || "Please try again."), "error"); }
    } });
  }));
}
