/* ============================================================
   OVERBYTE — App shell: router, sidebar, topbar, drawers
   ============================================================ */

import { store, actions, selectors } from "./store.js";
import { icon, logoMark, wordmark } from "./icons.js";
import { esc, agoFromMins } from "./util.js";
import { toast, dropdown, notifItem, avatar, openModal, closeModal, modalHead, confirmDialog } from "./ui.js";

import * as landing from "./pages/landing.js";
import * as auth from "./pages/auth.js";
import * as dashboard from "./pages/dashboard.js";
import * as inventory from "./pages/inventory.js";
import * as surplus from "./pages/surplus.js";
import * as mylistings from "./pages/mylistings.js";
import * as orders from "./pages/orders.js";
import * as analytics from "./pages/analytics.js";
import * as intelligence from "./pages/intelligence.js";
import * as notificationsPage from "./pages/notifications.js";
import * as settings from "./pages/settings.js";

/* ---------- Routes ---------- */
const ROUTES = [
  { re: /^#\/$/, page: landing, chrome: "public", title: "OverByte — Turn Surplus Into Supply" },
  { re: /^#\/login$/, page: auth, view: "login", chrome: "public", title: "Sign in · OverByte" },
  { re: /^#\/signup$/, page: auth, view: "signup", chrome: "public", title: "Create account · OverByte" },
  { re: /^#\/onboarding$/, page: auth, view: "onboarding", chrome: "public", title: "Onboarding · OverByte" },
  { re: /^#\/app\/dashboard$/, page: dashboard, chrome: "app", crumb: "Dashboard", navId: "dashboard", title: "Dashboard · OverByte" },
  { re: /^#\/app\/inventory$/, page: inventory, view: "list", chrome: "app", crumb: "Inventory", navId: "inventory", title: "Inventory · OverByte" },
  { re: /^#\/app\/inventory\/([\w-]+)$/, page: inventory, view: "detail", chrome: "app", crumb: "Inventory / Item", navId: "inventory", title: "Item detail · OverByte" },
  { re: /^#\/app\/surplus$/, page: surplus, view: "market", chrome: "app", crumb: "Surplus Marketplace", navId: "surplus", title: "Surplus · OverByte" },
  { re: /^#\/app\/surplus\/new$/, page: surplus, view: "create", chrome: "app", crumb: "Surplus / New Listing", navId: "surplus", title: "Create listing · OverByte" },
  { re: /^#\/app\/surplus\/([\w-]+)$/, page: surplus, view: "detail", chrome: "app", crumb: "Surplus / Listing", navId: "surplus", title: "Listing · OverByte" },
  { re: /^#\/app\/listings$/, page: mylistings, chrome: "app", crumb: "My Listings", navId: "listings", title: "My Listings · OverByte" },
  { re: /^#\/app\/orders$/, page: orders, chrome: "app", crumb: "Orders", navId: "orders", title: "Orders · OverByte" },
  { re: /^#\/app\/insights$/, page: intelligence, view: "insights", chrome: "app", crumb: "AI Intelligence / Insights", navId: "insights", title: "AI Insights · OverByte" },
  { re: /^#\/app\/predictions$/, page: intelligence, view: "predictions", chrome: "app", crumb: "AI Intelligence / Predictions", navId: "predictions", title: "Predictions · OverByte" },
  { re: /^#\/app\/analytics$/, page: analytics, chrome: "app", crumb: "Analytics", navId: "analytics", title: "Analytics · OverByte" },
  { re: /^#\/app\/notifications$/, page: notificationsPage, chrome: "app", crumb: "Notifications", navId: "notifications", title: "Notifications · OverByte" },
  { re: /^#\/app\/settings$/, page: settings, chrome: "app", crumb: "Settings", navId: "settings", title: "Settings · OverByte" },
];

const app = document.getElementById("app");
let tickerTimer = null;
let currentRoute = null;

/* ---------- Sidebar ---------- */
function sidebar(routeId) {
  const s = store.get();
  const biz = selectors.biz(s);
  const unread = selectors.unreadCount(s);
  const pending = selectors.pendingAlerts(s).length;
  const item = (href, ic, label, { id, count, sub = false } = {}) => `
    <a class="sb-item ${routeId === id ? "active" : ""} ${sub ? "sb-sub" : ""}" href="${href}">
      ${icon(ic, 17)}<span class="sb-label">${label}</span>
      ${count ? `<span class="sb-count">${count}</span>` : ""}
    </a>`;
  return `<aside class="sidebar">
    <a class="sb-logo" href="#/">${logoMark(30)}${wordmark()}</a>
    <nav class="sb-nav" aria-label="Primary">
      ${item("#/app/dashboard", "dashboard", "Dashboard", { id: "dashboard" })}
      <div class="sb-group">Operations</div>
      ${item("#/app/inventory", "package", "Inventory", { id: "inventory" })}
      ${item("#/app/surplus", "bag", "Surplus", { id: "surplus" })}
      ${item("#/app/listings", "tag", "My Listings", { id: "listings", count: selectors.myActiveListings(s).length || "" })}
      ${item("#/app/orders", "receipt", "Orders", { id: "orders" })}
      <div class="sb-group">AI Intelligence</div>
      ${item("#/app/insights", "sparkles", "Insights", { id: "insights", sub: true })}
      ${item("#/app/predictions", "trending", "Predictions", { id: "predictions", sub: true })}
      ${item("#/app/analytics", "chart", "Analytics", { id: "analytics" })}
      <div class="sb-group">Workspace</div>
      ${item("#/app/notifications", "bell", "Notifications", { id: "notifications", count: unread || "" })}
      ${item("#/app/settings", "settings", "Settings", { id: "settings" })}
    </nav>
    <div class="sb-ai">${icon("sparkles", 15)}<span class="txt"><b>AI monitoring active</b> · ${biz.name.split(" ")[0]}</span></div>
    <div class="sb-foot">
      <button class="sb-biz" id="biz-switch" aria-haspopup="menu">
        ${avatar(biz)}
        <span class="b-meta" style="min-width:0"><span class="b-name truncate" style="display:block">${esc(biz.name)}</span>
        <span class="b-type">${esc(biz.type)} · Business</span></span>
        ${icon("chevronDown", 14)}
      </button>
    </div>
  </aside>`;
}

/* ---------- Topbar ---------- */
function topbar(crumb) {
  const s = store.get();
  const unread = selectors.unreadCount(s);
  return `<header class="topbar">
    <div class="tb-crumb">${icon("mapPin", 0)}<span>${crumb.split("/").map((c, i, a) => i === a.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)} /</span>`).join(" ")}</span></div>
    <div class="flex-1"></div>
    <div class="tb-live"><span class="pulse-dot"></span>AI ACTIVE<span class="t" id="sync-ticker">sync 12s ago</span></div>
    <label class="tb-search">${icon("search", 15)}
      <input id="global-search" type="search" placeholder="Search surplus, products…" aria-label="Search marketplace"/>
      <kbd>↵</kbd>
    </label>
    <button class="tb-icon-btn" id="bell-btn" aria-label="Notifications" style="position:relative">
      ${icon("bell", 17)}${unread ? `<span class="n-badge">${unread}</span>` : ""}
    </button>
  </header>`;
}

function mobileNav(routeId) {
  const items = [
    ["#/app/dashboard", "dashboard", "Home", "dashboard"],
    ["#/app/inventory", "package", "Stock", "inventory"],
    ["#/app/surplus", "bag", "Surplus", "surplus"],
    ["#/app/orders", "receipt", "Orders", "orders"],
    ["#/app/insights", "sparkles", "AI", "insights"],
  ];
  return `<nav class="mobile-nav" aria-label="Mobile">${items.map(([href, ic, label, id]) =>
    `<a href="${href}" class="${routeId === id ? "active" : ""}">${icon(ic, 19)}<span>${label}</span></a>`).join("")}</nav>`;
}

/* ---------- Notification drawer ---------- */
function openNotifDrawer() {
  const s = store.get();
  const notifs = selectors.notificationsFor(s);
  const veil = document.createElement("div");
  veil.className = "drawer-veil"; veil.id = "drawer-veil";
  veil.innerHTML = `
    <aside class="drawer" role="dialog" aria-label="Notifications">
      <div class="drawer-head row-between">
        <div><h3 class="t-h2">Notifications</h3><p class="t-xs muted" style="margin-top:3px">${notifs.filter((n) => !n.read).length} unread · priority-ranked</p></div>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" id="mark-all">Mark all read</button>
          <button class="x-btn" id="drawer-close" aria-label="Close">${icon("x", 14)}</button>
        </div>
      </div>
      <div class="drawer-body">
        ${notifs.length ? notifs.map(notifItem).join("") : `<div class="empty"><div class="e-art">${icon("bell", 22)}</div><div class="e-title">You're all caught up</div><div class="e-sub">New AI alerts, orders and marketplace activity will appear here.</div></div>`}
      </div>
    </aside>`;
  document.body.appendChild(veil);
  veil.querySelector("#drawer-close").addEventListener("click", () => veil.remove());
  veil.addEventListener("mousedown", (e) => { if (e.target === veil) veil.remove(); });
  veil.querySelector("#mark-all").addEventListener("click", () => { actions.markAllRead(); document.getElementById("drawer-veil")?.remove(); renderRoute(); });
  veil.querySelectorAll("[data-notif]").forEach((el) =>
    el.addEventListener("click", () => { actions.markRead(el.dataset.notif); }));
  document.addEventListener("keydown", function escClose(e) {
    if (e.key === "Escape") { veil.remove(); document.removeEventListener("keydown", escClose); }
  });
}

/* ---------- Business switcher ---------- */
function bizMenu(anchor) {
  dropdown(anchor, [
    { head: "Switch business identity" },
    ...["b_gf", "b_ht"].map((id) => {
      const b = BUSINESSES_CACHE.find((x) => x.id === id);
      return { id, label: b.name, right: b.type, icon: id === store.get().bizId ? "check" : "building", onClick: () => { actions.switchBiz(id); location.hash = "#/app/dashboard"; renderRoute(); toast("Identity switched", `You are now operating as <b>${esc(b.name)}</b>`, "info"); } };
    }),
    "-",
    { id: "reset", label: "Reset demo data", icon: "refresh", onClick: () => confirmDialog({ title: "Reset demo data?", body: "All listings, orders and alerts return to their original demo state.", confirmLabel: "Reset", onConfirm: () => { store.reset(); location.hash = "#/app/dashboard"; renderRoute(); toast("Demo reset", "The original scenario has been restored.", "success"); } }) },
    { id: "logout", label: "Sign out", icon: "logout", danger: true, onClick: () => { actions.logout(); location.hash = "#/"; } },
  ], { align: "left", width: 250 });
}
import { BUSINESSES as BUSINESSES_CACHE } from "./data.js";

/* ---------- Ticker ---------- */
function startTicker() {
  stopTicker();
  let t = 12;
  tickerTimer = setInterval(() => {
    t += 1; if (t > 120) t = 3;
    const el = document.getElementById("sync-ticker");
    if (el) el.textContent = `sync ${t}s ago`;
  }, 1000);
}
function stopTicker() { if (tickerTimer) { clearInterval(tickerTimer); tickerTimer = null; } }

/* ---------- Router ---------- */
function matchRoute() {
  const h = (location.hash || "#/").split("?")[0];
  for (const r of ROUTES) {
    const m = h.match(r.re);
    if (m) return { route: r, params: m.slice(1) };
  }
  return null;
}

function renderRoute() {
  const found = matchRoute();
  if (!found) { location.hash = "#/app/dashboard"; return; }
  const { route, params } = found;
  const s = store.get();

  if (route.chrome === "app" && !s.authed) { location.hash = "#/login"; return; }

  document.title = route.title;
  currentRoute = { ...route, params };

  if (route.chrome !== "app") {
    stopTicker();
    const view = route.view || "landing";
    app.innerHTML = route.page.render
      ? route.page.render({ params, view })
      : route.page[view]({ params });
    const publicInit = route.page[`${view}Init`] || route.page.init;
    publicInit?.(app, { params, view });
    window.scrollTo(0, 0);
    return;
  }

  /* app chrome */
  const routeId = route.navId || route.crumb.toLowerCase();
  const crumb = route.crumb;

  app.innerHTML = `
    <div class="app-shell">
      ${sidebar(routeId)}
      <div class="main-col">
        ${topbar(crumb)}
        <main class="content" id="content" tabindex="-1"></main>
      </div>
    </div>
    ${mobileNav(routeId)}`;

  const content = document.getElementById("content");
  const view = route.view || "default";
  const html = route.page[view] ? route.page[view]({ params }) : route.page.render({ params, view });
  content.innerHTML = `<div class="page">${html}</div>`;
  route.page.init?.(content, { params, view });

  /* shell listeners */
  document.getElementById("bell-btn").addEventListener("click", openNotifDrawer);
  document.getElementById("biz-switch").addEventListener("click", (e) => bizMenu(e.currentTarget));
  const search = document.getElementById("global-search");
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && search.value.trim()) {
      window.dispatchEvent(new CustomEvent("ob-search", { detail: search.value.trim() }));
      if (!location.hash.startsWith("#/app/surplus")) location.hash = "#/app/surplus";
      search.blur();
    }
  });

  startTicker();
  window.scrollTo(0, 0);
}

/* re-render on store change, preserving scroll */
let lastScroll = 0;
store.subscribe(() => {
  lastScroll = window.scrollY;
  renderRoute();
  requestAnimationFrame(() => window.scrollTo(0, lastScroll));
});

window.addEventListener("hashchange", renderRoute);
renderRoute();

/* Simulated marketplace liveliness (subtle, non-destructive) */
setInterval(() => {
  const s = store.get();
  if (!s.authed) return;
  const route = location.hash;
  if (!(route.startsWith("#/app/dashboard") || route.startsWith("#/app/surplus"))) return;
  if (document.querySelector(".modal-veil")) return;
  if (Math.random() > 0.4) return;
  const events = [
    ["MARKETPLACE", "New surplus nearby", "Harvest Table listed 20 kg Chicken Breast at ₹195/kg · 2.8 km away."],
    ["MARKETPLACE", "Price drop", "FreshLine Grocers reduced Tomatoes to ₹64/kg · 3.5 km away."],
    ["AI ALERT", "Demand shift detected", "Milk consumption is running 9% above forecast today — forecast updated."],
  ];
  const [kind, title, body] = events[Math.floor(Math.random() * events.length)];
  s.notifications.unshift({ id: `n_${Math.random().toString(36).slice(2, 8)}`, biz: s.bizId, kind, prio: kind === "AI ALERT" ? "high" : "medium", title, body, mins: 0, read: false });
  persistHack();
  toast(title, body, kind === "AI ALERT" ? "ai" : "info");
}, 34000);

function persistHack() {
  // emit-less persistence to avoid interrupting the current view
  try { sessionStorage.setItem("overbyte_state_v1", JSON.stringify(store.get())); } catch (e) { /* ignore */ }
}
