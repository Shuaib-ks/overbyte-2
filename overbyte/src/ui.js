/* ============================================================
   OVERBYTE — Shared UI components
   ============================================================ */

import { icon, foodArt } from "./icons.js";
import { esc, fmtINR, fmtQty, RISK_META } from "./util.js";

/* ---------- Brand ---------- */
export function logoMark(size = 30) {
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#9a8fff"/><stop offset="100%" stop-color="#5b48e8"/>
      </linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="url(#lgm)" opacity="0.16"/>
    <rect x="1.5" y="1.5" width="37" height="37" rx="10" stroke="url(#lgm)" stroke-width="1.6"/>
    <path d="M12 14l6 6-6 6" stroke="url(#lgm)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M21.5 26h7" stroke="#22d3ee" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="28.5" cy="14.5" r="2.5" fill="url(#lgm)"/>
  </svg>`;
}

export const wordmark = () => `<span class="wordmark">Over<i>Byte</i></span>`;

/* ---------- Badges ---------- */
export function riskBadge(risk) {
  const m = RISK_META[risk] || RISK_META.low;
  return `<span class="badge ${m.badge}"><span class="dot"></span>${m.label}</span>`;
}
export function riskPill(risk) {
  const m = RISK_META[risk] || RISK_META.low;
  const label = risk === "high" ? "HIGH" : risk === "medium" ? "MEDIUM" : "LOW";
  return `<span class="badge ${m.badge}">${label}</span>`;
}
export function statusBadge(status) {
  const map = {
    "Active": "badge-safe", "Reserved": "badge-info", "Sold": "badge-violet", "Draft": "badge-neutral",
    "Expired": "badge-neutral", "Cancelled": "badge-high", "Completed": "badge-safe",
    "Ready for pickup": "badge-info", "Awaiting pickup": "badge-medium", "Picked up": "badge-violet",
    "Healthy": "badge-safe", "Watch": "badge-medium", "Surplus risk": "badge-high", "Shortage": "badge-info",
    "pending": "badge-medium", "published": "badge-safe", "dismissed": "badge-neutral",
  };
  return `<span class="badge ${map[status] || "badge-neutral"}">${esc(status)}</span>`;
}
export const verifiedBadge = () =>
  `<span class="verified" title="Verified business">${icon("shieldCheck", 13)}</span>`;

/* ---------- Avatar ---------- */
export function avatar(biz, size = "") {
  const initials = biz.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return `<span class="avatar ${size} hue-${biz.hue ?? 0}" title="${esc(biz.name)}">${initials}</span>`;
}

/* ---------- Metric card ---------- */
export function metricCard({ label, value, delta, deltaDir, foot, spark, icon: ic, accent }) {
  return `<div class="card card-hover metric">
    <div class="m-label">${ic ? icon(ic, 13) : ""}${label}</div>
    <div class="m-value" ${accent ? `style="color:${accent}"` : ""}>${value}</div>
    <div class="m-foot">${delta ? `<span class="delta ${deltaDir}">${deltaDir === "up" ? "↓" : deltaDir === "down" ? "↑" : ""}${delta}</span>` : ""}<span>${foot || ""}</span></div>
    ${spark ? `<span class="m-spark">${spark}</span>` : ""}
  </div>`;
}

/* ---------- Match visuals ---------- */
export function matchTag(match, label = "AI MATCH") {
  return `<span class="match-tag" title="OverByte match score">
    ${icon("sparkles", 11)}${label} ${match.score}%
    <span class="mt-bar"><i style="width:${match.score}%"></i></span>
  </span>`;
}

export function matchRing(score, size = 84, stroke = 8) {
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  return `<span class="match-ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#9a8fff" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <span class="mr-val" style="font-size:${size * 0.24}px">${score}%</span>
  </span>`;
}

export function matchReasons(reasons) {
  return `<div class="ld-why">
    <div class="t-cap" style="margin-bottom:6px">Why this matches</div>
    ${reasons.map((r) => `<div class="why-row">${icon("check", 13)}<span>${esc(r)}</span></div>`).join("")}
  </div>`;
}

/* ---------- AI block ---------- */
export function aiHeader(text = "OVERBYTE AI") {
  return `<span class="ai-chip">${icon("sparkles", 11)}${text}</span>`;
}
export function aiRec(text, action = "") {
  return `<div class="ai-rec">${icon("sparkles", 14)}<div>${text}${action ? `<div style="margin-top:8px">${action}</div>` : ""}</div></div>`;
}

/* ---------- Modal manager ---------- */
let modalRoot;
function ensureModalRoot() {
  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    document.body.appendChild(modalRoot);
  }
}
export function openModal(html, { wide = false, onClose } = {}) {
  ensureModalRoot();
  modalRoot.innerHTML = `
    <div class="modal-veil" data-veil>
      <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>
    </div>`;
  const veil = modalRoot.querySelector("[data-veil]");
  veil.addEventListener("mousedown", (e) => { if (e.target === veil) closeModal(onClose); });
  modalRoot.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(onClose)));
  return modalRoot.querySelector(".modal");
}
export function closeModal(cb) {
  if (modalRoot) modalRoot.innerHTML = "";
  if (cb) cb();
}
export const modalHead = (title, sub = "") => `
  <div class="modal-head"><div><h3 class="t-h2">${title}</h3>${sub ? `<p class="t-sm muted" style="margin-top:4px">${sub}</p>` : ""}</div>
  <button class="x-btn" data-close aria-label="Close">${icon("x", 14)}</button></div>`;

export function confirmDialog({ title, body, confirmLabel = "Confirm", tone = "danger", onConfirm }) {
  openModal(`
    ${modalHead(title)}
    <div class="modal-body"><p class="t-body">${body}</p></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"}" data-confirm>${confirmLabel}</button>
    </div>`);
  document.querySelector("[data-confirm]").addEventListener("click", () => { closeModal(); onConfirm?.(); });
}

/* ---------- Toasts ---------- */
let toastRoot;
export function toast(title, msg = "", kind = "success", timeout = 4200) {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toasts";
    document.body.appendChild(toastRoot);
  }
  const icons = { success: "checkCircle", info: "info", ai: "sparkles", warn: "alertTriangle", error: "alertCircle" };
  const tones = {
    success: ["var(--success-dim)", "var(--success)"], info: ["var(--info-dim)", "var(--info)"],
    ai: ["var(--primary-dim)", "var(--primary-strong)"], warn: ["var(--warning-dim)", "var(--warning)"],
    error: ["var(--danger-dim)", "var(--danger)"],
  };
  const [bg, fg] = tones[kind] || tones.info;
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <span class="t-icon" style="background:${bg};color:${fg}">${icon(icons[kind] || "info", 15)}</span>
    <div style="min-width:0"><div class="t-title">${esc(title)}</div>${msg ? `<div class="t-msg">${msg}</div>` : ""}</div>
    <button class="t-close" aria-label="Dismiss">${icon("x", 13)}</button>`;
  toastRoot.appendChild(el);
  const kill = () => { el.classList.add("out"); setTimeout(() => el.remove(), 180); };
  el.querySelector(".t-close").addEventListener("click", kill);
  if (timeout) setTimeout(kill, timeout);
}

