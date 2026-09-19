/* Inventory records and explainable forecasts from the authenticated API. */
import { icon, foodArt } from "../icons.js";
import { lineChart, barChart, ringGauge } from "../charts.js";
import { fmtINR, fmtNum as formatNumber, esc, RISK_META } from "../util.js";
import { selectors, store } from "../store.js";
import { pageHead, statusBadge, aiHeader, aiRec, emptyState, kv } from "../ui.js";
import { priceRecommendation } from "../engines.js";
import { openAddInventory, openInventoryEdit, openStockMovement } from "../inventory-form.js";
import { openRegisterSale, saleHistory } from "../sale-form.js";

const filters = { q: "", cat: "All", risk: "All" };
const fmtNum = (value, decimals) => formatNumber(value, decimals ?? (Number.isInteger(Number(value)) ? 0 : 2));
const unit = item => esc(item.unit);
const riskColor = item => (RISK_META[item.risk?.risk] || RISK_META.low).color;
const shelf = item => item.shelfHours <= 0 ? "Expired" : item.shelfHours >= 48 ? `${fmtNum(item.shelfHours / 24, 1)}d` : `${fmtNum(item.shelfHours, 1)}h`;
const dailyRate = item => Number(item.effectiveDailyDemand ?? item.dailyDemand ?? (item.shelfHours > 0 ? item.demand * 24 / item.shelfHours : 0));
const demandBasis = item => item.demandSource === "sales" ? "Recent sales · weighted daily average" : item.demandSource === "planned" || item.dailyDemand != null ? "Your expected daily use" : item.forecastAvailable ? "Recorded consumption" : "No demand data yet";
const dateLabel = value => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not set";
const hasSurplus = item => item.shelfHours > 0 && item.forecastAvailable && item.surplus?.mid > 0;
const status = item => item.shelfHours <= 0 ? statusBadge("Expired") : !item.forecastAvailable ? statusBadge("Needs demand data") : hasSurplus(item) ? '<span class="badge badge-high">Surplus Risk</span>' : item.shortage ? statusBadge("Shortage") : statusBadge("Healthy");
const surplusSentence = item => `Estimated ${fmtNum(item.surplus?.mid || 0)} ${unit(item)} may remain before expiry.`;

