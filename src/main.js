/* ============================================================
   OVERBYTE — App shell: router, sidebar, topbar, drawers
   ============================================================ */

import { store, actions, selectors } from "./store.js";
import { icon, logoMark, wordmark } from "./icons.js";
import { esc } from "./util.js";
import { toast, dropdown, notifItem, avatar, openModal, modalHead, closeModal } from "./ui.js";

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
let currentRoute = null;
let ready = false;
let refreshing = false;
let refreshError = "";
let dirtyForm = false;
let renderedHash = "";
let drawerEvents;

/* ---------- Sidebar ---------- */
function sidebar(routeId) {
  const s = store.get();
  const biz = selectors.biz(s);
  const unread = selectors.unreadCount(s);
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
    <div class="sb-ai">${icon("sparkles", 15)}<span class="txt"><b>Inventory intelligence</b> · ${esc(biz.name.split(" ")[0])}</span></div>
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
  const compact = window.matchMedia("(max-width: 820px)").matches;
  const crumbs = compact ? [crumb.split("/").at(-1)] : crumb.split("/");
  return `<header class="topbar" ${compact ? 'style="gap:8px"' : ""}>
    <div class="tb-crumb" style="min-width:0"><span class="truncate">${crumbs.map((c, i, a) => i === a.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)} /</span>`).join(" ")}</span></div>
    <div class="flex-1"></div>
    <button type="button" class="btn btn-ghost btn-sm tb-live" id="sync-status" title="Refresh workspace data" aria-label="Refresh workspace data" style="flex:none;${compact ? "width:32px;padding:0" : ""}">${compact ? icon("refresh", 14) : '<span class="pulse-dot"></span>'}<span id="sync-ticker" ${compact ? 'hidden style="display:none"' : ""}>${esc(syncLabel())}</span></button>
    ${compact ? `<button class="tb-icon-btn" id="mobile-search-btn" aria-label="Search surplus" style="flex:none">${icon("search", 17)}</button>` : `<label class="tb-search">${icon("search", 15)}
      <input id="global-search" type="search" placeholder="Search surplus, products…" aria-label="Search marketplace"/>
      <kbd>↵</kbd>
    </label>`}
    <button class="tb-icon-btn" id="bell-btn" aria-label="Notifications" style="position:relative;flex:none">
      ${icon("bell", 17)}${unread ? `<span class="n-badge">${unread}</span>` : ""}
    </button>
    <button class="tb-icon-btn" id="account-menu-btn" aria-label="Business account menu" aria-haspopup="menu" style="flex:none">${icon("building", 17)}</button>
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
  drawerEvents?.abort();
  drawerEvents = new AbortController();
  const eventSignal = drawerEvents.signal;
  const s = store.get();
  const priorities = { critical: 0, high: 1, medium: 2, info: 3 };
  const notifs = [...selectors.notificationsFor(s)].sort((a, b) => (priorities[a.prio] ?? 3) - (priorities[b.prio] ?? 3) || (a.mins || 0) - (b.mins || 0));
  document.getElementById("drawer-veil")?.remove();
  const veil = document.createElement("div");
  veil.className = "drawer-veil"; veil.id = "drawer-veil";
  veil.innerHTML = `
    <aside class="drawer" role="dialog" aria-label="Notifications">
      <div class="drawer-head row-between">
        <div><h3 class="t-h2">Notifications</h3><p class="t-xs muted" style="margin-top:3px">${notifs.filter((n) => !n.read).length} unread · priority-ranked</p></div>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" id="mark-all" ${notifs.some((item) => !item.read) ? "" : "disabled"}>Mark all read</button>
          <button class="x-btn" id="drawer-close" aria-label="Close">${icon("x", 14)}</button>
        </div>
      </div>
      <div class="drawer-body">
        ${notifs.length ? notifs.map(notifItem).join("") : `<div class="empty"><div class="e-art">${icon("bell", 22)}</div><div class="e-title">You're all caught up</div><div class="e-sub">New AI alerts, orders and marketplace activity will appear here.</div></div>`}
      </div>
    </aside>`;
  document.body.appendChild(veil);
  const dismiss = () => { veil.remove(); drawerEvents?.abort(); };
  veil.querySelector("#drawer-close").addEventListener("click", dismiss);
  veil.addEventListener("mousedown", (e) => { if (e.target === veil) dismiss(); });
  veil.querySelector("#mark-all").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await actions.markAllRead(); openNotifDrawer(); }
    catch (error) { button.disabled = false; toast("Could not update notifications", esc(error.message), "error"); }
  });
  veil.querySelectorAll("[data-notif]").forEach((el) =>
    el.addEventListener("click", async () => {
      if (el.dataset.pending) return;
      el.dataset.pending = "true";
      try { await actions.markRead(el.dataset.notif); openNotifDrawer(); }
      catch (error) { toast("Could not update notification", esc(error.message), "error"); }
      finally { delete el.dataset.pending; }
    }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") dismiss(); }, { signal: eventSignal });
}

/* ---------- Signed-in account ---------- */
function bizMenu(anchor) {
  dropdown(anchor, [
    { head: selectors.biz()?.name || "Your business" },
    { id: "profile", label: "Business profile & settings", icon: "settings", onClick: () => { location.hash = "#/app/settings"; } },
    "-",
    { id: "logout", label: "Sign out", icon: "logout", danger: true, onClick: async () => {
      try { await actions.logout(); closeModal(); document.getElementById("drawer-veil")?.remove(); location.hash = "#/login"; }
      catch (error) { toast("Could not sign out", esc(error.message), "error"); }
    } },
  ], { align: anchor.id === "account-menu-btn" ? "right" : "left", width: 250 });
}

/* ---------- Server synchronization ---------- */
function syncLabel() {
  if (refreshError) return "Sync interrupted · Retry";
  if (refreshing) return "Syncing…";
  const timestamp = new Date(store.get().syncAt || store.get().syncedAt || "").getTime();
  if (!Number.isFinite(timestamp)) return "Not synced yet";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  return seconds < 60 ? `Synced ${seconds}s ago` : `Synced ${Math.floor(seconds / 60)}m ago`;
}
function updateSyncLabel() {
  const label = document.getElementById("sync-ticker");
  if (label) label.textContent = syncLabel();
  const button = document.getElementById("sync-status");
  if (button) { button.disabled = refreshing; button.title = refreshError || "Refresh workspace data"; button.style.color = refreshError ? "var(--danger)" : ""; }
}
async function refreshWorkspace() {
  if (!ready || !store.get().authed || refreshing) return;
  refreshing = true;
  updateSyncLabel();
  try { await actions.refresh(); refreshError = ""; }
  catch (error) { refreshError = error?.message || "Unable to synchronize workspace data."; }
  finally { refreshing = false; updateSyncLabel(); }
}

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
  if (!ready) return;
  const found = matchRoute();
  if (!found) { location.hash = "#/app/dashboard"; return; }
  const { route, params } = found;
  const s = store.get();

  if (route.chrome === "app" && !s.authed) { location.hash = "#/login"; return; }
  if (route.view === "onboarding" && !s.authed) { location.hash = "#/signup"; return; }
  if (route.chrome === "app" && !s.onboarded) { location.hash = "#/onboarding"; return; }
  if (renderedHash !== location.hash) {
    closeModal();
    drawerEvents?.abort();
    document.getElementById("drawer-veil")?.remove();
    document.querySelectorAll(".menu").forEach((menu) => menu.remove());
  }
  renderedHash = location.hash;
  dirtyForm = false;

  document.title = route.title;
  currentRoute = { ...route, params };

  if (route.chrome !== "app") {
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
  document.getElementById("account-menu-btn").addEventListener("click", (e) => bizMenu(e.currentTarget));
  document.getElementById("sync-status").addEventListener("click", refreshWorkspace);
  document.getElementById("mobile-search-btn")?.addEventListener("click", () => {
    const modal = openModal(`${modalHead("Find surplus")}<form id="mobile-search-form"><div class="modal-body"><div class="field"><label for="mobile-search-input">Product or seller</label><input class="input" id="mobile-search-input" name="query" type="search" required placeholder="Search surplus, products…" maxlength="200"></div></div><div class="modal-foot"><button class="btn btn-primary" type="submit">Search marketplace</button></div></form>`);
    modal.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const query = event.currentTarget.elements.query.value.trim();
      if (query) { closeModal(); location.hash = `#/app/surplus?q=${encodeURIComponent(query)}`; }
    });
  });
  const search = document.getElementById("global-search");
  search?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && search.value.trim()) {
      location.hash = `#/app/surplus?q=${encodeURIComponent(search.value.trim())}`;
      search.blur();
    }
  });

  updateSyncLabel();
  window.scrollTo(0, 0);
}