/* ---------- Empty state ---------- */
export function emptyState({ icon: ic = "inbox", title, sub, action = "" }) {
  return `<div class="empty">
    <div class="e-art">${icon(ic, 26)}</div>
    <div class="e-title">${title}</div>
    <div class="e-sub">${sub}</div>
    ${action}
  </div>`;
}

/* ---------- Page head ---------- */
export function pageHead(title, sub = "", actionsHtml = "") {
  return `<div class="page-head">
    <div><h1 class="t-h1">${title}</h1>${sub ? `<p class="t-body sub">${sub}</p>` : ""}</div>
    ${actionsHtml ? `<div class="row gap-10 wrap">${actionsHtml}</div>` : ""}
  </div>`;
}

/* ---------- Key-value list ---------- */
export const kv = (rows) => rows.map(([k, v, num]) =>
  `<div class="kv"><span class="k">${k}</span><span class="v ${num ? "num" : ""}">${v}</span></div>`).join("");

/* ---------- Order timeline ---------- */
export function orderTimeline(status) {
  const steps = ["Confirmed", "Ready for pickup", "Picked up", "Completed"];
  const cancelled = status === "Cancelled";
  const cur = steps.indexOf(status);
  return `<div class="order-timeline">${steps.map((s, i) => {
    const cls = cancelled ? "" : i < cur ? "done" : i === cur ? "current" : "";
    return `<span class="ot-step ${cls}"><span class="ot-dot"></span>${s}</span>`;
  }).join(`<span class="ot-step" style="color:var(--text-faint)">·</span>`)}
  ${cancelled ? `<span class="ot-step" style="color:var(--danger)"><span class="ot-dot" style="background:var(--danger);border-color:var(--danger)"></span>Cancelled</span>` : ""}</div>`;
}

