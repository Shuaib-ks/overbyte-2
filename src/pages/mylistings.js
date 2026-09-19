/* Seller listings, backed by account-owned records. */
import { icon, foodArt } from "../icons.js";
import { fmtINR, fmtNum, fmtShelf, esc } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, statusBadge, emptyState, toast, openModal, modalHead, closeModal } from "../ui.js";

const state = { tab: "Active", bizId: null };
const quantity = (value) => fmtNum(value, Number(value) % 1 ? 2 : 0);
const money = (value) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function cards(list) {
  if (!list.length) return emptyState({
    icon: "tag", title: state.tab === "All" ? "No listings yet" : `No ${state.tab.toLowerCase()} listings`,
    sub: "Create a listing from available inventory, or review a surplus recommendation. Only listings you publish will appear on the marketplace.",
    action: `<a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Surplus Listing</a>`,
  });
  const orders = selectors.ordersFor(store.get()).filter((o) => o.seller === store.get().bizId);
  return `<div class="page-grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))">${list.map((l) => {
    const remaining = Number(l.qtyRemaining ?? l.qty);
    const listingOrders = orders.filter((o) => (o.listingId || o.listing) === l.id);
    const fulfilled = listingOrders.filter((o) => ["Picked up", "Completed"].includes(o.status)).reduce((sum, o) => sum + o.qty, 0);
    const reserved = listingOrders.filter((o) => !["Picked up", "Completed", "Cancelled"].includes(o.status)).reduce((sum, o) => sum + o.qty, 0);
    const canCancel = ["Active", "Reserved", "Draft"].includes(l.status);
    return `<div class="card card-hover" style="padding:18px"><div class="row gap-12">
      <div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex:none">${foodArt(l.product)}</div>
      <div class="flex-1" style="min-width:0"><div class="row gap-8 wrap"><b>${esc(l.product)}</b>${statusBadge(l.status || "Active")}</div><div class="t-xs muted" style="margin-top:2px">${quantity(remaining)} ${esc(l.unit)} available of ${quantity(l.qty)} · ${money(l.price)}/${esc(l.unit)}</div></div>
      <div class="t-num-lg" style="font-size:16px">${money(remaining * l.price)}</div></div>
      <div class="row gap-14 wrap" style="margin-top:14px;font-size:11.5px;color:var(--text-muted)"><span>${icon("clock", 12)}${l.shelfHours > 0 ? `${fmtShelf(l.shelfHours)} until expiry` : "Expired"}</span><span>${icon("truck", 12)}${esc(l.pickup)}</span></div>
      <div class="row gap-14 wrap t-xs secondary" style="margin-top:12px"><span>${quantity(reserved)} ${esc(l.unit)} awaiting pickup</span><span>${quantity(fulfilled)} ${esc(l.unit)} handed over</span></div>
      <div class="progress" style="margin-top:12px" role="img" aria-label="${Math.round(fulfilled / Math.max(0.01, l.qty) * 100)} percent fulfilled"><i style="width:${Math.min(100, Math.round(fulfilled / Math.max(0.01, l.qty) * 100))}%;background:var(--success)"></i></div>
      <div class="row gap-8 wrap" style="margin-top:14px"><a class="btn btn-secondary btn-sm" href="#/app/surplus/${encodeURIComponent(l.id)}">${icon("eye", 13)}View</a>${canCancel ? `<button class="btn btn-ghost btn-sm" data-cancel="${esc(l.id)}">${icon("trash", 13)}Cancel listing</button>` : ""}${reserved > 0 ? '<a class="btn btn-ghost btn-sm" href="#/app/orders?sales=1">Manage pickups</a>' : ""}</div>
    </div>`;
  }).join("")}</div>`;
}

export function render() {
  const appState = store.get();
  if (state.bizId !== appState.bizId) Object.assign(state, { tab: "Active", bizId: appState.bizId });
  const all = selectors.myActiveListings(appState);
  const tabs = ["Active", "Reserved", "Sold", "Expired", "Cancelled", "All"].map((name) => [name, name === "All" ? all.length : all.filter((l) => l.status === name).length]);
  const list = state.tab === "All" ? all : all.filter((l) => (l.status || "Active") === state.tab);
  const revenue = selectors.ordersFor(appState).filter((o) => o.seller === appState.bizId && ["Picked up", "Completed"].includes(o.status)).reduce((sum, o) => sum + (o.total ?? o.qty * o.price), 0);
  return `${pageHead("My Listings", `${all.length} listings · ${fmtINR(revenue)} handed over`, `<a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Listing</a>`)}
    <div class="tabs" style="margin-bottom:18px;flex-wrap:wrap">${tabs.map(([name, count]) => `<button class="tab ${state.tab === name ? "active" : ""}" data-tab="${name}">${name}<span class="count">${count}</span></button>`).join("")}</div>${cards(list)}`;
}

export function init(root) {
  root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${render()}</div>`;
    init(content);
  }));
  root.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => {
    const modal = openModal(`${modalHead("Cancel this listing?")}<div class="modal-body"><p class="t-body">New purchases will stop immediately. Any existing reserved orders still need to be fulfilled or cancelled from Orders. Unreserved stock stays in your inventory.</p><p role="alert" id="cancel-error" class="t-sm" style="color:var(--danger);margin-top:10px"></p></div><div class="modal-foot"><button class="btn btn-ghost" data-close>Keep listing</button><button class="btn btn-danger" id="confirm-cancel">Cancel listing</button></div>`);
    const confirm = modal.querySelector("#confirm-cancel");
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      try { await actions.cancelListing(button.dataset.cancel); closeModal(); toast("Listing cancelled", "The listing is no longer accepting purchases.", "info"); }
      catch (err) { modal.querySelector("#cancel-error").textContent = err.message || "Unable to cancel listing."; confirm.disabled = false; }
    });
  }));
}
