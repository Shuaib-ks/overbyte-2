/* ============================================================
   OVERBYTE — Reactive store
   Single source of truth + actions. Subscribers re-render views.
   Prototype persistence: sessionStorage (refresh-safe, tab-local).
   ============================================================ */

import { BUSINESSES, INVENTORY, LISTINGS, ORDERS, ALERTS, NOTIFICATIONS, ANALYTICS, PRODUCTS, SENSORS, bizById, distance } from "./data.js";
import { wasteRisk, surplusEstimate, priceRecommendation, matchScore, shortageOf } from "./engines.js";
import { uid } from "./util.js";

const KEY = "overbyte_state_v2";

function sensorState(bizId) {
  return (SENSORS[bizId] || []).map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    type: sensor.type.includes("Temperature") ? "Temperature" : sensor.type.includes("Inventory") ? "Smart scale" : sensor.type,
    unit: sensor.type.includes("Temperature") ? "°C" : sensor.type.includes("Inventory") ? "kg" : "",
    lastValue: sensor.metric && !["Live", "Paired", "No signal"].includes(sensor.metric)
      ? Number.parseFloat(sensor.metric)
      : null,
    lastReadingAt: sensor.syncMins != null ? new Date(Date.now() - sensor.syncMins * 60000).toISOString() : null,
  }));
}

function freshState() {
  return {
    authed: false,
    onboarded: true,
    bizId: "b_gf",
    user: { email: "rohan@greenfork.in" },
    inventory: JSON.parse(JSON.stringify(INVENTORY)),
    listings: JSON.parse(JSON.stringify(LISTINGS)),
    orders: JSON.parse(JSON.stringify(ORDERS)),
    alerts: JSON.parse(JSON.stringify(ALERTS)),
    notifications: JSON.parse(JSON.stringify(NOTIFICATIONS)),
    analytics: JSON.parse(JSON.stringify(ANALYTICS)),
    sensors: sensorState("b_gf"),
    watches: [],
    settings: {
      autoAlerts: true, listingSuggestions: true, priceOverrideConfirm: true, wasteTarget: 12,
      notifyAI: true, notifyMarket: true, notifyOrders: true, notifySensors: true,
    },
    seq: 2045,
  };
}

function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return freshState();
}

let state = load();
const subs = new Set();

export const store = {
  get: () => state,
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  /** demo reset */
  reset() { state = freshState(); persist(); emit(); },
};

function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
function emit() { persist(); subs.forEach((fn) => fn(state)); }

const myInventory = (s = state) => s.inventory[s.bizId] || [];
const myBiz = (s = state) => bizById(s.bizId);

/* ---------- Derived selectors ---------- */