/* ---------- Listing card (marketplace) ---------- */
export function listingCard(l, { compact = false } = {}) {
  const shelf = l.shelfHours >= 24 ? `${Math.floor(l.shelfHours / 24)}d ${l.shelfHours % 24}h` : `~${l.shelfHours}h`;
  return `<article class="card card-hover listing-card" data-listing="${l.id}" tabindex="0" role="link" aria-label="${esc(l.product)} listing">
    <div class="lc-media">${foodArt(l.product)}
      <div class="lc-floats">
        <span class="disc-tag">−${l.discount}%</span>
        ${l.isNew ? `<span class="badge badge-violet">${icon("sparkles", 10)} NEW</span>` : ""}
      </div>
    </div>
    <div class="lc-body">
      <div class="row-between">
        <div style="min-width:0">
          <div class="lc-name">${esc(l.product)}</div>
          <div class="lc-qty">${fmtQty(l.qtyRemaining ?? l.qty, l.unit)} available</div>
        </div>
        ${matchTag(l.match, "")}
      </div>
      <div class="lc-price-row">
        <span class="lc-price">₹${l.price}</span><span class="muted" style="font-size:12px">/${l.unit}</span>
        <span class="lc-mrp">₹${l.market}</span>
        <span class="lc-save">${l.discount}% below market</span>
      </div>
      <div class="lc-facts">
        <span>${icon("clock", 12)}Expires in ${shelf}</span>
        <span>${icon("mapPin", 12)}${l.dist.toFixed(1)} km</span>
        <span>${icon("truck", 12)}${esc(l.pickup)}</span>
      </div>
      <div class="lc-foot">
        <span class="lc-seller">${avatar(l.seller, "sm")}<span class="truncate">${esc(l.seller.name)}</span>${verifiedBadge()}</span>
        <span class="row gap-6" style="color:var(--text-muted);font-size:12px">View ${icon("chevronRight", 13)}</span>
      </div>
    </div>
  </article>`;
}

/* ---------- Notification item ---------- */
const NOTIF_TONE = {
  "AI ALERT": ["var(--primary-dim)", "var(--primary-strong)", "sparkles"],
  "MARKETPLACE": ["var(--info-dim)", "var(--info)", "bag"],
  "SHORTAGE": ["var(--warning-dim)", "var(--warning)", "alertTriangle"],
  "ORDER": ["var(--success-dim)", "var(--success)", "cart"],
  "LISTING": ["var(--info-dim)", "var(--info)", "tag"],
  "SENSOR": ["var(--danger-dim)", "var(--danger)", "thermometer"],
  "INVENTORY": ["var(--primary-dim)", "var(--primary-strong)", "package"],
};
const PRIO_LABEL = { critical: "badge-high", high: "badge-medium", medium: "badge-info", info: "badge-neutral" };

export function notifItem(n) {
  const [bg, fg, ic] = NOTIF_TONE[n.kind] || NOTIF_TONE.MARKETPLACE;
  return `<div class="notif ${n.read ? "" : "unread"}" data-notif="${n.id}">
    <span class="n-icon" style="background:${bg};color:${fg}">${icon(ic, 15)}</span>
    <div class="flex-1" style="min-width:0">
      <div class="row gap-8"><span class="n-kind">${esc(n.kind)}</span><span class="badge ${PRIO_LABEL[n.prio] || "badge-neutral"}" style="height:17px;font-size:9.5px">${n.prio}</span></div>
      <div class="n-title">${esc(n.title)}</div>
      <div class="n-body">${esc(n.body)}</div>
    </div>
    <div class="col gap-6" style="align-items:flex-end;flex:none">
      <span class="n-time">${n.mins < 1 ? "now" : n.mins < 60 ? `${n.mins}m` : `${Math.round(n.mins / 60)}h`}</span>
      ${n.read ? "" : `<span class="n-unread-dot"></span>`}
    </div>
  </div>`;
}

/* ---------- Dropdown menu ---------- */
export function dropdown(anchor, items, { align = "left", width } = {}) {
  document.querySelectorAll(".menu").forEach((m) => m.remove());
  const menu = document.createElement("div");
  menu.className = "menu";
  if (width) menu.style.width = width + "px";
  menu.innerHTML = items.map((it) =>
    it === "-" ? `<div class="menu-sep"></div>` :
    it.head ? `<div class="menu-head">${esc(it.head)}</div>` :
    `<button class="menu-item ${it.danger ? "danger" : ""}" data-mid="${it.id}">${it.icon ? icon(it.icon, 14) : ""}<span>${esc(it.label)}</span>${it.right ? `<span style="margin-left:auto" class="muted t-xs">${it.right}</span>` : ""}</button>`).join("");
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = r.bottom + 8 + "px";
  menu.style[align === "right" ? "right" : "left"] = (align === "right" ? window.innerWidth - r.right : r.left) + "px";
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mid]");
    if (b) { menu.remove(); items.find((i) => i.id === b.dataset.mid)?.onClick?.(); }
  });
  setTimeout(() => {
    const closer = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("mousedown", closer); } };
    document.addEventListener("mousedown", closer);
  }, 0);
  return menu;
}

/* ---------- Format helpers re-export ---------- */
export { fmtINR, fmtQty };