function applyFilters(inventory) {
  return inventory.filter(item => {
    if (filters.q && !`${item.product} ${item.category} ${item.batch || ""} ${item.supplier || ""}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.cat !== "All" && item.category !== filters.cat) return false;
    const itemStatus = item.shelfHours <= 0 ? "Expired" : !item.forecastAvailable ? "Needs demand data" : hasSurplus(item) ? "Surplus risk" : item.shortage ? "Shortage" : item.aiStatus;
    return filters.risk === "All" || itemStatus === filters.risk;
  });
}

export function list() {
  const s = store.get();
  const inventory = selectors.enrichedInventory(s);
  const categories = ["All", ...new Set(inventory.map(item => item.category))];
  const rows = applyFilters(inventory);
  return `
    ${pageHead("Inventory", `${inventory.length} batches · ${fmtINR(selectors.totalInventoryValue(s))} at cost · click a product to register a sale`)}
    <div class="row gap-10 wrap" style="margin-bottom:18px">
      <label class="tb-search" style="width:280px">${icon("search", 15)}<input id="inv-search" aria-label="Search inventory" type="search" placeholder="Search products, batches…" value="${esc(filters.q)}"/></label>
      <select class="select" id="inv-cat" aria-label="Filter by category" style="width:180px">${categories.map(category => `<option value="${esc(category)}" ${filters.cat === category ? "selected" : ""}>${esc(category === "All" ? "All categories" : category)}</option>`).join("")}</select>
      <select class="select" id="inv-risk" aria-label="Filter by inventory status" style="width:180px">${["All", "Surplus risk", "Watch", "Shortage", "Healthy", "Needs demand data", "Expired"].map(value => `<option value="${value}" ${filters.risk === value ? "selected" : ""}>${value === "All" ? "All statuses" : value}</option>`).join("")}</select>
      <div class="flex-1"></div><button class="btn btn-primary" id="inv-add">${icon("plus", 14)}Add Inventory</button>
    </div>
    ${!rows.length ? emptyState({ icon: "package", title: inventory.length ? "Nothing matches" : "Your inventory starts here", sub: inventory.length ? "No inventory batches match these filters." : "Add your first batch to track stock, expiry and surplus opportunities.", action: inventory.length ? `<button class="btn btn-secondary" id="inv-clear">Clear filters</button>` : `<button class="btn btn-primary" id="inv-first">${icon("plus", 14)}Add your first item</button>` }) : `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th class="td-right">Qty</th><th class="td-right">Value</th><th>Expiry</th><th class="td-right">Demand to expiry</th><th>Waste risk score</th><th>Forecast status</th></tr></thead><tbody>
      ${rows.map(item => `<tr class="clickable" data-sale-item="${esc(item.id)}">
        <td><div class="prod"><span class="p-art">${foodArt(item.product)}</span><div><button class="p-name" type="button" aria-haspopup="dialog" aria-label="Register sale of ${esc(item.product)}" style="text-align:left">${esc(item.product)}</button><div class="p-sub">${esc(item.category)} · ${esc(item.batch || "No batch code")}</div></div></div></td>
        <td class="td-right num">${fmtNum(item.qty)} ${unit(item)}${item.reservedQty ? `<div class="t-xs muted">${fmtNum(item.reservedQty)} reserved</div>` : ""}</td>
        <td class="td-right num">${fmtINR(item.value)}</td><td><span class="num" title="${esc(dateLabel(item.expiresAt))}" style="font-size:12.5px;${item.shelfHours <= 24 ? "color:var(--danger)" : ""}">${shelf(item)}</span></td>
        <td class="td-right num">${item.forecastAvailable ? `${fmtNum(item.demand)} ${unit(item)}` : "—"}</td>
        <td>${item.risk.probability != null ? `<div class="num" style="font-size:12.5px">${item.risk.probability}/100</div><div class="risk-meter"><i style="width:${item.risk.probability}%;background:${riskColor(item)}"></i></div>` : `<span class="t-xs muted">Awaiting demand</span>`}</td>
        <td>${status(item)}<div class="t-xs muted" style="margin-top:5px;max-width:220px;white-space:normal">${hasSurplus(item) ? surplusSentence(item) : item.shortage ? `${fmtNum(item.shortage.qty)} ${unit(item)} short` : esc(item.aiStatus || "")}</div>${hasSurplus(item) && item.availableToList > 0 && s.settings.listingSuggestions !== false ? `<a class="t-xs" style="display:inline-block;margin-top:5px;color:var(--primary)" href="#/app/surplus/new?item=${encodeURIComponent(item.id)}">Review Listing</a>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`}
    <p class="t-xs muted" style="margin-top:12px;line-height:1.6">${icon("info", 12)} Forecasts use up to 7 UTC days of weighted sales, with newer days weighted more. Today’s sales are partial; estimates improve with history. Predictions refresh after stock changes. Until sales are recorded, expected daily use or consumption history is used. Listings always need your approval.</p>
    <div class="card card-pad" style="margin-top:18px">${saleHistory(null, 10)}</div>`;
}

export function init(root, { view } = {}) {
  if (view === "detail") return detailInit(root);
  const rerender = refocus => {
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${list()}</div>`;
    init(content, { view: "list" });
    if (refocus) { const input = content.querySelector("#inv-search"); input?.focus(); input?.setSelectionRange(input.value.length, input.value.length); }
  };
  root.querySelector("#inv-search")?.addEventListener("input", event => { filters.q = event.target.value; rerender(true); });
  root.querySelector("#inv-cat")?.addEventListener("change", event => { filters.cat = event.target.value; rerender(); });
  root.querySelector("#inv-risk")?.addEventListener("change", event => { filters.risk = event.target.value; rerender(); });
  root.querySelector("#inv-clear")?.addEventListener("click", () => { filters.q = ""; filters.cat = "All"; filters.risk = "All"; rerender(); });
  root.querySelector("#inv-add")?.addEventListener("click", openAddInventory);
  root.querySelector("#inv-first")?.addEventListener("click", openAddInventory);
  root.querySelectorAll("[data-sale-item]").forEach(row => row.addEventListener("click", event => {
    if (event.target.closest("a")) return;
    const item = selectors.enrichedInventory().find(value => value.id === row.dataset.saleItem);
    if (item) openRegisterSale(item);
  }));
}

function stockChart(item) {
  if (!item.forecastAvailable) return emptyState({ icon: "trending", title: "A demand basis is needed", sub: "Register a sale to learn demand automatically, or set expected daily use to see projected stock and surplus.", action: `<button class="btn btn-secondary btn-sm" id="set-demand">Set expected daily use</button>` });
  if (item.shelfHours <= 0) return emptyState({ icon: "clock", title: "This batch has expired", sub: "Expired stock is excluded from marketplace recommendations. Update the batch or record a stock movement." });
  const horizon = Math.min(item.shelfHours, 168);
  const perHour = dailyRate(item) / 24;
  const available = Math.max(0, item.availableToList ?? item.qty - (item.reservedQty || 0));
  const earlierBatchDemand = Math.max(0, perHour * item.shelfHours - item.demand);
  const points = Array.from({ length: 9 }, (_, index) => {
    const hours = horizon * index / 8;
    const demand = Math.max(0, Math.round((hours * perHour - earlierBatchDemand) * 100) / 100);
    return { label: `${fmtNum(hours, hours < 10 ? 1 : 0)}h`, remaining: Math.max(0, Math.round((available - demand) * 100) / 100), demand };
  });
  return `${lineChart({ height: 245, xTickEvery: 2, series: [
    { name: "Projected stock", color: "#8577ff", area: true, points: points.map(point => ({ x: point.label, y: point.remaining })) },
    { name: "Expected use", color: "#22d3ee", points: points.map(point => ({ x: point.label, y: point.demand })) },
  ], yFmt: value => `${fmtNum(value, 1)} ${unit(item)}` })}<p class="t-xs muted" style="margin-top:8px">${horizon === item.shelfHours ? "Chart ends at batch expiry" : "Next 7 days shown"} · expiry ${esc(dateLabel(item.expiresAt))}. Assumes ${fmtNum(dailyRate(item), 2)} ${unit(item)}/day, with earlier-expiring batches used first. Reserved stock is excluded.</p>`;
}

export function detail({ params }) {
  const item = selectors.enrichedInventory(store.get()).find(row => row.id === params[0]);
  if (!item) return emptyState({ icon: "package", title: "Item not found", sub: "This inventory batch is not available in your business account.", action: `<a class="btn btn-secondary" href="#/app/inventory">Back to inventory</a>` });
  const forecast = item.forecastAvailable;
  const available = Math.max(0, item.availableToList ?? item.qty - (item.reservedQty || 0));
  const price = item.market > 0 ? priceRecommendation({ market: item.market, shelfHours: item.shelfHours, wasteProb: item.risk.probability || 0, qty: Math.max(1, item.surplus?.mid || 0), unit: item.unit }) : null;
  const forecastDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return { label: date.toLocaleDateString("en-IN", { weekday: "short" }), values: [Math.round(dailyRate(item) * 100) / 100] }; });
  return `
    <a class="btn btn-ghost btn-sm" href="#/app/inventory" style="margin-bottom:14px">${icon("chevronLeft", 14)}Back to inventory</a>
    <div class="page-head" style="margin-bottom:20px"><div class="row gap-16">
      <div style="width:64px;height:64px;border-radius:14px;overflow:hidden;border:1px solid var(--border-strong);flex:none">${foodArt(item.product)}</div>
      <div><div class="row gap-10 wrap"><h1 class="t-h1">${esc(item.product)}</h1>${status(item)}<span class="badge badge-neutral">${esc(item.category)}</span></div><p class="t-body sub">Batch ${esc(item.batch || "—")} · ${esc(item.supplier || "No supplier")} · ${esc(item.storage)}</p></div></div>
      <div class="row gap-10 wrap"><button class="btn btn-primary btn-sm" id="register-sale">${icon("receipt", 13)}Register Sale</button><button class="btn btn-secondary btn-sm" id="edit-item">Edit batch</button><button class="btn btn-secondary btn-sm" id="record-use">${icon("minus", 13)}Record use</button><button class="btn btn-secondary btn-sm" id="adjust-stock">${icon("plus", 13)}Update stock</button>
        ${available > 0 && item.shelfHours > 0 ? `<a class="btn btn-primary btn-sm" href="#/app/surplus/new?item=${encodeURIComponent(item.id)}">${icon("tag", 13)}Create Surplus Listing</a>` : ""}</div></div>
    <div class="dash-grid"><div class="span-4 card ai-panel" style="padding:20px">
      <div class="row-between">${aiHeader("SURPLUS PREDICTION")}<span class="t-xs muted">Rule-based forecast</span></div>
      <div class="row gap-16" style="margin:16px 0 14px">
        ${item.risk.probability != null ? ringGauge({ value: item.risk.probability, size: 104, stroke: 9, color: riskColor(item), sub: "RISK SCORE" }) : `<div class="t-num-lg" style="padding:18px;color:var(--text-muted)">—</div>`}
        <div class="flex-1 t-sm secondary" style="line-height:1.6">${forecast ? `This batch has a <b style="color:var(--text-primary)">${item.risk.probability}/100 waste risk score</b> based on ${demandBasis(item).toLowerCase()}, stock and remaining shelf life. This score is an estimate, not a measured probability.` : "Register a sale to learn demand automatically, or set expected daily use to enable surplus estimates for this batch."}</div>
      </div><div class="t-cap" style="margin-bottom:6px">Why</div>
      ${(item.risk.factors || []).map(factor => `<div class="why-row">${icon("info", 13)}<span>${esc(factor)}</span></div>`).join("")}
      ${item.demandSource === "sales" ? `<p class="t-xs muted" style="margin-top:10px;line-height:1.6">Weighted average: <b>${fmtNum(item.salesDailyAverage, 2)} ${unit(item)}/day</b> across ${fmtNum(item.salesObservationDays)} observed UTC day${item.salesObservationDays === 1 ? "" : "s"} (up to 7). Newer days carry more weight; today’s total is partial. Estimates improve with history. A constant sales rate is projected until expiry; earlier-expiring batches are used first.</p>` : ""}
      <div class="row-between" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)"><div><div class="t-cap">Estimated surplus</div><div class="t-num-lg" style="margin-top:4px">${forecast ? `${fmtNum(item.surplus.mid)} ${unit(item)}` : "—"}</div></div><div style="text-align:right"><div class="t-cap">Suggested price</div><div class="t-num-lg" style="margin-top:4px">${price ? `₹${price.low}–₹${price.high}` : "Set reference"}</div></div></div>
      ${item.shelfHours <= 0 ? aiRec("This batch has expired. Review its condition and record any stock disposal.") : !forecast ? aiRec("Add a demand basis to start forecasting.", `<button class="btn btn-secondary btn-sm" id="set-demand-ai">Set expected daily use</button>`) : item.surplus.mid > 0 && available > 0 && store.get().settings.listingSuggestions !== false ? aiRec(`${surplusSentence(item)} Review a listing for up to <b>${fmtNum(Math.min(available, item.surplus.mid))} ${unit(item)}</b>. Nothing is published until you approve the quantity and price.`, `<a class="btn btn-primary btn-sm" href="#/app/surplus/new?item=${encodeURIComponent(item.id)}">Review Listing</a>`) : item.shortage ? aiRec(`Projected shortage: <b>${fmtNum(item.shortage.qty)} ${unit(item)}</b> ${esc(item.shortage.byLabel || "")}.`, `<a class="btn btn-primary btn-sm" href="#/app/surplus?need=${encodeURIComponent(item.product)}">Find Surplus</a>`) : aiRec(store.get().settings.listingSuggestions === false ? "Listing suggestions are off. You can create a listing manually." : "No additional surplus is currently available to list. Forecasts refresh when inventory or demand changes.")}
    </div>
    <div class="span-8 col gap-20"><div class="card chart-card"><div class="ch-head"><div><div class="card-title">Inventory vs expected consumption</div><div class="t-xs muted" style="margin-top:3px">${esc(demandBasis(item))} · current stock and expiry</div></div><div class="chart-legend"><span><i style="background:#8577ff"></i>Projected stock</span><span><i style="background:#22d3ee"></i>Expected use</span></div></div>${stockChart(item)}</div>
      <div class="dash-grid" style="gap:20px"><div class="span-6 card chart-card"><div class="ch-head"><div class="card-title">7-day demand forecast</div><span class="t-xs muted">${unit(item)}/day</span></div>${forecast ? barChart({ height: 170, data: forecastDays, colors: ["#22d3ee"], seriesNames: ["Daily demand"] }) : emptyState({ icon: "trending", title: "Not enough data", sub: "Record consumption or add expected daily use." })}<p class="t-xs muted" style="margin-top:8px">${forecast ? "Constant-rate projection; no seasonal adjustment is assumed." : "Forecasts appear when there is a demand basis."}</p></div>
      <div class="span-6 card card-pad"><div class="card-title" style="margin-bottom:10px">Batch details</div>${kv([
        ["Current quantity", `${fmtNum(item.qty)} ${unit(item)}`, 1], ["Reserved for listings", `${fmtNum(item.reservedQty || 0)} ${unit(item)}`, 1], ["Available quantity", `${fmtNum(available)} ${unit(item)}`, 1], ["Incoming orders (awaiting pickup)", `${fmtNum(item.incomingQty || 0)} ${unit(item)}`, 1],
        ["Purchase cost", `${fmtINR(item.cost)} / ${unit(item)}`, 1], ["Current value", fmtINR(item.value), 1], ["Reference market price", item.market > 0 ? `${fmtINR(item.market)} / ${unit(item)}` : "Not provided", 1],
        ["Demand to expiry", forecast ? `${fmtNum(item.demand)} ${unit(item)}` : "Needs demand data", 1], ["Expiry", esc(dateLabel(item.expiresAt))], ["Storage", esc(item.storage)], ["Demand basis", esc(demandBasis(item))],
      ])}</div></div></div></div>
      <div class="card card-pad" style="margin-top:20px">${saleHistory(item, 10)}</div>`;
}

function detailInit(root) {
  const id = decodeURIComponent(location.hash.split("/")[3]?.split("?")[0] || "");
  const currentItem = () => selectors.enrichedInventory(store.get()).find(item => item.id === id);
  for (const selector of ["#edit-item", "#set-demand", "#set-demand-ai"]) root.querySelector(selector)?.addEventListener("click", () => { const item = currentItem(); if (item) openInventoryEdit(item); });
  root.querySelector("#register-sale")?.addEventListener("click", () => { const item = currentItem(); if (item) openRegisterSale(item); });
  root.querySelector("#record-use")?.addEventListener("click", () => { const item = currentItem(); if (item) openStockMovement(item, "consumption"); });
  root.querySelector("#adjust-stock")?.addEventListener("click", () => { const item = currentItem(); if (item) openStockMovement(item, "received"); });
}
