/* Marketplace and listing workflows backed by authenticated server actions. */
import { icon, foodArt } from "../icons.js";
import { fmtNum, fmtShelf, esc } from "../util.js";
import { selectors, actions, store } from "../store.js";
import { pageHead, matchTag, matchReasons, avatar, verifiedBadge, statusBadge, aiHeader, emptyState, toast, openModal, modalHead, closeModal, kv } from "../ui.js";

const filters = { cats: new Set(), maxDist: 0, maxExpiry: 0, minMatch: 0, sort: "match", q: "", vegOnly: false, context: null };
const sorts = [["match", "Best Match"], ["dist", "Closest"], ["price", "Lowest Price"], ["expiry", "Expires Soon"], ["qty", "Largest Quantity"]];
const query = () => new URLSearchParams(location.hash.split("?")[1] || "");
const remaining = (l) => Number(l.qtyRemaining ?? l.qty);
const score = (l) => Number(l.match?.score || 0);
const allListings = () => selectors.allListings(store.get());
const sellerOf = (l) => l.seller || selectors.business(l.biz) || { name: "Business", type: "Business", loc: "Location not provided" };
const money = (v) => Number(v).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const quantity = (v) => fmtNum(v, Number(v) % 1 ? 2 : 0);
const knownDistance = (l) => l.dist !== null && l.dist !== undefined && Number.isFinite(Number(l.dist));
const discount = (l) => Number(l.market) > Number(l.price) ? Math.round((1 - l.price / l.market) * 100) : 0;
const stepFor = (unit) => ["pcs", "packs", "pieces"].includes(unit) ? 1 : 0.01;
const failure = (err, title = "Couldn't save changes") => toast(title, esc(err.message || "Please try again."), "error");
let searchHandler;