/* re-render on store change, preserving scroll */
store.subscribe((state, meta = {}) => {
  if (!ready) return;
  updateSyncLabel();
  if (currentRoute?.chrome !== "app") return;
  if (state.authed && meta.background && (dirtyForm || document.querySelector(".modal-veil, .drawer-veil, .menu") || document.activeElement?.matches("input, select, textarea, [contenteditable='true']") || document.querySelector("form"))) return;
  const lastScroll = window.scrollY;
  renderRoute();
  requestAnimationFrame(() => window.scrollTo(0, lastScroll));
});

window.addEventListener("hashchange", renderRoute);
app.addEventListener("input", (event) => { if (event.target.closest("form") || event.target.isContentEditable) dirtyForm = true; });
app.addEventListener("change", (event) => { if (event.target.closest("form")) dirtyForm = true; });

async function bootstrap() {
  ready = false;
  app.innerHTML = `<main class="auth-wrap"><div class="auth-left"><a href="#/" class="auth-brand-row">${logoMark(30)}${wordmark()}</a><div class="auth-panel"><h1>Opening your workspace</h1><p class="sub" role="status">Connecting to OverByte…</p></div></div></main>`;
  try {
    await actions.bootstrap();
    ready = true;
    renderRoute();
  } catch (error) {
    app.innerHTML = `<main class="auth-wrap"><div class="auth-left"><a href="#/" class="auth-brand-row">${logoMark(30)}${wordmark()}</a><div class="auth-panel"><h1>Connection interrupted</h1><p class="sub" role="alert">${esc(error?.message || "OverByte could not connect to your workspace. Please try again.")}</p><button type="button" class="btn btn-primary" id="retry-connection">${icon("refresh", 15)}Try again</button></div></div></main>`;
    document.getElementById("retry-connection").addEventListener("click", bootstrap);
  }
}
bootstrap();
setInterval(() => { updateSyncLabel(); if (!document.hidden) refreshWorkspace(); }, 15000);
window.addEventListener("online", refreshWorkspace);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshWorkspace(); });
window.matchMedia("(max-width: 820px)").addEventListener("change", () => {
  if (!ready || dirtyForm || document.querySelector(".modal-veil, .drawer-veil")) return;
  const scroll = window.scrollY;
  renderRoute();
  requestAnimationFrame(() => window.scrollTo(0, scroll));
});
