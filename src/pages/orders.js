/* Purchases and sales with explicit seller-controlled stock handover. */
import { icon, foodArt } from "../icons.js";
import { fmtINR, fmtNum, esc, agoFromMins } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, statusBadge, avatar, verifiedBadge, orderTimeline, emptyState, toast, openModal, modalHead, closeModal } from "../ui.js";

const state = { tab: "purchases", context: null, bizId: null };
const money = (value) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const quantity = (value) => fmtNum(value, Number(value) % 1 ? 2 : 0);
const fulfilled = (order) => ["Picked up", "Completed"].includes(order.status);
const canCancel = (order) => ["Confirmed", "Awaiting pickup", "Ready for pickup"].includes(order.status);

function orderCard(order) {
  const isPurchase = order.buyer === store.get().bizId;
  const counterparty = selectors.business(isPurchase ? order.seller : order.buyer) || { name: "Business", type: "Business" };
  const transitions = { Confirmed: "Mark ready for pickup", "Awaiting pickup": "Mark ready for pickup", "Ready for pickup": "Confirm pickup", "Picked up": "Mark completed" };
  const advanceLabel = !isPurchase ? transitions[order.status] : null;
  const date = order.createdAt ? new Date(order.createdAt).toLocaleString() : agoFromMins(order.placedMins ?? 0);
  return `<div class="card order-card card-hover"><div class="order-head"><div style="width:48px;height:48px;border-radius:12px;overflow:hidden;flex:none">${foodArt(order.product)}</div>
    <div class="flex-1" style="min-width:0"><div class="row gap-8 wrap"><b>${esc(order.product)}</b>${statusBadge(order.status)}</div><div class="t-xs muted" style="margin-top:2px"><span class="order-id">${esc(order.id)}</span> · ${esc(date)}</div></div>
    <div style="text-align:right"><div class="t-num-lg" style="font-size:17px">${money(order.total ?? order.qty * order.price)}</div><div class="t-xs muted">${quantity(order.qty)} ${esc(order.unit)} × ${money(order.price)}</div></div></div>
    <div class="order-line wrap">${avatar(counterparty, "sm")}<span class="t-sm secondary">${isPurchase ? "From" : "To"} <b style="color:var(--text-primary)">${esc(counterparty.name)}</b></span>${counterparty.verified ? verifiedBadge() : ""}<span class="t-xs muted" style="margin-left:auto">${icon("truck", 12)} ${esc(order.pickup)}</span></div>
    ${orderTimeline(order.status)}
    ${order.counterpartyContact ? `<p class="t-xs muted" style="margin-top:12px">Coordinate pickup: <a href="mailto:${encodeURIComponent(order.counterpartyContact)}">${esc(order.counterpartyContact)}</a></p>` : ""}
    ${isPurchase && counterparty.loc ? `<p class="t-xs muted" style="margin-top:12px">${icon("mapPin", 12)} Pickup area: ${esc(counterparty.loc)}</p>` : ""}
    <p class="t-xs muted" style="margin-top:12px">${order.status === "Cancelled" ? "Reservation released. No inventory was transferred." : fulfilled(order) ? "Inventory handover recorded · payment arranged directly at pickup." : isPurchase ? "Stock reserved · pay the seller at pickup. The seller confirms handover." : "Payment is arranged directly at pickup. Confirm handover only after releasing the goods."}</p>
    ${advanceLabel || canCancel(order) ? `<div class="row gap-8 wrap" style="margin-top:14px">${advanceLabel ? `<button class="btn btn-success btn-sm" data-advance="${esc(order.id)}">${icon("check", 13)}${advanceLabel}</button>` : ""}${canCancel(order) ? `<button class="btn btn-ghost btn-sm" data-cancel="${esc(order.id)}">Cancel order</button>` : ""}</div>` : ""}
  </div>`;
}

