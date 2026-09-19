/* OverByte — explainable insights and demand predictions. */
import { icon } from "../icons.js";
import { demandForecast } from "../engines.js";
import { INSIGHTS } from "../data.js";
import { selectors, store } from "../store.js";
import { fmtNum, esc } from "../util.js";
import { pageHead, aiHeader, emptyState, toast } from "../ui.js";
import { barChart } from "../charts.js";

const toneColor = { violet: "var(--primary-strong)", teal: "var(--info)", green: "var(--success)" };

export function insights() {
  const s = store.get();
  const templates = INSIGHTS[s.bizId] || [];
  return `${pageHead("AI Insights", "Explainable recommendations derived from your inventory, orders and demo marketplace activity")}
    <div class="card ai-panel card-pad" style="margin-bottom:20px"><div class="row-between"><div>${aiHeader("OVERBYTE INTELLIGENCE")}<h2 class="t-h2" style="margin-top:12px">Signals you can act on</h2><p class="t-sm secondary" style="margin-top:6px">These are deterministic demo insights, not automatic decisions. Review the evidence before changing your plan.</p></div><span class="badge badge-violet">${templates.length} INSIGHTS</span></div></div>
    ${templates.length ? `<div class="page-grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">${templates.map((item) => `<article class="card insight-card"><div class="ic-kind" style="color:${toneColor[item.tone] || "var(--primary-strong)"}">${icon("sparkles", 13)}${esc(item.kind)}</div><h3>${esc(item.title)}</h3><p class="ic-body">${esc(item.body)}</p><div class="ic-stats">${(item.stats || []).map(([label, value]) => `<div class="ic-stat"><div class="v">${esc(value)}</div><div class="k">${esc(label)}</div></div>`).join("")}</div><div class="ic-action">${item.impact ? `<span class="t-xs muted">${esc(item.impact)}</span>` : "<span></span>"}${item.action ? `<button class="btn btn-secondary btn-sm" data-insight="${esc(item.action.label)}">${esc(item.action.label)}</button>` : ""}</div></article>`).join("")}</div>` : emptyState({ icon: "sparkles", title: "No insights yet", sub: "Add more inventory history to give the demo intelligence layer more context." })}`;
}

export function predictions() {
  const inventory = selectors.enrichedInventory(store.get()).filter((item) => item.forecastAvailable);
  if (!inventory.length) return `${pageHead("Predictions", "Demand and stock runway from your recorded demo data")}${emptyState({ icon: "trending", title: "No demand basis yet", sub: "Set expected daily use or record consumption on an inventory batch first." })}`;
  const primary = inventory.slice(0, 3);
  return `${pageHead("Predictions", "Demand and stock runway from your recorded demo data")}
    <div class="col gap-20">${primary.map((item) => {
      const forecast = demandForecast({ base: Math.max(1, item.dailyDemand || item.demand), seed: item.id, unit: item.unit });
      return `<article class="card chart-card"><div class="ch-head"><div><div class="card-title">${esc(item.product)}</div><div class="t-xs muted" style="margin-top:3px">${fmtNum(item.qty)} ${esc(item.unit)} on hand · ${fmtNum(item.dailyDemand || item.demand, 1)} ${esc(item.unit)}/day expected</div></div><span class="badge ${item.shortage ? "badge-high" : "badge-safe"}">${item.shortage ? `${fmtNum(item.shortage.qty)} ${esc(item.unit)} short` : "Covered"}</span></div>${barChart({ height: 170, data: forecast.map((day) => ({ label: day.day, values: [day.value] })), seriesNames: ["Expected use"], colors: ["#22d3ee"], yFmt: (value) => fmtNum(value) })}</article>`;
    }).join("")}</div>`;
}

export function init(root) {
  root.querySelectorAll("[data-insight]").forEach((button) => button.addEventListener("click", () => toast("Insight saved", `${button.dataset.insight} is available for your next planning pass.`, "info")));
}