function filtered(listings) {
  const out = listings.filter((l) => {
    if (filters.cats.size && !filters.cats.has(l.category)) return false;
    if (filters.maxDist && (!knownDistance(l) || l.dist > filters.maxDist)) return false;
    if (filters.maxExpiry && l.shelfHours > filters.maxExpiry) return false;
    if (score(l) < filters.minMatch) return false;
    if (filters.q && !`${l.product} ${sellerOf(l).name} ${l.category}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.vegOnly && !["Produce", "Fruits", "Vegetables", "Dairy", "Bakery", "Grocery", "Beverages"].includes(l.category)) return false;
    return true;
  });
  const compare = {
    match: (a, b) => score(b) - score(a),
    dist: (a, b) => (knownDistance(a) ? a.dist : Infinity) - (knownDistance(b) ? b.dist : Infinity),
    price: (a, b) => a.price - b.price,
    expiry: (a, b) => a.shelfHours - b.shelfHours,
    qty: (a, b) => remaining(b) - remaining(a),
  };
  return out.sort(compare[filters.sort] || compare.match);
}

function filterPanel(listings) {
  const cats = [...new Set(listings.map((l) => l.category))].filter(Boolean);
  return `<aside class="card filters" style="padding:0">
    <div class="f-group"><label class="f-title" for="m-search">Search surplus</label><input class="input" id="m-search" type="search" placeholder="Product or seller" value="${esc(filters.q)}"/></div>
    <div class="f-group"><div class="f-title">Category</div>${cats.length ? cats.map((cat) => `<label class="filter-check"><input style="display:inline-block;accent-color:var(--primary)" type="checkbox" data-cat="${esc(cat)}" ${filters.cats.has(cat) ? "checked" : ""}/>${esc(cat)}<span class="fc-count">${listings.filter((l) => l.category === cat).length}</span></label>`).join("") : '<span class="t-xs muted">Categories appear with live listings.</span>'}</div>
    <div class="f-group"><label class="f-title" for="f-dist">Distance</label><select class="select" id="f-dist">${[[0, "Any location"], [3, "Within 3 km"], [6, "Within 6 km"], [12, "Within 12 km"], [25, "Within 25 km"]].map(([value, label]) => `<option value="${value}" ${filters.maxDist === value ? "selected" : ""}>${label}</option>`).join("")}</select><p class="t-xs muted" style="margin-top:8px">Distance filters require both businesses to have coordinates.</p></div>
    <div class="f-group"><label class="f-title" for="f-expiry">Expiry window</label><select class="select" id="f-expiry">${[[0, "Any shelf life"], [12, "Next 12 hours"], [24, "Next 24 hours"], [48, "Next 48 hours"]].map(([value, label]) => `<option value="${value}" ${filters.maxExpiry === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
    <div class="f-group"><label class="f-title" for="f-match">Min match <span id="match-val">${filters.minMatch}%</span></label><input type="range" class="range" id="f-match" min="0" max="100" step="5" value="${filters.minMatch}"/></div>
    <div class="f-group"><label class="filter-check"><input style="display:inline-block;accent-color:var(--primary)" type="checkbox" id="f-veg" ${filters.vegOnly ? "checked" : ""}/>Vegetarian categories</label></div>
    <div class="f-group"><button class="btn btn-ghost btn-sm" id="f-clear">Reset filters</button></div>
  </aside>`;
}

export function market() {
  if (filters.context !== location.hash) {
    filters.context = location.hash;
    filters.q = query().get("need") || query().get("q") || "";
  }
  const listings = selectors.marketplace(store.get());
  const need = query().get("need");
  const matches = filtered(listings).length;
  return `${pageHead("Surplus Marketplace", "Live business listings · matches based on your inventory and demand")}
    ${need ? `<div class="card ai-panel" style="padding:16px 18px;margin-bottom:18px">${aiHeader("OVERBYTE MATCH")}
      <p class="t-sm secondary" style="margin-top:10px">${matches ? `${matches} potential match${matches === 1 ? "" : "es"}` : "No live matches yet"} for ${esc(need)}.</p><button class="btn btn-secondary btn-sm" style="margin-top:10px" data-watch>${icon("bell", 13)}Set Purchase Alert</button></div>` : ""}
    <div class="mkt-layout">${filterPanel(listings)}<div style="min-width:0">
      <div class="mkt-head wrap"><span class="mkt-count"><b id="m-count">${matches}</b> available listings</span><label class="t-xs muted">Sort <select class="select" id="m-sort" style="width:auto">${sorts.map(([id, label]) => `<option value="${id}" ${filters.sort === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
      <div id="m-results">${marketResultsHTML(listings)}</div></div></div>`;
}

function marketResultsHTML(listings) {
  const rows = filtered(listings);
  if (!rows.length) return emptyState({ icon: "search", title: "No matching surplus yet", sub: "Listings appear here when other businesses publish available stock. Save a product alert to be notified when a listing appears.", action: `<button class="btn btn-secondary" data-watch>${icon("bell", 14)}Set Purchase Alert</button>` });
  return `<div class="listing-grid">${rows.map((l) => {
    const seller = sellerOf(l);
    return `<a class="card card-hover listing-card" href="#/app/surplus/${encodeURIComponent(l.id)}" style="text-decoration:none;color:inherit">
      <div class="lc-media">${foodArt(l.product)}<div class="lc-floats">${discount(l) ? `<span class="disc-tag">−${discount(l)}% vs reference</span>` : ""}${l.isNew ? `<span class="badge badge-violet">${icon("sparkles", 10)} NEW</span>` : ""}</div></div>
      <div class="lc-body"><div class="row-between gap-8"><div><div class="lc-name">${esc(l.product)}</div><div class="lc-qty">${quantity(remaining(l))} ${esc(l.unit)} available</div></div>${l.match ? matchTag(l.match, "MATCH") : ""}</div>
        <div class="lc-price-row wrap"><span class="lc-price">${money(l.price)}</span><span class="muted t-xs">/${esc(l.unit)}</span>${discount(l) ? `<span class="lc-mrp">${money(l.market)}</span>` : ""}</div>
        <div class="lc-facts"><span>${icon("clock", 12)}${fmtShelf(l.shelfHours)} left</span><span>${icon("mapPin", 12)}${knownDistance(l) ? `${Number(l.dist).toFixed(1)} km` : esc(seller.loc || "Location not set")}</span><span>${icon("truck", 12)}${esc(l.pickup)}</span></div>
        <div class="lc-foot"><span class="lc-seller">${avatar(seller, "sm")}<span class="truncate">${esc(seller.name)}</span>${seller.verified ? verifiedBadge() : ""}</span><span class="badge badge-neutral">${esc(l.cond)}</span></div>
      </div></a>`;
  }).join("")}</div>`;
}

function watchModal() {
  const modal = openModal(`${modalHead("Set a purchase alert", "We'll notify you in OverByte when matching stock is published.")}
    <form id="watch-form"><div class="modal-body"><div class="field"><label for="watch-product">Product</label><input class="input" id="watch-product" maxlength="120" required value="${esc(filters.q)}" placeholder="e.g. Chicken Breast"/></div><p class="t-xs muted" style="margin-top:10px">Alerts are matched by product name.</p></div><div class="modal-foot"><button class="btn btn-ghost" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save alert</button></div></form>`);
  modal.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = modal.querySelector('[type="submit"]');
    button.disabled = true;
    try { await actions.addWatch({ product: modal.querySelector("input").value.trim() }); closeModal(); toast("Purchase alert saved", "Matching new listings will appear in your notifications.", "success"); }
    catch (err) { failure(err, "Couldn't save alert"); button.disabled = false; }
  });
}

function initMarket(root) {
  const repaint = () => {
    if (!root.isConnected) return;
    const listings = selectors.marketplace(store.get());
    root.querySelector("#m-results").innerHTML = marketResultsHTML(listings);
    root.querySelector("#m-count").textContent = filtered(listings).length;
  };
  root.addEventListener("click", (event) => { if (event.target.closest("[data-watch]")) watchModal(); });
  root.querySelectorAll("[data-cat]").forEach((input) => input.addEventListener("change", () => { input.checked ? filters.cats.add(input.dataset.cat) : filters.cats.delete(input.dataset.cat); repaint(); }));
  root.querySelector("#m-search")?.addEventListener("input", (event) => { filters.q = event.target.value; repaint(); });
  root.querySelector("#m-sort")?.addEventListener("change", (event) => { filters.sort = event.target.value; repaint(); });
  root.querySelector("#f-dist")?.addEventListener("change", (event) => { filters.maxDist = Number(event.target.value); repaint(); });
  root.querySelector("#f-expiry")?.addEventListener("change", (event) => { filters.maxExpiry = Number(event.target.value); repaint(); });
  root.querySelector("#f-match")?.addEventListener("input", (event) => { filters.minMatch = Number(event.target.value); root.querySelector("#match-val").textContent = `${filters.minMatch}%`; repaint(); });
  root.querySelector("#f-veg")?.addEventListener("change", (event) => { filters.vegOnly = event.target.checked; repaint(); });
  root.querySelector("#f-clear")?.addEventListener("click", () => {
    Object.assign(filters, { cats: new Set(), maxDist: 0, maxExpiry: 0, minMatch: 0, sort: "match", q: "", vegOnly: false });
    const content = root.closest(".content") || root;
    content.innerHTML = `<div class="page">${market()}</div>`;
    initMarket(content);
  });
  if (searchHandler) window.removeEventListener("ob-search", searchHandler);
  searchHandler = (event) => { filters.q = String(event.detail || ""); const input = root.querySelector("#m-search"); if (input) input.value = filters.q; repaint(); };
  window.addEventListener("ob-search", searchHandler);
}

function purchaseBounds(l) {
  const max = remaining(l);
  const min = Math.min(max, Math.max(stepFor(l.unit), Number(l.minOrder) || stepFor(l.unit)));
  const mine = selectors.enrichedInventory(store.get()).find((i) => i.product.toLowerCase() === l.product.toLowerCase() && i.unit === l.unit);
  return { min, max, value: Math.max(min, Math.min(max, mine?.shortage?.qty || min)), step: stepFor(l.unit) };
}

export function detail({ params }) {
  const l = allListings().find((item) => item.id === params[0]);
  if (!l) return emptyState({ icon: "bag", title: "Listing unavailable", sub: "This listing is no longer available to purchase.", action: `<a class="btn btn-primary" href="#/app/surplus">Back to marketplace</a>` });
  const seller = sellerOf(l);
  const own = l.own || l.biz === store.get().bizId;
  const bounds = purchaseBounds(l);
  const buyable = !own && (l.status || "Active") === "Active" && bounds.max > 0 && l.shelfHours > 0;
  return `<a class="btn btn-ghost btn-sm" href="${own ? "#/app/listings" : "#/app/surplus"}" style="margin-bottom:14px">${icon("chevronLeft", 14)}Back to ${own ? "my listings" : "marketplace"}</a>
    <div class="ld-layout"><div class="col gap-20"><div class="ld-hero">${foodArt(l.product)}</div>
      <div class="card ld-info-card"><div class="row-between wrap gap-10"><div><div class="row gap-10 wrap"><h1 class="t-h1">${esc(l.product)}</h1>${statusBadge(l.status || "Active")}<span class="badge badge-neutral">${esc(l.cond)}</span></div><p class="t-body sub" style="margin-top:4px">${quantity(remaining(l))} ${esc(l.unit)} available · ${l.shelfHours > 0 ? `${fmtShelf(l.shelfHours)} until expiry` : "Expired"}</p></div><div class="ld-price">${money(l.price)}<span class="t-body muted">/${esc(l.unit)}</span></div></div>
        <div style="height:1px;background:var(--border);margin:18px 0"></div><div class="row gap-20 wrap"><div class="flex-1" style="min-width:200px"><div class="t-cap" style="margin-bottom:8px">Product information</div>${kv([["Available", `${quantity(remaining(l))} ${esc(l.unit)}`, 1], ["Minimum order", `${quantity(bounds.min)} ${esc(l.unit)}`, 1], ["Storage", esc(l.storage)], ["Condition", esc(l.cond)], ["Pickup window", esc(l.pickup)], ["Expiry", l.expiresAt ? esc(new Date(l.expiresAt).toLocaleString()) : fmtShelf(l.shelfHours)]])}</div>
        <div class="flex-1" style="min-width:200px"><div class="t-cap" style="margin-bottom:8px">Price &amp; handling</div>${kv([["Seller price", `${money(l.price)}/${esc(l.unit)}`], ...(l.market > 0 ? [["Seller cost reference", `${money(l.market)}/${esc(l.unit)}`]] : []), ...(discount(l) ? [["Below reference", `${discount(l)}%`]] : [])])}<p class="t-sm secondary" style="margin-top:14px">${esc(l.notes || "No handling notes supplied. Confirm packaging and handling with the seller at pickup.")}</p><p class="t-xs muted" style="margin-top:12px">Listing details and expiry are supplied by the seller.</p></div></div></div>
      <div class="card card-pad"><div class="t-cap" style="margin-bottom:12px">Pickup area</div><div class="row gap-12">${icon("mapPin", 24)}<div><b>${esc(seller.loc || "Location not provided")}</b><p class="t-sm muted" style="margin-top:4px">${knownDistance(l) ? `${Number(l.dist).toFixed(1)} km estimated distance` : "Distance not available"}</p></div></div><p class="t-xs muted" style="margin-top:14px">${esc(l.pickup)} · Confirm handover details before travelling.</p></div>
    </div><div class="col gap-20">
      ${!own && l.match ? `<div class="card ai-panel" style="padding:20px"><div class="row-between">${aiHeader("OVERBYTE MATCH")}<span class="t-xs muted">Inventory-based ranking</span></div><div class="row gap-16" style="margin-top:14px"><div class="t-num-lg" style="font-size:34px;color:var(--primary-strong)">${score(l)}%</div>${matchReasons((l.match.reasons || []).slice(0, 6))}</div></div>` : ""}
      <div class="card ld-info-card">${own ? `<div class="t-cap">Your listing</div><p class="t-body secondary" style="margin-top:12px">Other businesses can discover and order this stock while your listing is active.</p><a class="btn btn-secondary btn-block" style="margin-top:18px" href="#/app/listings">Manage listings</a>` : buyable ? `<div class="t-cap" style="margin-bottom:12px">Purchase surplus</div><label class="row-between t-sm secondary" for="q-val">Quantity (${esc(l.unit)})<span class="t-xs muted">${quantity(bounds.min)}–${quantity(bounds.max)} ${esc(l.unit)}</span></label>
        <div class="qty-stepper" style="margin-top:10px"><button id="q-dec" aria-label="Decrease quantity">${icon("minus", 15)}</button><input class="qs-val input" id="q-val" type="number" min="${bounds.min}" max="${bounds.max}" step="${bounds.step}" value="${bounds.value}" aria-label="Purchase quantity" style="border:0;border-radius:0;width:110px"/><button id="q-inc" aria-label="Increase quantity">${icon("plus", 15)}</button></div>
        <div class="kv" style="margin-top:16px"><span class="k">Total due at pickup</span><span class="v num" id="q-total">${money(bounds.value * l.price)}</span></div><div class="kv"><span class="k">Pickup</span><span class="v">${esc(l.pickup)}</span></div><button class="btn btn-primary btn-lg btn-block" id="buy-btn" style="margin-top:18px">${icon("cart", 15)}Purchase Surplus</button><p class="t-xs muted center" style="margin-top:10px">Stock is reserved on confirmation and added to your inventory after pickup.</p>` : `<div class="t-cap">${esc(l.status || "Unavailable")}</div><p class="t-body muted" style="margin-top:10px">This listing can't accept new orders.</p><a class="btn btn-secondary" style="margin-top:16px" href="#/app/surplus">Find other surplus</a>`}</div>
      <div class="card seller-card">${avatar(seller)}<div class="flex-1"><div class="row gap-6"><b class="t-sm">${esc(seller.name)}</b>${seller.verified ? verifiedBadge() : ""}</div><div class="t-xs muted">${esc(seller.type || "Business")}${seller.rating != null ? ` · ${Number(seller.rating).toFixed(1)} ★` : ""}${seller.orders != null ? ` · ${Number(seller.orders)} completed orders` : ""}</div></div>${seller.verified ? '<span class="badge badge-safe">Verified</span>' : ""}</div>
    </div></div>`;
}

function detailInit(root) {
  const id = decodeURIComponent(location.hash.split("?")[0].split("/")[3]);
  const l = allListings().find((item) => item.id === id);
  const input = root.querySelector("#q-val");
  if (!l || !input) return;
  const bounds = purchaseBounds(l);
  const paint = () => { root.querySelector("#q-total").textContent = money((Number(input.value) || 0) * l.price); };
  root.querySelector("#q-dec").addEventListener("click", () => { input.value = Math.max(bounds.min, Math.round((Number(input.value) - 1) * 100) / 100); paint(); });
  root.querySelector("#q-inc").addEventListener("click", () => { input.value = Math.min(bounds.max, Math.round((Number(input.value) + 1) * 100) / 100); paint(); });
  input.addEventListener("input", paint);
  root.querySelector("#buy-btn").addEventListener("click", () => {
    if (!input.reportValidity() || !Number(input.value)) return;
    const qty = Number(input.value);
    const idempotencyKey = crypto.randomUUID();
    const modal = openModal(`${modalHead("Confirm order", `${esc(l.product)} · ${esc(sellerOf(l).name)}`)}<div class="modal-body"><div class="row gap-14"><div style="width:54px;height:54px;border-radius:12px;overflow:hidden">${foodArt(l.product)}</div><div class="flex-1"><b>${esc(l.product)}</b><div class="t-sm muted">${quantity(qty)} ${esc(l.unit)} × ${money(l.price)}</div></div><div class="t-num-lg">${money(qty * l.price)}</div></div><div style="margin-top:18px">${kv([["Seller", esc(sellerOf(l).name)], ["Pickup", esc(l.pickup)], ["Pickup area", esc(sellerOf(l).loc)], ["Payment", "Pay seller at pickup"]])}</div><p class="t-xs muted" style="margin-top:14px">Ordering as ${esc(selectors.biz(store.get()).name)}. You can cancel until the seller records handover. Payment is arranged directly with the seller.</p><p id="order-error" class="t-sm" role="alert" style="color:var(--danger);margin-top:10px"></p></div><div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="confirm-buy">Confirm Order</button></div>`);
    const button = modal.querySelector("#confirm-buy");
    button.addEventListener("click", async () => {
      button.disabled = true; button.textContent = "Reserving stock…";
      try {
        const order = await actions.createOrder(id, qty, { idempotencyKey });
        closeModal();
        openModal(`${modalHead("Order confirmed", "Your stock is reserved for pickup.")}<div class="modal-body">${kv([["Order ID", esc(order.id)], ["Product", `${quantity(order.qty)} ${esc(order.unit)} ${esc(order.product)}`], ["Pickup", esc(order.pickup)], ["Due at pickup", money(order.total)], ["Status", statusBadge(order.status)]])}<p class="t-xs muted" style="margin-top:14px">The seller will prepare your order. Inventory transfers when the seller confirms pickup.</p></div><div class="modal-foot"><a class="btn btn-primary" href="#/app/orders" data-close>View Orders</a></div>`);
        toast("Order confirmed", `${quantity(qty)} ${esc(l.unit)} ${esc(l.product)} reserved.`, "success");
      } catch (err) { modal.querySelector("#order-error").textContent = err.message || "Unable to place order. Please retry."; button.disabled = false; button.textContent = "Retry confirmation"; }
    });
  });
}

function listingAvailability(item) { return Math.max(0, Number(item.availableToList ?? item.availableQty ?? item.qty)); }
function priceRange(item) {
  const cost = Number(item.cost || 0);
  const fraction = item.shelfHours <= 24 ? 0.7 : item.shelfHours <= 48 ? 0.8 : 0.9;
  return { low: Math.max(0.01, Math.round(cost * fraction * 100) / 100), high: Math.max(0.01, Math.round(cost * Math.min(1, fraction + 0.15) * 100) / 100) };
}

export function create() {
  const state = store.get();
  const inv = selectors.enrichedInventory(state).filter((i) => i.shelfHours > 0 && listingAvailability(i) > 0);
  if (!inv.length) return `${pageHead("Create Surplus Listing", "Publish available inventory for other businesses")}${emptyState({ icon: "package", title: "No available inventory to list", sub: "Add an inventory batch with an expiry date first. Stock already committed to a listing or order can't be listed twice.", action: '<a class="btn btn-primary" href="#/app/inventory">Manage inventory</a>' })}`;
  const alert = (state.alerts || []).find((a) => a.id === query().get("alert") && a.status === "pending");
  const source = inv.find((i) => i.id === query().get("item")) || inv.find((i) => i.id === (alert?.inventoryItemId || alert?.item)) || inv.find((i) => i.product === alert?.product) || inv[0];
  const available = listingAvailability(source);
  const recommended = Number(alert?.surplus?.[1] ?? source.surplus?.mid ?? available);
  const qty = Math.max(stepFor(source.unit), Math.min(available, recommended || available));
  const rec = priceRange(source);
  return `${pageHead("Create Surplus Listing", alert ? `Review ${esc(source.product)} surplus before publishing` : "You control the stock, price and pickup details", aiHeader("OVERBYTE ASSISTED"))}
    <div class="create-layout"><form class="col gap-20" id="cl-form">
      <div class="card card-pad"><div class="t-cap" style="margin-bottom:14px">What are you listing?</div><div class="row gap-16 wrap"><div class="field flex-1" style="min-width:200px"><label for="c-product">Inventory batch</label><select class="select" id="c-product" required>${inv.map((i) => `<option value="${esc(i.id)}" ${i.id === source.id ? "selected" : ""}>${esc(i.product)}${i.batch ? ` · ${esc(i.batch)}` : ""} — ${quantity(listingAvailability(i))} ${esc(i.unit)} available</option>`).join("")}</select></div><div class="field" style="width:140px"><label for="c-qty">Quantity (<span data-unit>${esc(source.unit)}</span>)</label><input class="input input-mono" id="c-qty" type="number" required min="${stepFor(source.unit)}" max="${available}" step="${stepFor(source.unit)}" value="${qty}"/></div></div>
        <div class="row gap-16 wrap" style="margin-top:16px"><div class="field flex-1" style="min-width:140px"><label for="c-min">Min order (<span data-unit>${esc(source.unit)}</span>)</label><input class="input input-mono" id="c-min" type="number" required min="${stepFor(source.unit)}" max="${qty}" step="${stepFor(source.unit)}" value="${Math.min(qty, 1)}"/></div><div class="field flex-1" style="min-width:140px"><label for="c-cond">Food condition</label><select class="select" id="c-cond"><option>Fresh</option><option>Fresh-frozen</option><option>Packaged</option></select></div><div class="field flex-1" style="min-width:140px"><label for="c-storage">Storage</label><select class="select" id="c-storage">${[...new Set([source.storage, "Refrigerated", "Ambient", "Frozen", "Dry storage"].filter(Boolean))].map((x) => `<option ${source.storage === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div></div><p class="t-xs muted" id="stock-help" style="margin-top:12px">${quantity(available)} ${esc(source.unit)} available to list from this batch.</p></div>
      <div class="card card-pad"><div class="t-cap" style="margin-bottom:14px">Pickup &amp; expiry</div><div class="row gap-16 wrap"><div class="field flex-1" style="min-width:180px"><label for="c-pickup">Pickup window</label><input class="input" id="c-pickup" required maxlength="180" placeholder="e.g. Today, 5:00–7:00 PM" value="${esc(selectors.biz(state).pickupHours || "")}"/></div><div class="field" style="width:170px"><label for="c-shelf">Expires in (hours)</label><input class="input input-mono" id="c-shelf" type="number" min="0.01" max="${source.shelfHours}" step="any" required value="${source.shelfHours}"/></div></div><p class="t-xs muted" style="margin-top:10px">A listing cannot extend the inventory batch's expiry.</p><div class="field" style="margin-top:16px"><label for="c-notes">Notes for buyers</label><textarea class="textarea" id="c-notes" maxlength="2000" placeholder="Packaging, allergens, storage and handover instructions…"></textarea></div></div>
    </form><div class="col gap-20">${alert ? `<div class="card alert-summary">${aiHeader("INVENTORY ALERT")}<div style="margin-top:12px">${kv([["Current inventory", `${quantity(source.qty)} ${esc(source.unit)}`], ["Expected demand", `${quantity(source.demand || 0)} ${esc(source.unit)}`], ["Available to list", `${quantity(available)} ${esc(source.unit)}`]])}</div></div>` : ""}
      <div class="card ai-panel price-suggest">${aiHeader("SUGGESTED PRICE")}<div class="ps-range"><span class="ps-low" id="ps-low">${money(rec.low)}</span><span class="ps-dash">—</span><span class="ps-high" id="ps-high">${money(rec.high)}</span><span class="t-xs muted">/<span data-unit>${esc(source.unit)}</span></span></div><p class="t-xs muted">A starting range based on your recorded unit cost and remaining shelf life. Set the price that works for your business.</p><div class="field" style="margin-top:16px"><label for="c-price">Your price (₹/<span data-unit>${esc(source.unit)}</span>)</label><input class="input input-mono" id="c-price" form="cl-form" type="number" min="0.01" max="10000000" step="0.01" required value="${Math.round((rec.low + rec.high) * 50) / 100}"/></div></div>
      <p id="cl-error" role="alert" class="t-sm" style="color:var(--danger)"></p><button class="btn btn-primary btn-lg btn-block" form="cl-form" type="submit" id="cl-publish">${icon("send", 15)}Publish Listing</button><p class="t-xs muted center">Publishing makes the listing visible to other business accounts. Stock is committed until sold, cancelled or expired.</p>
    </div></div>`;
}

function createInit(root) {
  const form = root.querySelector("#cl-form");
  if (!form) return;
  const field = (id) => root.querySelector(`#c-${id}`);
  const updateSource = () => {
    const item = selectors.enrichedInventory(store.get()).find((i) => i.id === field("product").value);
    if (!item) return;
    const available = listingAvailability(item);
    const rec = priceRange(item);
    root.querySelectorAll("[data-unit]").forEach((el) => { el.textContent = item.unit; });
    field("qty").min = field("qty").step = field("min").min = field("min").step = stepFor(item.unit);
    field("qty").max = available;
    field("qty").value = Math.min(available, item.surplus?.mid || available);
    field("min").max = field("qty").value;
    field("min").value = Math.min(1, Number(field("qty").value));
    field("shelf").value = field("shelf").max = item.shelfHours;
    if (Array.from(field("storage").options).some((option) => option.value === item.storage)) field("storage").value = item.storage;
    field("price").value = Math.round((rec.low + rec.high) * 50) / 100;
    root.querySelector("#ps-low").textContent = money(rec.low);
    root.querySelector("#ps-high").textContent = money(rec.high);
    root.querySelector("#stock-help").textContent = `${quantity(available)} ${item.unit} available to list from this batch.`;
  };
  field("product").addEventListener("change", updateSource);
  field("qty").addEventListener("input", () => { field("min").max = field("qty").value; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = root.querySelector("#cl-publish");
    const error = root.querySelector("#cl-error");
    button.disabled = true; error.textContent = "";
    const state = store.get();
    const item = selectors.enrichedInventory(state).find((i) => i.id === field("product").value);
    const values = { inventoryItemId: item?.id, qty: Number(field("qty").value), price: Number(field("price").value), minOrder: Number(field("min").value), shelfHours: Number(field("shelf").value), pickup: field("pickup").value.trim(), notes: field("notes").value.trim(), cond: field("cond").value, storage: field("storage").value };
    try {
      if (!item) throw new Error("This inventory batch is no longer available.");
      const alert = (state.alerts || []).find((a) => a.id === query().get("alert") && a.status === "pending" && (a.inventoryItemId || a.item) === item.id);
      if (alert) await actions.publishFromAlert(alert.id, values); else await actions.createListing(values);
      toast("Listing published", `${quantity(values.qty)} ${esc(item.unit)} ${esc(item.product)} is now available to buyers.`, "success");
      location.hash = "#/app/listings";
    } catch (err) { error.textContent = err.message || "Unable to publish. Please try again."; button.disabled = false; }
  });
}

export function init(root, { view }) {
  if (view === "create") return createInit(root);
  if (view === "detail") return detailInit(root);
  initMarket(root);
}
