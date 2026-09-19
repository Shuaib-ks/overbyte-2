/* ============================================================
   OVERBYTE — My Listings (seller dashboard)
   ============================================================ */

import { icon, foodArt } from "../icons.js";
import { fmtINR, fmtNum, esc } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, statusBadge, emptyState, toast, confirmDialog } from "../ui.js";

const state = { tab: "Active" };

function cards(list) {
  if (!list.length) return emptyState({
    icon: "tag", title: state.tab === "Active" ? "No active listings" : `No ${state.tab.toLowerCase()} listings`,
    sub: "Publish surplus when AI detects it, or create a listing manually — nearby businesses usually match within hours.",
    action: `<a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Surplus Listing</a>`,
  });
  return `<div class="page-grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
    ${list.map((l) => {
      const remaining = l.qtyRemaining ?? l.qty;
      const shelf = l.shelfHours >= 24 ? `${Math.floor(l.shelfHours / 24)}d ${l.shelfHours % 24}h` : `~${l.shelfHours}h`;
      return `<div class="card card-hover" style="padding:18px">
      <div class="row gap-12">
        <div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex:none">${foodArt(l.product)}</div>
        <div class="flex-1" style="min-width:0">
          <div class="row gap-8 wrap"><b>${esc(l.product)}</b>${statusBadge(l.status || "Active")}</div>
          <div class="t-xs muted" style="margin-top:2px">${fmtNum(remaining)} ${l.unit} remaining of ${l.qty} · ₹${l.price}/${l.unit}</div>
        </div>
        <div class="t-num-lg" style="font-size:16px">${fmtINR(remaining * l.price)}</div>
      </div>
      <div class="row gap-14 wrap" style="margin-top:14px;font-size:11.5px;color:var(--text-muted)">
        <span>${icon("clock", 12)}Expires in ${shelf}</span>
        <span>${icon("eye", 12)}${l.views} views</span>
        <span>${icon("user", 12)}${l.interested} interested</span>
        <span>${icon("truck", 12)}${esc(l.pickup)}</span>
      </div>
      <div class="progress" style="margin-top:12px"><i style="width:${Math.round((1 - remaining / l.qty) * 100)}%;background:${remaining === 0 ? "var(--success)" : "var(--primary)"}"></i></div>
      <div class="row gap-8" style="margin-top:14px">
        <a class="btn btn-secondary btn-sm" href="#/app/surplus/${l.id}">${icon("eye", 13)}View</a>
        ${(l.status || "Active") !== "Sold" && remaining > 0 ? `<button class="btn btn-ghost btn-sm" data-cancel="${l.id}">${icon("trash", 13)}Cancel</button>` : ""}
        ${remaining === 0 ? `<span class="t-xs" style="color:var(--success);margin-left:auto">${icon("checkCircle", 12)} Fully sold</span>` : ""}
      </div>
    </div>`;
    }).join("")}
  </div>`;
}

export function render() {
  const s = store.get();
  const all = selectors.myActiveListings(s);
  const tabs = [["Active", all.filter((l) => (l.status || "Active") === "Active").length],
    ["Reserved", all.filter((l) => l.status === "Reserved").length],
    ["Sold", all.filter((l) => l.status === "Sold").length],
    ["All", all.length]];
  const list = state.tab === "All" ? all : all.filter((l) => (l.status || "Active") === state.tab);
  const revenue = all.reduce((a, l) => a + (l.qty - (l.qtyRemaining ?? l.qty)) * l.price, 0);

  return `
    ${pageHead("My Listings", `${all.length} listings · ${fmtINR(revenue)} recovered so far`, `
      <a class="btn btn-primary" href="#/app/surplus/new">${icon("plus", 14)}Create Listing</a>`)}
    <div class="tabs" style="margin-bottom:18px">
      ${tabs.map(([t, n]) => `<button class="tab ${state.tab === t ? "active" : ""}" data-tab="${t}">${t}<span class="count">${n}</span></button>`).join("")}
    </div>
    ${cards(list)}`;
}

export function init(root) {
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${render()}</div>`;
    init(content);
  }));
  root.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => {
    confirmDialog({
      title: "Cancel listing?",
      body: "The listing will be removed from the marketplace immediately. Remaining quantity stays in your inventory.",
      confirmLabel: "Cancel listing",
      onConfirm: () => {
        actions.cancelListing(b.dataset.cancel);
        toast("Listing cancelled", "Removed from the marketplace.", "info");
      },
    });
  }));
}
