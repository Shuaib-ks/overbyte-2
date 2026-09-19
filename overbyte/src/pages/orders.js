/* ============================================================
   OVERBYTE — Orders (purchases + sales)
   ============================================================ */

import { icon, foodArt } from "../icons.js";
import { fmtINR, fmtNum, esc, agoFromMins } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, statusBadge, avatar, verifiedBadge, orderTimeline, emptyState, toast } from "../ui.js";
import { bizById } from "../data.js";

const state = { tab: "purchases" };

function orderCard(o) {
  const isPurchase = o.buyer === store.get().bizId;
  const counterparty = bizById(isPurchase ? o.seller : o.buyer);
  const dir = isPurchase ? "From" : "To";
  return `<div class="card order-card card-hover">
    <div class="order-head">
      <div style="width:48px;height:48px;border-radius:12px;overflow:hidden;flex:none">${foodArt(o.product)}</div>
      <div class="flex-1" style="min-width:0">
        <div class="row gap-8 wrap"><b>${esc(o.product)}</b>${statusBadge(o.status)}</div>
        <div class="t-xs muted" style="margin-top:2px"><span class="order-id">${o.id}</span> · ${agoFromMins(o.placedMins ?? 0)}</div>
      </div>
      <div style="text-align:right">
        <div class="t-num-lg" style="font-size:17px">${fmtINR(o.total ?? o.qty * o.price)}</div>
        <div class="t-xs muted">${fmtNum(o.qty)} ${o.unit} × ₹${o.price}</div>
      </div>
    </div>
    <div class="order-line">
      ${avatar(counterparty, "sm")}
      <span class="t-sm secondary">${dir} <b style="color:var(--text-primary)">${esc(counterparty.name)}</b></span>
      ${verifiedBadge()}
      <span class="t-xs muted" style="margin-left:auto">${icon("truck", 12)} ${esc(o.pickup)}</span>
    </div>
    ${orderTimeline(o.status)}
    ${o.status !== "Completed" && o.status !== "Cancelled" ? `
    <div class="row gap-8" style="margin-top:14px">
      ${o.status === "Ready for pickup" ? `<button class="btn btn-success btn-sm" data-advance="${o.id}">${icon("check", 13)}Mark Picked Up</button>` : ""}
      ${o.status === "Picked up" ? `<button class="btn btn-success btn-sm" data-advance="${o.id}">${icon("check", 13)}Mark Completed</button>` : ""}
      <button class="btn btn-ghost btn-sm" data-cancel="${o.id}">Cancel</button>
      <span class="t-xs muted" style="margin-left:auto;align-self:center">${isPurchase ? "Payment placeholder · settled on pickup" : "Awaiting buyer pickup"}</span>
    </div>` : ""}
  </div>`;
}

export function render() {
  const s = store.get();
  const orders = selectors.ordersFor(s);
  const purchases = orders.filter((o) => o.buyer === s.bizId).sort((a, b) => (a.placedMins ?? 0) - (b.placedMins ?? 0));
  const sales = orders.filter((o) => o.seller === s.bizId).sort((a, b) => (a.placedMins ?? 0) - (b.placedMins ?? 0));
  const list = state.tab === "purchases" ? purchases : sales;
  const totals = {
    purchases: purchases.reduce((a, o) => a + (o.total ?? o.qty * o.price), 0),
    sales: sales.reduce((a, o) => a + (o.total ?? o.qty * o.price), 0),
  };

  return `
    ${pageHead("Orders", "Surplus purchases from other businesses · surplus sold to other businesses", `
      <div class="row gap-14 t-xs muted">
        <span>${icon("cart", 12)} Purchased ${fmtINR(totals.purchases)}</span>
        <span>${icon("wallet", 12)} Sold ${fmtINR(totals.sales)}</span>
      </div>`)}
    <div class="tabs" style="margin-bottom:18px">
      <button class="tab ${state.tab === "purchases" ? "active" : ""}" data-tab="purchases">${icon("cart", 13)} Purchases<span class="count">${purchases.length}</span></button>
      <button class="tab ${state.tab === "sales" ? "active" : ""}" data-tab="sales">${icon("wallet", 13)} Sales<span class="count">${sales.length}</span></button>
    </div>
    ${list.length ? `<div class="page-grid" style="grid-template-columns:repeat(auto-fill,minmax(360px,1fr))">
      ${list.map(orderCard).join("")}
    </div>` : emptyState({ icon: "receipt", title: state.tab === "purchases" ? "No purchases yet" : "No sales yet",
      sub: state.tab === "purchases"
        ? "When OverByte detects a shortage, use Find Surplus to buy verified surplus from nearby businesses."
        : "Publish surplus listings and they'll appear here the moment a buyer purchases.",
      action: state.tab === "purchases"
        ? `<a class="btn btn-primary" href="#/app/surplus">${icon("search", 14)}Find Surplus</a>`
        : `<a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Listing</a>` })}`;
}

export function init(root) {
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${render()}</div>`;
    init(content);
  }));
  root.querySelectorAll("[data-advance]").forEach((b) => b.addEventListener("click", () => {
    actions.advanceOrder(b.dataset.advance);
    toast("Order updated", "Status advanced.", "success");
  }));
  root.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => {
    actions.cancelOrder(b.dataset.cancel);
    toast("Order cancelled", "The counterparty has been notified.", "info");
  }));
}