export function render() {
  if (state.bizId !== store.get().bizId) Object.assign(state, { tab: "purchases", context: null, bizId: store.get().bizId });
  if (state.context !== location.hash) {
    state.context = location.hash;
    if (new URLSearchParams(location.hash.split("?")[1] || "").has("sales")) state.tab = "sales";
  }
  const appState = store.get();
  const orders = selectors.ordersFor(appState);
  const newestFirst = (a, b) => b.createdAt && a.createdAt ? Date.parse(b.createdAt) - Date.parse(a.createdAt) : (a.placedMins || 0) - (b.placedMins || 0);
  const purchases = orders.filter((o) => o.buyer === appState.bizId).sort(newestFirst);
  const sales = orders.filter((o) => o.seller === appState.bizId).sort(newestFirst);
  const list = state.tab === "purchases" ? purchases : sales;
  const total = (rows) => rows.filter(fulfilled).reduce((sum, o) => sum + (o.total ?? o.qty * o.price), 0);
  return `${pageHead("Orders", "Purchase reservations, seller handovers and completed transactions", `<div class="row gap-14 t-xs muted"><span>${icon("cart", 12)} Received ${fmtINR(total(purchases))}</span><span>${icon("wallet", 12)} Supplied ${fmtINR(total(sales))}</span></div>`)}
    <div class="tabs" style="margin-bottom:18px"><button class="tab ${state.tab === "purchases" ? "active" : ""}" data-tab="purchases">${icon("cart", 13)} Purchases<span class="count">${purchases.length}</span></button><button class="tab ${state.tab === "sales" ? "active" : ""}" data-tab="sales">${icon("wallet", 13)} Sales<span class="count">${sales.length}</span></button></div>
    ${list.length ? `<div class="page-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))">${list.map(orderCard).join("")}</div>` : emptyState({ icon: "receipt", title: state.tab === "purchases" ? "No purchases yet" : "No sales yet", sub: state.tab === "purchases" ? "Browse surplus published by other businesses, then reserve the quantity you need." : "Orders appear here when another business buys from your listings.", action: state.tab === "purchases" ? `<a class="btn btn-primary" href="#/app/surplus">${icon("search", 14)}Find Surplus</a>` : `<a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Listing</a>` })}`;
}

function confirmChange(order, cancel) {
  const pickup = order.status === "Ready for pickup";
  const title = cancel ? "Cancel order?" : pickup ? "Confirm inventory handover?" : order.status === "Picked up" ? "Complete order?" : "Mark order ready?";
  const body = cancel ? "This releases the reservation back to the seller. Both businesses will see the cancellation." : pickup ? `Confirm that ${quantity(order.qty)} ${esc(order.unit)} of ${esc(order.product)} has been collected. This transfers stock from your inventory to the buyer's inventory and cannot be cancelled.` : order.status === "Picked up" ? "Mark this transaction as completed. The inventory handover has already been recorded." : "The buyer will be notified that their order is ready for collection.";
  const modal = openModal(`${modalHead(title)}<div class="modal-body"><p class="t-body">${body}</p><p id="order-action-error" role="alert" class="t-sm" style="color:var(--danger);margin-top:12px"></p></div><div class="modal-foot"><button class="btn btn-ghost" data-close>Go back</button><button class="btn ${cancel ? "btn-danger" : "btn-primary"}" id="order-action-confirm">${cancel ? "Cancel order" : "Confirm"}</button></div>`);
  const button = modal.querySelector("#order-action-confirm");
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (cancel) await actions.cancelOrder(order.id); else await actions.advanceOrder(order.id);
      closeModal();
      toast(cancel ? "Order cancelled" : "Order updated", cancel ? "The reservation has been released." : pickup ? "Inventory transferred to the buyer." : "Both businesses can see the updated status.", cancel ? "info" : "success");
    } catch (err) { modal.querySelector("#order-action-error").textContent = err.message || "Unable to update this order. Please try again."; button.disabled = false; }
  });
}

export function init(root) {
  root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${render()}</div>`;
    init(content);
  }));
  root.querySelectorAll("[data-advance], [data-cancel]").forEach((button) => button.addEventListener("click", () => {
    const order = selectors.ordersFor(store.get()).find((o) => o.id === (button.dataset.advance || button.dataset.cancel));
    if (order) confirmChange(order, !!button.dataset.cancel);
  }));
}
