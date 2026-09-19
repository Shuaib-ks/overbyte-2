/* ============================================================
   OVERBYTE — Notification center
   Priority-ranked AI, marketplace, order and sensor activity.
   ============================================================ */

import { icon } from "../icons.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, emptyState, toast } from "../ui.js";
import { esc, agoFromMins } from "../util.js";

const view = { filter: "all" };
const FILTERS = [
  ["all", "All activity"],
  ["unread", "Unread"],
  ["AI ALERT", "AI alerts"],
  ["SHORTAGE", "Shortages"],
  ["MARKETPLACE", "Marketplace"],
  ["ORDER", "Orders"],
  ["LISTING", "Listings"],
  ["INVENTORY", "Inventory"],
  ["SENSOR", "Sensors"],
];

function filteredNotifications() {
  const priorities = { critical: 0, high: 1, medium: 2, info: 3, informational: 3 };
  const notifications = [...selectors.notificationsFor(store.get())].sort((a, b) =>
    (priorities[a.prio] ?? 3) - (priorities[b.prio] ?? 3) ||
    Number(a.read) - Number(b.read) ||
    (a.createdAt && b.createdAt ? new Date(b.createdAt) - new Date(a.createdAt) : (a.mins || 0) - (b.mins || 0)));
  if (view.filter === "all") return notifications;
  if (view.filter === "unread") return notifications.filter((n) => !n.read);
  return notifications.filter((n) => n.kind === view.filter);
}

function notificationRow(notification) {
  const tone = {
    "AI ALERT": ["var(--primary-dim)", "var(--primary-strong)", "sparkles"],
    MARKETPLACE: ["var(--info-dim)", "var(--info)", "bag"],
    SHORTAGE: ["var(--warning-dim)", "var(--warning)", "alertTriangle"],
    ORDER: ["var(--success-dim)", "var(--success)", "cart"],
    SENSOR: ["var(--danger-dim)", "var(--danger)", "thermometer"],
  }[notification.kind] || ["var(--info-dim)", "var(--info)", "bell"];
  const priorityClass = { critical: "badge-high", high: "badge-medium", medium: "badge-info", info: "badge-neutral" }[notification.prio] || "badge-neutral";
  const timestamp = notification.createdAt ? new Date(notification.createdAt).getTime() : NaN;
  const mins = Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 60000) : Number(notification.mins || 0);
  const time = agoFromMins(mins);
  return `<button class="notif notif-page ${notification.read ? "" : "unread"}" type="button" data-notif="${esc(notification.id)}" aria-label="${notification.read ? "Read notification:" : "Mark as read:"} ${esc(notification.title)}">
    <span class="n-icon" style="background:${tone[0]};color:${tone[1]}">${icon(tone[2], 15)}</span>
    <span class="flex-1" style="min-width:0;text-align:left"><span class="row gap-8"><span class="n-kind">${esc(notification.kind)}</span><span class="badge ${priorityClass}" style="height:17px;font-size:9.5px">${esc(notification.prio)}</span></span><span class="n-title">${esc(notification.title)}</span><span class="n-body">${esc(notification.body)}</span></span>
    <span class="col gap-6" style="align-items:flex-end;flex:none"><span class="n-time">${time}</span>${notification.read ? "" : '<span class="n-unread-dot"></span>'}</span>
  </button>`;
}

function activityStream(notifications) {
  if (!notifications.length) {
    return emptyState({
      icon: "bell",
      title: view.filter === "unread" ? "You’re all caught up" : "Nothing here yet",
      sub: view.filter === "unread"
        ? "New AI alerts, marketplace movement and pickup updates will appear here."
        : "OverByte will keep this feed updated as your inventory and marketplace activity changes.",
    });
  }
  return `<div class="card" style="padding:8px">${notifications.map(notificationRow).join("")}</div>`;
}

export function render() {
  const all = selectors.notificationsFor(store.get());
  const unread = all.filter((n) => !n.read).length;
  const critical = all.filter((n) => !n.read && n.prio === "critical").length;
  const notifications = filteredNotifications();

  return `
    ${pageHead("Notifications", "AI signals, marketplace movement and operational updates in one place", `
      <div class="row gap-10 wrap">
        <span class="tb-live">${unread} UNREAD</span>
        <button class="btn btn-secondary btn-sm" id="mark-all-read" ${unread ? "" : "disabled"}>${icon("check", 13)}Mark all read</button>
      </div>`)}

    <div class="dash-grid" style="margin-bottom:20px">
      <div class="span-3 card" style="padding:18px"><div class="t-cap">Requires attention</div><div class="t-num-lg" style="margin-top:6px;color:var(--primary-strong)">${unread}</div><div class="t-xs muted" style="margin-top:3px">unread updates</div></div>
      <div class="span-3 card" style="padding:18px"><div class="t-cap">Critical signals</div><div class="t-num-lg" style="margin-top:6px;color:${critical ? "var(--danger)" : "var(--success)"}">${critical}</div><div class="t-xs muted" style="margin-top:3px">inventory or supply impact</div></div>
      <div class="span-6 card ai-panel" style="padding:18px"><div class="row gap-10"><span class="pulse-dot violet"></span><div><div class="t-sm" style="font-weight:580">OverByte is prioritizing by impact</div><div class="t-xs muted" style="margin-top:3px">Critical expiry and shortage signals are surfaced before routine marketplace updates.</div></div></div></div>
    </div>

    <div class="settings-layout" style="grid-template-columns:220px minmax(0,1fr)">
      <aside class="settings-nav card" style="padding:8px">
        ${FILTERS.map(([id, label]) => {
          const count = id === "all" ? all.length : id === "unread" ? unread : all.filter((n) => n.kind === id).length;
          return `<button type="button" class="${view.filter === id ? "active" : ""}" data-filter="${id}"><span>${label}</span><span class="t-num muted" style="float:right;font-size:10px">${count}</span></button>`;
        }).join("")}
      </aside>
      <section>
        <div class="row-between" style="margin-bottom:12px"><div class="t-cap">${view.filter === "all" ? "Priority-ranked activity" : (FILTERS.find((x) => x[0] === view.filter) || ["", ""])[1]}</div><span class="t-xs muted">${notifications.length} shown</span></div>
        ${activityStream(notifications)}
      </section>
    </div>`;
}

export function init(root) {
  root.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    view.filter = button.dataset.filter;
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${render()}</div>`;
    init(content);
  }));

  root.querySelector("#mark-all-read")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await actions.markAllRead();
      toast("Notifications cleared", "All activity has been marked as read.", "success");
    } catch (cause) {
      toast("Could not mark notifications as read", esc(cause?.message || "Please try again."), "error");
      button.disabled = false;
    }
  });

  root.querySelectorAll("[data-notif]").forEach((button) => button.addEventListener("click", async () => {
    const notification = selectors.notificationsFor(store.get()).find((n) => n.id === button.dataset.notif);
    if (notification && !notification.read) {
      button.disabled = true;
      try {
        await actions.markRead(notification.id);
        toast("Marked as read", esc(notification.title), "info");
      } catch (cause) { toast("Could not mark as read", esc(cause?.message || "Please try again."), "error"); }
      finally { button.disabled = false; }
    }
  }));
}