export const selectors = {
  biz: myBiz,
  inventory: myInventory,
  product: (name) => PRODUCTS[name] || { cat: "Other", unit: "kg", market: 100, storage: "Refrigerated" },

  /** Inventory enriched with AI analysis */
  enrichedInventory(s = state) {
    return myInventory(s).map((it) => {
      const p = PRODUCTS[it.product] || {};
      const unit = it.unit || p.unit || "kg";
      const demand = Number(it.demand ?? it.dailyDemand ?? 0);
      const shelfHours = Number(it.shelfHours ?? Math.max(0, (new Date(it.expiresAt || 0).getTime() - Date.now()) / 3600000));
      const forecastAvailable = it.forecastAvailable ?? (it.dailyDemand != null || it.demand != null);
      const seed = `${it.id}|${it.qty}`;
      const risk = wasteRisk({ stock: it.qty, expectedDemand: demand, shelfHours, category: p.cat, seed });
      const surplus = forecastAvailable ? surplusEstimate({ stock: it.qty, expectedDemand: demand }) : { mid: 0, low: 0, high: 0 };
      const shortage = forecastAvailable && demand > it.qty ? shortageOf({ stock: it.qty, expectedDemand: demand, seed }) : null;
      const reservedQty = Number(it.reservedQty || 0);
      return {
        ...it,
        unit, category: it.category || p.cat || "Other", market: it.market || p.market || 100,
        shelfHours, expiresAt: it.expiresAt || new Date(Date.now() + shelfHours * 3600000).toISOString(),
        dailyDemand: it.dailyDemand ?? (it.demand != null ? it.demand : null),
        demand, forecastAvailable, reservedQty,
        availableToList: Math.max(0, it.qty - reservedQty),
        value: it.qty * it.cost, marketValue: it.qty * (p.market || 100),
        risk, surplus, shortage,
        aiStatus: !forecastAvailable ? "Needs demand data" : shortage ? "Shortage" : risk.risk === "high" ? "Surplus risk" : risk.risk === "medium" ? "Watch" : "Healthy",
      };
    });
  },

  atRiskValue(s = state) {
    return selectors.enrichedInventory(s).filter((i) => i.risk.risk !== "low" || i.shortage).reduce((a, i) => a + i.value * (i.shortage ? 0 : i.risk.probability / 100), 0);
  },

  totalInventoryValue(s = state) { return myInventory(s).reduce((a, i) => a + i.qty * i.cost, 0); },

  pendingAlerts(s = state) { return s.alerts.filter((a) => a.biz === s.bizId && a.status === "pending"); },

  /** Marketplace listings visible to the current business (with AI match) */
  marketplace(s = state) {
    const inv = selectors.enrichedInventory(s);
    const needIdx = {};
    inv.forEach((i) => {
      const qty = i.shortage ? i.shortage.qty : Math.max(2, Math.round(i.demand * 0.25));
      needIdx[i.product] = {
        product: i.product, label: `${qty} ${i.unit} of ${i.product}`, qty, unit: i.unit,
        category: i.category, normalCost: i.cost, byHours: Math.max(12, i.shelfHours * 0.8), isShortage: !!i.shortage,
      };
    });
    return s.listings
      .filter((l) => l.biz !== s.bizId && !["Sold", "Cancelled"].includes(l.status) && l.shelfHours > 0 && (l.qtyRemaining ?? l.qty) > 0)
      .map((l) => {
        const p = PRODUCTS[l.product] || {};
        const need = needIdx[l.product] || {
          product: l.product, label: `5 ${p.unit || "kg"} of ${l.product}`, qty: 5, unit: p.unit || "kg",
           category: p.cat, normalCost: p.market || l.price * 1.2, byHours: 18, isShortage: false,
        };
        const m = matchScore(need, { ...l, category: l.category || p.cat, qty: l.qtyRemaining ?? l.qty, unit: l.unit || p.unit || "kg", shelfHours: l.shelfHours }, distance(s.bizId, l.biz));
        const market = p.market || Math.round(l.price * 1.35);
        return {
          ...l,
          seller: bizById(l.biz),
          dist: distance(s.bizId, l.biz),
          category: l.category || p.cat, unit: l.unit || p.unit,
          market,
          discount: Math.max(5, Math.round((1 - l.price / market) * 100)),
          match: m,
          matchLabel: need.isShortage ? "Shortage match" : "Demand match",
        };
      });
  },

  /** All active listings, including the current business's listings. */
  allListings(s = state) {
    return s.listings
      .filter((l) => l.status !== "Cancelled" && (l.biz === s.bizId || (l.status !== "Sold" && (l.qtyRemaining ?? l.qty) > 0)))
      .map((l) => {
        const p = PRODUCTS[l.product] || {};
        const seller = bizById(l.biz) || { id: l.biz, name: "Business", type: "Business", loc: "Location not set" };
        const market = p.market || Math.round(l.price * 1.35);
        return {
          ...l,
          seller,
          own: l.biz === s.bizId,
          dist: distance(s.bizId, l.biz),
          category: l.category || p.cat || "Other",
          unit: l.unit || p.unit || "kg",
          market,
          discount: Math.max(0, Math.round((1 - l.price / market) * 100)),
        };
      });
  },

  business: (id) => bizById(id),

  myActiveListings(s = state) {
    return s.listings.filter((l) => l.biz === s.bizId && ["Active", "Reserved", "Draft", "Sold"].includes(l.status || "Active")).map((l) => ({
      ...l,
      views: l.views ?? 3 + (l.id.length % 5), interested: l.interested ?? (l.id.length % 3),
    }));
  },

  ordersFor(s = state) {
    return s.orders
      .filter((o) => o.buyer === s.bizId || o.seller === s.bizId)
      .sort((a, b) => (a.placedMins ?? 0) - (b.placedMins ?? 0));
  },

  notificationsFor(s = state) { return s.notifications.filter((n) => n.biz === s.bizId); },
  unreadCount(s = state) { return s.notifications.filter((n) => n.biz === s.bizId && !n.read).length; },

  /** AI recommendation for the hero chicken scenario (used by dashboard) */
  heroListingPreview(s = state) {
    const a = s.alerts.find((x) => x.id === "al1");
    if (!a) return null;
    return priceRecommendation({ market: PRODUCTS[a.product].market, shelfHours: a.shelfHours, wasteProb: a.wasteProb, qty: 12, unit: "kg" });
  },
};

/* ---------- Actions ---------- */

export const actions = {
  login({ email } = {}) {
    state.authed = true;
    if (email) state.user = { email };
    emit();
  },
  signup({ name, type, loc, email } = {}) {
    const biz = myBiz();
    if (name) biz.name = name;
    if (type) biz.type = type;
    if (loc) biz.loc = loc;
    state.user = { email: email || `${biz.owner || "owner"}@overbyte.demo` };
    state.authed = true;
    state.onboarded = false;
    emit();
  },
  logout() { state.authed = false; emit(); },
  completeOnboarding(payload) {
    state.onboarded = true;
    if (payload?.name) myBiz().name = payload.name;
    if (payload?.type) myBiz().type = payload.type;
    emit();
  },
  switchBiz(id) {
    if (!bizById(id)) return;
    state.bizId = id;
    state.sensors = sensorState(id);
    emit();
  },

  dismissAlert(id) {
    const a = state.alerts.find((x) => x.id === id);
    if (a) a.status = "dismissed";
    emit();
  },

  /** Publish a listing from an AI alert (seller confirms — never automatic) */
  publishFromAlert(alertId, { qty, price, pickup, minOrder, inventoryItemId, shelfHours, notes, cond, storage }) {
    const a = state.alerts.find((x) => x.id === alertId);
    if (!a) return null;
    const p = PRODUCTS[a.product] || {};
    const item = (state.inventory[state.bizId] || []).find((entry) => entry.id === (inventoryItemId || a.item));
    const available = item ? item.qty - (item.reservedQty || 0) : qty;
    qty = Math.max(0, Math.min(Number(qty) || 0, available));
    if (!qty) throw new Error("No available quantity remains for this listing.");
    const l = {
      id: uid("l"), biz: state.bizId, product: a.product, qty, qtyRemaining: qty,
      unit: p.unit || "kg", price, minOrder: minOrder || 1, shelfHours: shelfHours || a.shelfHours, cond: cond || "Fresh", storage: storage || p.storage || "Refrigerated",
      inventoryItemId: item?.id, pickup: pickup || "Today 5–9 PM", notes: notes || "", packaging: `Bulk (${p.unit || "kg"})`,
      source: "AI-detected surplus", status: "Active", isNew: true,
      views: 0, interested: 0, createdMins: 0,
    };
    if (item) item.reservedQty = (item.reservedQty || 0) + qty;
    state.listings.unshift(l);
    a.status = "published";
    state.analytics[state.bizId].createdRecent = (state.analytics[state.bizId].createdRecent || 0) + 1;
    state.notifications.unshift({
      id: uid("n"), biz: state.bizId, kind: "LISTING", prio: "medium",
      title: `Surplus listing is live`, body: `${qty} ${p.unit} ${a.product} at ₹${price}/${p.unit} is now visible to nearby businesses.`,
      mins: 0, read: false,
    });
    emit();
    return l;
  },

  /** Create a listing from scratch (create listing page) */
  createListing({ product, qty, price, shelfHours, pickup, notes, cond, storage, minOrder, inventoryItemId }) {
    const p = PRODUCTS[product] || {};
    const item = (state.inventory[state.bizId] || []).find((entry) => entry.id === inventoryItemId);
    const available = item ? item.qty - (item.reservedQty || 0) : qty;
    qty = Math.max(0, Math.min(Number(qty) || 0, available));
    if (!qty) throw new Error("No available quantity remains for this listing.");
    const l = {
      id: uid("l"), biz: state.bizId, product, qty, qtyRemaining: qty, price,
      minOrder: minOrder || 1, inventoryItemId: item?.id,
      unit: p.unit || "kg", shelfHours, cond: cond || "Fresh", storage: storage || p.storage || "Refrigerated",
      pickup: pickup || "Today 5–9 PM", notes: notes || "", packaging: `Bulk (${p.unit || "kg"})`,
      source: "Manual listing", status: "Active", views: 0, interested: 0, createdMins: 0,
    };
    if (item) item.reservedQty = (item.reservedQty || 0) + qty;
    state.listings.unshift(l);
    state.notifications.unshift({
      id: uid("n"), biz: state.bizId, kind: "LISTING", prio: "medium",
      title: "Surplus listing published", body: `${qty} ${p.unit || ""} ${product} is live on the marketplace.`,
      mins: 0, read: false,
    });
    emit();
    return l;
  },

  /** Buyer purchases surplus → order created, quantities & analytics update everywhere */
  createOrder(listingId, qty) {
    const l = state.listings.find((x) => x.id === listingId);
    if (!l || l.biz === state.bizId) throw new Error("This listing is not available to your business.");
    const remaining = Number(l.qtyRemaining ?? l.qty);
    qty = Number(qty);
    if (l.status === "Sold" || l.status === "Cancelled" || l.shelfHours <= 0) throw new Error("This listing is no longer available.");
    if (!Number.isFinite(qty) || qty <= 0 || qty > remaining) throw new Error("Choose an available quantity.");
    const seller = l.biz;
    const p = PRODUCTS[l.product] || { unit: l.unit || "kg", market: l.price };
    const total = Math.round(qty * l.price);
    const order = {
      id: `OB-${++state.seq}`, buyer: state.bizId, seller, product: l.product,
      qty, unit: p.unit, price: l.price, total, status: "Ready for pickup",
      pickup: l.pickup, placedMins: 0,
    };
    state.orders.unshift(order);

    // listing decrement / status
    l.qtyRemaining = (l.qtyRemaining ?? l.qty) - qty;
    if (l.qtyRemaining <= 0) { l.qtyRemaining = 0; l.status = "Sold"; } else { l.status = "Reserved"; }
    l.interested = (l.interested || 0) + 1;
    const sellerItem = (state.inventory[seller] || []).find((item) => item.id === l.inventoryItemId || item.product === l.product);
    if (sellerItem) sellerItem.reservedQty = Math.max(0, (sellerItem.reservedQty || 0) - qty);

    // buyer inventory upsert
    const inv = state.inventory[state.bizId] || (state.inventory[state.bizId] = []);
    let item = inv.find((i) => i.product === l.product);
    if (item) {
      item.qty += qty;
    } else {
      item = { id: uid("it"), product: l.product, qty, unit: l.unit || p.unit || "kg", cost: l.price, shelfHours: l.shelfHours, demand: Math.round(qty * 0.6), storage: l.storage, supplier: bizById(seller).name, batch: "SURPLUS" };
      inv.push(item);
    }
    item.purchasedMinsAgo = 0;

    // seller-side analytics bump
    const a = state.analytics[seller];
    if (a) { a.surplusRevenue += total; a.recoveredKg += qty; a.foodSaved += total; }
    const buyerA = state.analytics[state.bizId];
    if (buyerA) buyerA.purchaseSavings += Math.round(qty * ((p.market || l.price * 1.3) - l.price));

    // notifications
    state.notifications.unshift(
      { id: uid("n"), biz: seller, kind: "ORDER", prio: "high", title: "Your listing received a buyer", body: `${bizById(state.bizId).name} purchased ${qty} ${p.unit} of ${l.product}. Order ${order.id}.`, mins: 0, read: false },
      { id: uid("n"), biz: state.bizId, kind: "ORDER", prio: "info", title: "Order confirmed", body: `${qty} ${p.unit} ${l.product} from ${bizById(seller).name} · ${order.pickup}.`, mins: 0, read: false },
    );
    emit();
    return order;
  },

  cancelListing(id) {
    const l = state.listings.find((x) => x.id === id);
    if (l && l.biz === state.bizId && l.status !== "Sold" && l.status !== "Cancelled") {
      l.status = "Cancelled";
      const item = (state.inventory[state.bizId] || []).find((entry) => entry.id === l.inventoryItemId);
      if (item) item.reservedQty = Math.max(0, (item.reservedQty || 0) - (l.qtyRemaining ?? 0));
    }
    emit();
  },

  advanceOrder(id) {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return;
    const flow = ["Ready for pickup", "Picked up", "Completed"];
    const i = flow.indexOf(o.status);
    if (i >= 0 && i < flow.length - 1) o.status = flow[i + 1];
    emit();
  },

  cancelOrder(id) {
    const o = state.orders.find((x) => x.id === id);
    if (o) o.status = "Cancelled";
    emit();
  },

  addInventory({ product, qty, unit, cost, shelfHours, expiresAt, dailyDemand, category, market, storage, supplier, batch }) {
    const inv = state.inventory[state.bizId] || (state.inventory[state.bizId] = []);
    const p = PRODUCTS[product] || { cat: "Other", market: cost * 1.3 };
    const demand = dailyDemand ?? Math.round(qty * 0.55);
    inv.unshift({ id: uid("it"), product, qty, unit: unit || p.unit || "kg", cost,
      shelfHours: shelfHours ?? Math.max(1, (new Date(expiresAt || Date.now() + 48 * 3600000).getTime() - Date.now()) / 3600000),
      expiresAt: expiresAt || new Date(Date.now() + 48 * 3600000).toISOString(),
      category: category || p.cat, market: market ?? p.market, demand, dailyDemand,
      storage: storage || p.storage, supplier: supplier || "—", batch: batch || `BA-${1000 + inv.length}` });
    state.notifications.unshift({
      id: uid("n"), biz: state.bizId, kind: "INVENTORY", prio: "info",
      title: "Inventory updated", body: `${qty} ${unit} ${product} added · AI demand prediction recalibrating.`,
      mins: 0, read: false,
    });
    emit();
  },

  updateInventory(itemId, patch) {
    const it = (state.inventory[state.bizId] || []).find((item) => item.id === itemId);
    if (!it) throw new Error("Inventory batch not found.");
    Object.assign(it, patch);
    if (patch.expiresAt) it.shelfHours = Math.max(0, (new Date(patch.expiresAt).getTime() - Date.now()) / 3600000);
    if (patch.dailyDemand !== undefined) {
      it.dailyDemand = patch.dailyDemand;
      it.demand = patch.dailyDemand ?? it.demand;
      it.forecastAvailable = patch.dailyDemand != null;
    }
    emit();
  },

  recordConsumption(itemId, quantity) {
    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) throw new Error("Enter a positive quantity.");
    return actions.adjustInventory(itemId, -Number(quantity), "consumption");
  },

  adjustInventory(itemId, delta, kind = "adjustment") {
    const it = (state.inventory[state.bizId] || []).find((i) => i.id === itemId);
    if (!it) throw new Error("Inventory batch not found.");
    const next = Math.max(0, Math.round((it.qty + delta) * 10) / 10);
    if (delta < 0 && next < (it.reservedQty || 0)) throw new Error("That quantity is committed to an active listing.");
    it.qty = next;
    if (kind === "consumption") {
      it.consumedQty = (it.consumedQty || 0) + Math.abs(delta);
      it.dailyDemand = it.dailyDemand ?? it.demand;
    }
    emit();
  },

  addWatch({ product }) {
    const name = String(product || "").trim();
    if (!name) throw new Error("Enter a product name.");
    if (!state.watches.some((watch) => watch.biz === state.bizId && watch.product.toLowerCase() === name.toLowerCase())) {
      state.watches.push({ id: uid("w"), biz: state.bizId, product: name });
    }
    emit();
  },

  addSensor({ name, type, unit }) {
    if (!name) throw new Error("Enter a device name.");
    state.sensors = [...(state.sensors || []), { id: uid("sensor"), name, type, unit, lastValue: null, lastReadingAt: null }];
    emit();
  },

  recordSensorReading(id, { value }) {
    const sensor = (state.sensors || []).find((item) => item.id === id);
    if (!sensor) throw new Error("Device not found.");
    sensor.lastValue = value;
    sensor.lastReadingAt = new Date().toISOString();
    emit();
  },

  markAllRead() {
    state.notifications.forEach((n) => { if (n.biz === state.bizId) n.read = true; });
    emit();
  },
  markRead(id) {
    const n = state.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    emit();
  },

  updateSettings(patch) { Object.assign(state.settings, patch); emit(); },

  updateProfile(patch) { Object.assign(myBiz(), patch); emit(); },
};
