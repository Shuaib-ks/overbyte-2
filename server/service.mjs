import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { transaction } from "./database.mjs";
import { weightedDailySales } from "./sales-forecast.mjs";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
import {
  wasteRisk,
  surplusEstimate,
  shortageOf,
  matchScore,
} from "../src/engines.js";
const now = () => new Date().toISOString(),
  id = (p) => `${p}_${randomUUID()}`,
  round = (n) => Math.round(n * 100) / 100;
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new HttpError(status, message);
};
const str = (v, label, max = 120, optional = false) => {
  if (typeof v !== "string") {
    if (optional && v == null) return "";
    fail(`${label} is required.`);
  }
  const s = v.trim();
  if ((!optional && !s) || s.length > max)
    fail(`${label} must be ${optional ? "0" : "1"}–${max} characters.`);
  return s;
};
const num = (v, label, min = 0, max = 1e7) => {
  if (
    v == null ||
    v === "" ||
    typeof v === "boolean" ||
    !Number.isFinite(Number(v))
  )
    fail(`${label} must be a number.`);
  const n = Number(v);
  if (n < min || n > max) fail(`${label} must be between ${min} and ${max}.`);
  if (
    /quantity|consumption|adjustment|minimum order|purchase cost|price/i.test(
      label,
    ) &&
    Math.abs(n - round(n)) > 1e-8
  )
    fail(`${label} supports up to 2 decimal places.`);
  return n;
};
const nullable = (v, label, min = 0, max = 1e7) =>
  v == null || v === "" ? null : num(v, label, min, max);
const email = (v) => {
  const e = str(v, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    fail("Enter a valid email address.");
  return e;
};
const hash = (t) => createHash("sha256").update(t).digest("hex");
const passwordHash = (p) => {
  if (typeof p !== "string" || p.length < 10 || p.length > 128)
    fail("Password must contain 10–128 characters.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
};
const validPassword = (p, h) => {
  const [salt, digest] = h.split(":");
  return (
    typeof p === "string" &&
    p.length <= 128 &&
    timingSafeEqual(scryptSync(p, salt, 64), Buffer.from(digest, "hex"))
  );
};
const dummyHash = passwordHash("invalid-account-password");
const defaults = {
  autoAlerts: true,
  listingSuggestions: true,
  priceOverrideConfirm: true,
  wasteTarget: 50,
  notifyAI: true,
  notifyMarket: true,
  notifyOrders: true,
  notifySensors: true,
};
const expiry = (p, current) => {
  const t = p.expiresAt
    ? Date.parse(p.expiresAt)
    : p.shelfHours != null
      ? Date.now() + num(p.shelfHours, "Shelf life", 0.01, 87600) * 3600000
      : Date.parse(current);
  if (!Number.isFinite(t) || t <= Date.now())
    fail("Expiry must be a valid future date.");
  return new Date(t).toISOString();
};
const hours = (t) => Math.max(0, (Date.parse(t) - Date.now()) / 3600000);
const minutes = (t) =>
  Math.max(0, Math.floor((Date.now() - Date.parse(t)) / 60000));
const distance = (a, b) => {
  if ([a.lat, a.lng, b.lat, b.lng].some((v) => v == null)) return null;
  const rad = (n) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return round(6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
};

export class Service {
  constructor(db) {
    this.db = db;
    this.telemetry = null;
  }
  query(kind, sql, args) {
    const started = performance.now();
    try {
      return this.db.prepare(sql)[kind](...args);
    } finally {
      const durationMs = performance.now() - started;
      if (this.telemetry) {
        this.telemetry.dbCalls++;
        this.telemetry.dbMs += durationMs;
      }
      if (durationMs > 500) console.warn(JSON.stringify({
        event: "overbyte.slow_query", requestId: this.telemetry?.requestId,
        method: kind, query: sql.replace(/\s+/g, " ").slice(0, 110),
        durationMs: Math.round(durationMs),
      }));
    }
  }
  one(sql, ...args) {
    return this.query("get", sql, args);
  }
  all(sql, ...args) {
    return this.query("all", sql, args);
  }
  run(sql, ...args) {
    return this.query("run", sql, args);
  }
  tx(fn) {
    return transaction(this.db, fn);
  }
  authAttempt(keys) {
    const stamp = Date.now();
    const exceeded = this.tx(() => {
      this.run("DELETE FROM auth_attempts WHERE reset_at<=?", stamp);
      let blocked = false;
      for (const key of keys) {
        const k = hash(key);
        this.run(
          "INSERT INTO auth_attempts VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=attempts+1",
          k,
          stamp + 900000,
        );
        if (
          this.one("SELECT attempts FROM auth_attempts WHERE key_hash=?", k)
            .attempts > 30
        )
          blocked = true;
      }
      return blocked;
    });
    if (exceeded)
      fail("Too many sign-in attempts. Try again in 15 minutes.", 429);
  }
  settings(b) {
    return {
      ...defaults,
      ...JSON.parse(
        this.one("SELECT settings FROM businesses WHERE id=?", b).settings,
      ),
    };
  }
  session(token) {
    if (!token) return null;
    return (
      this.one(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
        hash(token),
        now(),
      ) || null
    );
  }
  newSession(user) {
    const token = randomBytes(32).toString("hex");
    this.run("DELETE FROM sessions WHERE expires_at<=?", now());
    this.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hash(token),
      user.id,
      new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString(),
    );
    return token;
  }
  signup(p) {
    const e = email(p.email),
      ph = passwordHash(p.password),
      name = str(p.name, "Business name"),
      type = str(p.type || "Restaurant", "Business type", 60),
      loc = str(p.loc, "Location", 240);
    return this.tx(() => {
      if (this.one("SELECT id FROM users WHERE email=?", e))
        fail("An account already uses this email. Sign in instead.", 409);
      const b = id("biz"),
        u = id("usr");
      this.run(
        "INSERT INTO businesses(id,name,type,loc,contact,created_at) VALUES(?,?,?,?,?,?)",
        b,
        name,
        type,
        loc,
        e,
        now(),
      );
      this.run("INSERT INTO users VALUES(?,?,?,?,?)", u, b, e, ph, now());
      const user = this.one("SELECT * FROM users WHERE id=?", u);
      return { user, token: this.newSession(user) };
    });
  }
  login(p) {
    const e = email(p.email),
      u = this.one("SELECT * FROM users WHERE email=?", e);
    if (!validPassword(p.password, u?.password_hash || dummyHash) || !u)
      fail("Email or password is incorrect.", 401);
    return { user: u, token: this.newSession(u) };
  }
  logout(token) {
    if (token) this.run("DELETE FROM sessions WHERE token_hash=?", hash(token));
  }
  owned(table, record, b) {
    const row = this.one(
      `SELECT * FROM ${table} WHERE id=? AND business_id=?`,
      record,
      b,
    );
    if (!row) fail("Record not found.", 404);
    return row;
  }
  notify(b, kind, title, body, link = null, event = null, priority = "info", currentSettings = null) {
    const settings = currentSettings || this.settings(b),
      key =
        kind === "ORDER"
          ? "notifyOrders"
          : kind === "SENSOR"
            ? "notifySensors"
            : ["AI ALERT", "SHORTAGE"].includes(kind)
              ? "notifyAI"
              : ["LISTING", "MARKETPLACE"].includes(kind)
                ? "notifyMarket"
                : null;
    if (key && !settings[key]) return;
    this.run(
      "INSERT OR IGNORE INTO notifications VALUES(?,?,?,?,?,?,?,?,?,?)",
      id("n"),
      b,
      kind,
      priority,
      title,
      body,
      link,
      event,
      0,
      now(),
    );
  }
  movement(b, item, kind, qty) {
    this.run(
      "INSERT INTO inventory_transactions VALUES(?,?,?,?,?,?)",
      id("txn"),
      b,
      item,
      kind,
      qty,
      now(),
    );
  }
  committed(item) {
    const a = this.one(
      "SELECT COALESCE(SUM(remaining),0) n FROM listings WHERE inventory_id=? AND status='Active' AND expires_at>?",
      item,
      now(),
    ).n;
    const b = this.one(
      "SELECT COALESCE(SUM(o.qty),0) n FROM orders o JOIN listings l ON l.id=o.listing_id WHERE l.inventory_id=? AND o.status='Ready for pickup'",
      item,
    ).n;
    return round(a + b);
  }
  addInventory(b, p) {
    return this.tx(() => {
      const key = p.idempotencyKey == null ? null : str(p.idempotencyKey, "Inventory request key", 100);
      const payload = { ...p };
      delete payload.idempotencyKey;
      const payloadHash = hash(JSON.stringify(Object.keys(payload).sort().map((name) => [name, payload[name]])));
      if (key) {
        const previous = this.one(
          "SELECT inventory_id,payload_hash FROM inventory_create_requests WHERE business_id=? AND idempotency_key=?",
          b, key,
        );
        if (previous) {
          if (previous.payload_hash !== payloadHash)
            fail("This inventory request key was already used for different details.", 409);
          return { id: previous.inventory_id };
        }
      }
      const product = str(p.product, "Product"),
        category = str(p.category || "Other", "Category", 60),
        unit = str(p.unit, "Unit", 20);
      if (!["kg", "g", "L", "ml", "pcs", "packs"].includes(unit))
        fail("Select a supported unit.");
      const qty = num(p.qty, "Quantity", 0.01),
        cost = num(p.cost, "Purchase cost", 0, 1e6),
        market = nullable(p.market, "Reference price", 0, 1e6),
        expires = expiry(p),
        demand = nullable(p.dailyDemand, "Daily demand"),
        storage = str(p.storage || "Refrigerated", "Storage", 120),
        supplier = str(p.supplier, "Supplier", 120, true),
        batch = str(p.batch, "Batch", 120, true),
        iid = id("it");
      if (["pcs", "packs"].includes(unit) && qty % 1)
        fail("Piece and pack quantities must be whole numbers.");
      this.run(
        "INSERT INTO inventory VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        iid,
        b,
        product,
        category,
        unit,
        qty,
        cost,
        market,
        expires,
        demand,
        storage,
        supplier,
        batch,
        now(),
        now(),
      );
      if (key) this.run(
        "INSERT INTO inventory_create_requests VALUES(?,?,?,?)",
        b, key, iid, payloadHash,
      );
      this.movement(b, iid, "received", qty);
      this.notify(
        b,
        "INVENTORY",
        "Inventory added",
        `${qty} ${unit} ${product} added.`,
        `#/app/inventory/${iid}`,
      );
      return { id: iid };
    });
  }
  updateInventory(b, iid, p) {
    return this.tx(() => {
      const i = this.owned("inventory", iid, b);
      const committed = this.committed(iid);
      const product = p.product == null ? i.product : str(p.product, "Product"),
        unit = p.unit == null ? i.unit : str(p.unit, "Unit", 20);
      if (!["kg", "g", "L", "ml", "pcs", "packs"].includes(unit))
        fail("Select a supported unit.");
      if (
        (product !== i.product || unit !== i.unit) &&
        (this.one("SELECT id FROM listings WHERE inventory_id=?", iid) ||
          this.one(
            "SELECT sale_id FROM inventory_sale_allocations WHERE inventory_id=?",
            iid,
          ))
      )
        fail(
          "Product and unit cannot change after this batch has been listed or sold. Add a new batch.",
        );
      const e = p.expiresAt || p.shelfHours != null ? expiry(p) : i.expires_at;
      if (
        committed > 0 &&
        (e !== i.expires_at || (p.cost != null && Number(p.cost) !== i.cost))
      )
        fail("Cancel open listings and orders before changing expiry or cost.");
      this.run(
        "UPDATE inventory SET product=?,category=?,unit=?,cost=?,market=?,expires_at=?,daily_demand=?,storage=?,supplier=?,batch=?,updated_at=? WHERE id=?",
        product,
        p.category == null ? i.category : str(p.category, "Category", 60),
        unit,
        p.cost == null ? i.cost : num(p.cost, "Purchase cost", 0, 1e6),
        p.market === undefined
          ? i.market
          : nullable(p.market, "Reference price", 0, 1e6),
        e,
        p.dailyDemand === undefined
          ? i.daily_demand
          : nullable(p.dailyDemand, "Daily demand"),
        p.storage == null ? i.storage : str(p.storage, "Storage", 120),
        p.supplier == null
          ? i.supplier
          : str(p.supplier, "Supplier", 120, true),
        p.batch == null ? i.batch : str(p.batch, "Batch", 120, true),
        now(),
        iid,
      );
      return { id: iid };
    });
  }
  adjust(b, iid, p, consume = false) {
    return this.tx(() => {
      const i = this.owned("inventory", iid, b),
        delta = consume
          ? -num(p.qty, "Consumption", 0.01)
          : num(p.delta, "Adjustment", -1e7, 1e7);
      if (delta === 0) fail("Enter a nonzero adjustment.");
      const kind = consume ? "consumption" : p.kind || "adjustment";
      if (
        !["consumption", "adjustment", "received", "waste"].includes(kind) ||
        (kind === "received" && delta < 0) ||
        (kind === "waste" && delta > 0)
      )
        fail("Invalid stock movement.");
      if (["pcs", "packs"].includes(i.unit) && delta % 1)
        fail("Piece and pack quantities must be whole numbers.");
      const next = round(i.qty + delta);
      if (next < 0 || next < this.committed(iid) - 0.001)
        fail(
          "This change would use stock reserved for a listing or order. Cancel the reservation first.",
          409,
        );
      this.run(
        "UPDATE inventory SET qty=?,updated_at=? WHERE id=?",
        next,
        now(),
        iid,
      );
      this.movement(b, iid, kind, delta);
      return { id: iid, qty: next };
    });
  }
  saleView(sale) {
    return {
      id: sale.id,
      product: sale.product,
      unit: sale.unit,
      qty: sale.qty,
      createdAt: sale.created_at,
      allocations: this.all(
        "SELECT a.inventory_id AS inventoryItemId,i.batch,a.qty FROM inventory_sale_allocations a JOIN inventory i ON i.id=a.inventory_id WHERE a.sale_id=? ORDER BY i.expires_at,i.created_at,i.id",
        sale.id,
      ),
    };
  }
  salesHistory(b) {
    const sales = this.all(
      "SELECT * FROM inventory_sales WHERE business_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
      b,
    );
    if (!sales.length) return [];
    const allocations = this.all(
      "SELECT a.sale_id,a.inventory_id AS inventoryItemId,i.batch,a.qty FROM inventory_sale_allocations a JOIN inventory i ON i.id=a.inventory_id WHERE a.sale_id IN (SELECT id FROM inventory_sales WHERE business_id=? ORDER BY created_at DESC,id DESC LIMIT 100) ORDER BY i.expires_at,i.created_at,i.id",
      b,
    );
    const bySale = new Map();
    for (const row of allocations) {
      if (!bySale.has(row.sale_id)) bySale.set(row.sale_id, []);
      const { sale_id, ...allocation } = row;
      bySale.get(sale_id).push(allocation);
    }
    return sales.map((sale) => ({
      id: sale.id, product: sale.product, unit: sale.unit, qty: sale.qty,
      createdAt: sale.created_at, allocations: bySale.get(sale.id) || [],
    }));
  }
  registerSale(b, iid, p) {
    return this.tx(() => {
      const item = this.owned("inventory", iid, b);
      const qty = num(p.qty, "Quantity sold", 0.01);
      const key = str(p.idempotencyKey, "Sale request key", 100);
      if (["pcs", "packs"].includes(item.unit) && qty % 1)
        fail("Piece and pack quantities must be whole numbers.");
      const prior = this.one(
        "SELECT * FROM inventory_sales WHERE business_id=? AND idempotency_key=?",
        b,
        key,
      );
      if (prior) {
        if (
          prior.product.toLowerCase() !== item.product.toLowerCase() ||
          prior.unit !== item.unit ||
          prior.qty !== qty
        )
          fail("This request key was used for a different sale.", 409);
        return this.saleView(prior);
      }
      const stamp = now();
      const batches = this.all(
        "SELECT * FROM inventory WHERE business_id=? AND lower(product)=lower(?) AND unit=? AND qty>0 AND expires_at>? ORDER BY expires_at,created_at,id",
        b,
        item.product,
        item.unit,
        stamp,
      ).map((batch) => ({
        ...batch,
        available: Math.max(
          0,
          Math.round((batch.qty - this.committed(batch.id)) * 100),
        ),
      }));
      let remaining = Math.round(qty * 100);
      const available = batches.reduce(
        (sum, batch) => sum + batch.available,
        0,
      );
      if (remaining > available)
        fail(
          `Only ${available / 100} ${item.unit} is available to sell. Expired stock and marketplace reservations are excluded.`,
          409,
        );
      const saleId = id("sale");
      this.run(
        "INSERT INTO inventory_sales VALUES(?,?,?,?,?,?,?)",
        saleId,
        b,
        item.product,
        item.unit,
        qty,
        key,
        stamp,
      );
      for (const batch of batches) {
        if (!remaining) break;
        const take = Math.min(remaining, batch.available);
        if (!take) continue;
        this.run(
          "UPDATE inventory SET qty=?,updated_at=? WHERE id=?",
          (Math.round(batch.qty * 100) - take) / 100,
          stamp,
          batch.id,
        );
        this.run(
          "INSERT INTO inventory_sale_allocations VALUES(?,?,?)",
          saleId,
          batch.id,
          take / 100,
        );
        this.movement(b, batch.id, "retail_sale", -take / 100);
        remaining -= take;
      }
      return this.saleView(
        this.one("SELECT * FROM inventory_sales WHERE id=?", saleId),
      );
    });
  }
  inventory(b) {
    const rows = this.all(
        "SELECT * FROM inventory WHERE business_id=? ORDER BY expires_at,created_at,id",
        b,
      ),
      groups = new Map();
    if (!rows.length) return [];
    const today = now(),
      key = (product, unit) => `${product.toLowerCase()}|${unit}`,
      keyed = (entries) => new Map(entries.map((row) => [key(row.product, row.unit), row]));
    const consumptionByProduct = keyed(this.all(
      "SELECT lower(i.product) product,i.unit,COALESCE(SUM(-t.qty),0) qty,MIN(t.created_at) first FROM inventory_transactions t JOIN inventory i ON i.id=t.inventory_id WHERE t.business_id=? AND t.kind='consumption' AND t.created_at>=? GROUP BY lower(i.product),i.unit",
      b, new Date(Date.now() - 7 * 86400000).toISOString(),
    ));
    const firstSaleByProduct = keyed(this.all(
      "SELECT lower(product) product,unit,MIN(created_at) first FROM inventory_sales WHERE business_id=? AND created_at<=? GROUP BY lower(product),unit",
      b, today,
    ));
    const salesByProduct = new Map();
    for (const sale of this.all(
      "SELECT product,unit,qty,created_at AS createdAt FROM inventory_sales WHERE business_id=? AND created_at>=? AND created_at<=?",
      b, new Date(Math.floor(Date.now() / 86400000) * 86400000 - 6 * 86400000).toISOString(), today,
    )) {
      const group = key(sale.product, sale.unit);
      if (!salesByProduct.has(group)) salesByProduct.set(group, []);
      salesByProduct.get(group).push(sale);
    }
    const incomingByProduct = keyed(this.all(
      "SELECT lower(i.product) product,i.unit,COALESCE(SUM(o.qty),0) n FROM orders o JOIN listings l ON l.id=o.listing_id JOIN inventory i ON i.id=l.inventory_id WHERE o.buyer_id=? AND o.status='Ready for pickup' AND l.expires_at>? GROUP BY lower(i.product),i.unit",
      b, today,
    ));
    const committedByItem = new Map(this.all(
      "SELECT inventory_id,SUM(qty) n FROM (SELECT inventory_id,remaining qty FROM listings WHERE business_id=? AND status='Active' AND expires_at>? UNION ALL SELECT l.inventory_id,o.qty FROM orders o JOIN listings l ON l.id=o.listing_id WHERE l.business_id=? AND o.status='Ready for pickup') GROUP BY inventory_id",
      b, today, b,
    ).map((row) => [row.inventory_id, round(row.n)]));
    for (const r of rows) {
      const k = key(r.product, r.unit);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const out = [];
    const getCommitted = (itemId) => committedByItem.get(itemId) || 0;
    for (const list of groups.values()) {
      const group = key(list[0].product, list[0].unit);
      const planned = list
        .filter((r) => r.daily_demand != null)
        .sort((a, z) => z.updated_at.localeCompare(a.updated_at))[0];
      const consumption = consumptionByProduct.get(group) || { qty: 0, first: null };
      const days = consumption.first
        ? Math.max(
            1,
            Math.min(
              7,
              (Date.now() - Date.parse(consumption.first)) / 86400000,
            ),
          )
        : 0;
      const recordedSales = firstSaleByProduct.get(group);
      const trackedSince = list.reduce(
        (first, row) => (row.created_at < first ? row.created_at : first),
        list[0].created_at,
      );
      const salesForecast = recordedSales?.first
        ? weightedDailySales(
            salesByProduct.get(group) || [],
            {
              now: Date.now(),
              startedAt:
                recordedSales.first < trackedSince
                  ? recordedSales.first
                  : trackedSince,
            },
          )
        : null;
      const daily = salesForecast
        ? salesForecast.averageDailySales
        : planned
          ? planned.daily_demand
          : days
            ? round(consumption.qty / days)
            : null;
      const incomingQty = incomingByProduct.get(group)?.n || 0;
      let allocatedDemand = 0;
      const totalAvailable = list
        .filter((r) => hours(r.expires_at) > 0)
        .reduce((s, r) => s + Math.max(0, r.qty - getCommitted(r.id)), 0);
      let shortageGiven = false;
      for (const r of list) {
        const shelfHours = hours(r.expires_at),
          reserved = getCommitted(r.id),
          available = Math.max(0, round(r.qty - reserved));
        const demand =
          daily == null
            ? null
            : round(Math.max(0, (daily * shelfHours) / 24 - allocatedDemand));
        allocatedDemand += Math.min(available, demand || 0);
        const risk = wasteRisk({
          stock: available,
          expectedDemand: demand,
          shelfHours,
        });
        const surplus = surplusEstimate({
          stock: available,
          expectedDemand: demand,
        });
        const shortage =
          !shortageGiven && shelfHours > 0
            ? shortageOf({
                stock: totalAvailable + incomingQty,
                expectedDemand: daily,
              })
            : null;
        if (shortage) shortageGiven = true;
        out.push({
          id: r.id,
          product: r.product,
          category: r.category,
          unit: r.unit,
          qty: r.qty,
          cost: r.cost,
          market: r.market,
          expiresAt: r.expires_at,
          shelfHours,
          storage: r.storage,
          supplier: r.supplier,
          batch: r.batch,
          dailyDemand: r.daily_demand,
          effectiveDailyDemand: daily,
          demandSource: salesForecast
            ? "sales"
            : planned
              ? "planned"
              : days
                ? "consumption"
                : "none",
          salesDailyAverage: salesForecast?.averageDailySales ?? null,
          salesObservationDays: salesForecast?.observationDays ?? 0,
          salesWindowDays: 7,
          salesHistoryAvailable: !!salesForecast,
          forecastAvailable: daily != null,
          demand,
          risk,
          surplus,
          shortage,
          incomingQty,
          reservedQty: reserved,
          availableToList: available,
          value: round(r.qty * r.cost),
          marketValue: r.market ? round(r.qty * r.market) : null,
          aiStatus:
            shelfHours <= 0
              ? "Expired"
              : daily == null
                ? "Needs demand data"
                : surplus.mid > 0
                  ? "Surplus risk"
                  : shortage
                    ? "Shortage"
                    : "Healthy",
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        });
      }
    }
    return out;
  }
  alerts(b, inv = this.inventory(b), currentSettings = this.settings(b)) {
    if (!currentSettings.autoAlerts) return [];
    const threshold = currentSettings.wasteTarget,
      dismissals = new Map(this.all(
        "SELECT alert_id,fingerprint FROM alert_dismissals WHERE business_id=?",
        b,
      ).map((row) => [row.alert_id, row.fingerprint])),
      out = [];
    for (const i of inv) {
      const kinds = [];
      if (i.shelfHours <= 0 && i.qty > 0) kinds.push("expiry");
      else {
        if (
          i.forecastAvailable &&
          i.surplus.mid > 0 &&
          (i.demandSource === "sales" || i.risk.probability >= threshold)
        )
          kinds.push("surplus");
        if (i.shortage) kinds.push("shortage");
      }
      for (const kind of kinds) {
        const aid = `${kind}_${i.id}`,
          fingerprint = `${kind}|${i.qty}|${i.demandSource}|${i.effectiveDailyDemand}|${i.reservedQty}|${i.risk.risk}|${kind === "shortage" ? (i.shortage?.qty ?? 0) : ""}`;
        const dismissed = dismissals.get(aid) === fingerprint;
        out.push({
          id: aid,
          biz: b,
          item: i.id,
          itemId: i.id,
          inventoryItemId: i.id,
          product: i.product,
          unit: i.unit,
          kind,
          type: kind,
          qty: i.qty,
          stock: i.qty,
          demand: i.demand,
          expectedDemand: i.demand,
          shelfHours: i.shelfHours,
          wasteProb: i.risk.probability,
          risk: i.risk.risk,
          severity: kind === "expiry" ? "high" : i.risk.risk,
          surplus: i.surplus,
          shortage: i.shortage?.qty || 0,
          byLabel: i.shortage?.byLabel,
          status: dismissed ? "dismissed" : "pending",
          fingerprint,
          reasons: i.risk.factors,
          createdAt: i.updatedAt,
        });
      }
    }
    return out;
  }
  reconcile(b) {
    this.run(
      "UPDATE listings SET status='Expired' WHERE business_id=? AND status IN ('Active','Reserved') AND expires_at<=?",
      b,
      now(),
    );
    const inv = this.inventory(b),
      settings = this.settings(b),
      alerts = this.alerts(b, inv, settings);
    const pending = alerts.filter((a) => a.status === "pending");
    const eventKey = (a) => `${a.id}|${a.fingerprint}`;
    const existing = new Set();
    for (let offset = 0; offset < pending.length; offset += 100) {
      const keys = pending.slice(offset, offset + 100).map(eventKey);
      for (const row of this.all(
        `SELECT event_key FROM notifications WHERE business_id=? AND event_key IN (${keys.map(() => "?").join(",")})`,
        b, ...keys,
      )) existing.add(row.event_key);
    }
    for (const a of pending) {
      if (existing.has(eventKey(a))) continue;
      this.notify(
        b,
        a.kind === "shortage" ? "SHORTAGE" : "AI ALERT",
        a.kind === "shortage"
          ? `${a.product}: projected shortage`
          : a.kind === "expiry"
            ? `${a.product}: batch expired`
            : `${a.product}: surplus projected`,
        a.kind === "shortage"
          ? `${a.shortage} ${a.unit} short against expected daily use.`
          : a.kind === "expiry"
            ? "This batch has expired. Remove it from usable stock."
            : `${a.surplus.mid} ${a.unit} may remain before expiry. Review your inventory.`,
        `#/app/inventory/${a.itemId}`,
        eventKey(a),
        a.kind === "expiry" ? "critical" : "high",
        settings,
      );
      existing.add(eventKey(a));
    }
    const value = inv.reduce((n, i) => n + i.value, 0),
      known = inv.filter((i) => i.forecastAvailable && i.qty > 0),
      risk = known.length
        ? known.reduce((n, i) => n + i.risk.probability, 0) / known.length
        : 0;
    this.run(
      "INSERT INTO daily_snapshots VALUES(?,?,?,?) ON CONFLICT(business_id,day) DO UPDATE SET inventory_value=excluded.inventory_value,risk=excluded.risk",
      b,
      now().slice(0, 10),
      round(value),
      round(risk),
    );
    return { inv, alerts, settings };
  }
  createListing(b, p) {
    return this.tx(() => {
      const i = this.owned(
          "inventory",
          str(p.inventoryItemId, "Inventory batch ID", 80),
          b,
        ),
        qty = num(p.qty, "Listing quantity", 0.01),
        price = num(p.price, "Price", 0.01, 1e6),
        min = num(p.minOrder ?? 1, "Minimum order", 0.01, qty);
      if (["pcs", "packs"].includes(i.unit) && (qty % 1 || min % 1))
        fail("Piece and pack quantities must be whole numbers.");
      if (qty > round(i.qty - this.committed(i.id)))
        fail("Listing exceeds unreserved stock.", 409);
      const requested =
        p.shelfHours != null || p.expiresAt ? expiry(p) : i.expires_at;
      if (p.expiresAt && Date.parse(requested) > Date.parse(i.expires_at))
        fail("A listing cannot outlive its inventory batch.");
      const expires = new Date(
        Math.min(Date.parse(requested), Date.parse(i.expires_at)),
      ).toISOString();
      if (Date.parse(expires) <= Date.now())
        fail("Expired stock cannot be listed.");
      const lid = id("lst"),
        pickup = str(p.pickup, "Pickup window", 200),
        notes = str(p.notes, "Notes", 2000, true),
        cond = str(p.cond || "Fresh", "Condition", 60),
        storage = str(p.storage || i.storage, "Storage", 120);
      this.run(
        "INSERT INTO listings VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        lid,
        b,
        i.id,
        qty,
        qty,
        price,
        min,
        expires,
        pickup,
        notes,
        cond,
        storage,
        "Active",
        now(),
      );
      this.notify(
        b,
        "LISTING",
        "Surplus listing published",
        `${qty} ${i.unit} ${i.product} is available.`,
        `#/app/surplus/${lid}`,
      );
      for (const w of this.all(
        "SELECT * FROM watches WHERE business_id<>?",
        b,
      )) {
        if (i.product.toLowerCase().includes(w.product.toLowerCase()))
          this.notify(
            w.business_id,
            "MARKETPLACE",
            "A matching listing is available",
            `${qty} ${i.unit} ${i.product} has been listed.`,
            `#/app/surplus/${lid}`,
            `watch|${w.id}|${lid}`,
          );
      }
      return { id: lid };
    });
  }
  cancelListing(b, lid) {
    return this.tx(() => {
      const l = this.owned("listings", lid, b);
      if (!["Active", "Reserved"].includes(l.status))
        fail("Only live listings can be cancelled.", 409);
      this.run("UPDATE listings SET status='Cancelled' WHERE id=?", lid);
      return { id: lid };
    });
  }
  createOrder(b, p) {
    return this.tx(() => {
      const lid = str(p.listingId, "Listing", 80),
        qty = num(p.qty, "Quantity", 0.01),
        key = str(p.idempotencyKey, "Order request key", 100);
      const prior = this.one(
        "SELECT * FROM orders WHERE buyer_id=? AND idempotency_key=?",
        b,
        key,
      );
      if (prior) {
        if (prior.listing_id !== lid || prior.qty !== qty)
          fail("This request key was used for a different order.", 409);
        return { id: prior.id };
      }
      const l = this.one(
        "SELECT l.*,i.product,i.unit,i.market FROM listings l JOIN inventory i ON i.id=l.inventory_id WHERE l.id=?",
        lid,
      );
      if (!l) fail("Listing not found.", 404);
      if (l.business_id === b) fail("You cannot purchase your own listing.");
      if (
        l.status !== "Active" ||
        hours(l.expires_at) <= 0 ||
        qty > l.remaining
      )
        fail("This quantity is no longer available.", 409);
      if (qty < l.min_order && qty !== l.remaining)
        fail(`Minimum order is ${l.min_order} ${l.unit}.`);
      if (["pcs", "packs"].includes(l.unit) && qty % 1)
        fail("Piece and pack quantities must be whole numbers.");
      const oid = id("OB"),
        left = round(l.remaining - qty);
      const ownCost =
        this.one(
          "SELECT cost FROM inventory WHERE business_id=? AND lower(product)=lower(?) AND unit=? ORDER BY updated_at DESC LIMIT 1",
          b,
          l.product,
          l.unit,
        )?.cost ?? null;
      this.run(
        "INSERT INTO orders(id,listing_id,buyer_id,seller_id,qty,price,total_paise,reference_price,status,pickup,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        oid,
        lid,
        b,
        l.business_id,
        qty,
        l.price,
        Math.round(qty * l.price * 100),
        ownCost,
        "Ready for pickup",
        l.pickup,
        key,
        now(),
      );
      this.run(
        "UPDATE listings SET remaining=?,status=? WHERE id=?",
        left,
        left > 0 ? "Active" : "Reserved",
        lid,
      );
      this.notify(
        b,
        "ORDER",
        "Order confirmed",
        `${qty} ${l.unit} ${l.product} reserved. Pay at pickup.`,
        `#/app/orders`,
      );
      this.notify(
        l.business_id,
        "ORDER",
        "New surplus order",
        `${qty} ${l.unit} ${l.product} reserved for pickup.`,
        `#/app/orders`,
        null,
        "high",
      );
      return { id: oid };
    });
  }
  orderFor(b, oid) {
    const o = this.one(
      "SELECT * FROM orders WHERE id=? AND (buyer_id=? OR seller_id=?)",
      oid,
      b,
      b,
    );
    if (!o) fail("Order not found.", 404);
    return o;
  }
  advanceOrder(b, oid) {
    return this.tx(() => {
      const o = this.orderFor(b, oid);
      if (o.seller_id !== b) fail("Only the seller can confirm handover.", 403);
      if (o.status === "Completed") return { id: oid };
      if (o.status === "Picked up") {
        this.run(
          "UPDATE orders SET status='Completed',completed_at=? WHERE id=?",
          now(),
          oid,
        );
        return { id: oid };
      }
      if (o.status !== "Ready for pickup")
        fail("This order cannot advance.", 409);
      const l = this.one("SELECT * FROM listings WHERE id=?", o.listing_id),
        i = this.one("SELECT * FROM inventory WHERE id=?", l.inventory_id);
      if (hours(l.expires_at) <= 0)
        fail("The batch has expired. Cancel this order instead.", 409);
      if (i.qty < o.qty) fail("Insufficient physical stock for handover.", 409);
      this.run(
        "UPDATE inventory SET qty=?,updated_at=? WHERE id=?",
        round(i.qty - o.qty),
        now(),
        i.id,
      );
      this.movement(b, i.id, "sale", -o.qty);
      const iid = id("it");
      this.run(
        "INSERT INTO inventory VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        iid,
        o.buyer_id,
        i.product,
        i.category,
        i.unit,
        o.qty,
        o.price,
        i.market,
        l.expires_at,
        null,
        l.storage,
        this.one("SELECT name FROM businesses WHERE id=?", b).name,
        oid,
        now(),
        now(),
      );
      this.movement(o.buyer_id, iid, "purchase", o.qty);
      this.run(
        "UPDATE orders SET status='Picked up',picked_at=?,payment_status='Pay at pickup · confirm offline' WHERE id=?",
        now(),
        oid,
      );
      if (
        l.remaining === 0 &&
        !this.one(
          "SELECT id FROM orders WHERE listing_id=? AND status='Ready for pickup'",
          l.id,
        ) &&
        l.status === "Reserved"
      )
        this.run("UPDATE listings SET status='Sold' WHERE id=?", l.id);
      this.notify(
        o.buyer_id,
        "ORDER",
        "Pickup recorded",
        `${o.qty} ${i.unit} ${i.product} added to your inventory.`,
        `#/app/inventory/${iid}`,
      );
      this.notify(
        b,
        "ORDER",
        "Stock handed over",
        `${o.qty} ${i.unit} ${i.product} deducted from stock.`,
        `#/app/orders`,
      );
      return { id: oid };
    });
  }
  cancelOrder(b, oid) {
    return this.tx(() => {
      const o = this.orderFor(b, oid);
      if (o.status === "Cancelled") return { id: oid };
      if (o.status !== "Ready for pickup")
        fail("Orders cannot be cancelled after pickup.", 409);
      this.run(
        "UPDATE orders SET status='Cancelled',payment_status='No payment due' WHERE id=?",
        oid,
      );
      const l = this.one("SELECT * FROM listings WHERE id=?", o.listing_id);
      if (["Active", "Reserved"].includes(l.status) && hours(l.expires_at) > 0)
        this.run(
          "UPDATE listings SET remaining=?,status='Active' WHERE id=?",
          round(l.remaining + o.qty),
          l.id,
        );
      for (const party of [o.buyer_id, o.seller_id])
        this.notify(
          party,
          "ORDER",
          "Order cancelled",
          "The reservation has been released.",
          "#/app/orders",
        );
      return { id: oid };
    });
  }
  profile(b, p) {
    const old = this.one("SELECT * FROM businesses WHERE id=?", b);
    const lat =
        p.lat === undefined ? old.lat : nullable(p.lat, "Latitude", -90, 90),
      lng =
        p.lng === undefined ? old.lng : nullable(p.lng, "Longitude", -180, 180);
    if ((lat == null) !== (lng == null))
      fail("Provide both coordinates or leave both blank.");
    this.run(
      "UPDATE businesses SET name=?,type=?,loc=?,owner=?,contact=?,pickup=?,lat=?,lng=? WHERE id=?",
      p.name == null ? old.name : str(p.name, "Business name"),
      p.type == null ? old.type : str(p.type, "Business type", 60),
      p.loc == null ? old.loc : str(p.loc, "Location", 240),
      p.owner == null ? old.owner : str(p.owner, "Contact", 120, true),
      p.email == null ? old.contact : p.email ? email(p.email) : "",
      p.pickup == null ? old.pickup : str(p.pickup, "Pickup hours", 200, true),
      lat,
      lng,
      b,
    );
    return { id: b };
  }
  updateSettings(b, p) {
    const s = this.settings(b);
    for (const k of Object.keys(defaults)) {
      if (p[k] === undefined) continue;
      if (k === "wasteTarget") s[k] = num(p[k], "Alert threshold", 5, 80);
      else {
        if (typeof p[k] !== "boolean")
          fail("Preference must be true or false.");
        s[k] = p[k];
      }
    }
    this.run(
      "UPDATE businesses SET settings=? WHERE id=?",
      JSON.stringify(s),
      b,
    );
    return s;
  }
  dismiss(b, aid) {
    const a = this.alerts(b).find((a) => a.id === aid);
    if (!a) fail("Alert no longer active.", 404);
    this.run(
      "INSERT INTO alert_dismissals VALUES(?,?,?) ON CONFLICT(business_id,alert_id) DO UPDATE SET fingerprint=excluded.fingerprint",
      b,
      aid,
      a.fingerprint,
    );
    return { id: aid };
  }
  addSensor(b, p) {
    const sid = id("sensor");
    this.run(
      "INSERT INTO sensors VALUES(?,?,?,?,?,?)",
      sid,
      b,
      str(p.name, "Device name"),
      str(p.type, "Device type", 60),
      str(p.unit, "Unit", 20),
      now(),
    );
    return { id: sid };
  }
  reading(b, sid, p) {
    return this.tx(() => {
      const s = this.owned("sensors", sid, b),
        value = num(p.value, "Reading", -1e9, 1e9);
      this.run(
        "INSERT INTO sensor_readings VALUES(?,?,?,?)",
        id("reading"),
        sid,
        value,
        now(),
      );
      this.notify(
        b,
        "SENSOR",
        "Device reading recorded",
        `${s.name}: ${value} ${s.unit}`,
        "#/app/settings",
      );
      return { id: sid };
    });
  }
  watch(b, p) {
    const product = str(p.product, "Product");
    this.run(
      "INSERT OR IGNORE INTO watches VALUES(?,?,?,?)",
      id("watch"),
      b,
      product,
      now(),
    );
    return { product };
  }
  publicBiz(r, own = false, orderCount = null) {
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      loc: r.loc,
      verified: false,
      rating: null,
      initials: r.name
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join(""),
      color: "#8577ff",
      pickup: r.pickup,
      orders: orderCount ?? this.one(
        "SELECT COUNT(*) n FROM orders WHERE seller_id=? AND status IN ('Picked up','Completed')",
        r.id,
      ).n,
      ...(own
        ? { owner: r.owner, email: r.contact, lat: r.lat, lng: r.lng }
        : {}),
    };
  }
  orderView(o, b, item = null, contactValue = null) {
    const i = item || this.one(
      "SELECT i.product,i.unit FROM listings l JOIN inventory i ON i.id=l.inventory_id WHERE l.id=?",
      o.listing_id,
    );
    const contact = contactValue ?? (
      this.one(
        "SELECT contact FROM businesses WHERE id=?",
        o.buyer_id === b ? o.seller_id : o.buyer_id,
      )?.contact || "");
    return {
      id: o.id,
      counterpartyContact: contact,
      listingId: o.listing_id,
      buyer: o.buyer_id,
      seller: o.seller_id,
      product: i.product,
      unit: i.unit,
      qty: o.qty,
      price: o.price,
      total: o.total_paise / 100,
      status: o.status,
      pickup: o.pickup,
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      placedMins: minutes(o.created_at),
      pickedAt: o.picked_at,
      completedAt: o.completed_at,
    };
  }
  analytics(b, orders) {
    const startDay = new Date(Date.now() - 13 * 86400000)
      .toISOString()
      .slice(0, 10);
    orders = orders.filter((o) => o.created_at.slice(0, 10) >= startDay);
    const snaps = this.all(
        "SELECT * FROM daily_snapshots WHERE business_id=? ORDER BY day",
        b,
      ),
      sales = orders.filter((o) => o.seller_id === b && o.picked_at),
      purchases = orders.filter((o) => o.buyer_id === b && o.picked_at),
      ls = this.all(
        "SELECT l.*,i.product,i.unit FROM listings l JOIN inventory i ON i.id=l.inventory_id WHERE l.business_id=? AND l.created_at>=?",
        b,
        startDay,
      ),
      listingProducts = new Map(orders.map((row) => [row.listing_id, row])),
      days = snaps.filter((row) => row.day >= startDay).map((row) => row.day),
      sum = (xs, f) => round(xs.reduce((n, x) => n + f(x), 0)),
      savings = (o) =>
        o.reference_price == null
          ? 0
          : Math.max(0, o.qty * o.reference_price - o.total_paise / 100),
      unit = (o) => listingProducts.get(o.listing_id)?.unit;
    const top = (items) =>
      Object.entries(
        items.reduce((a, l) => {
          const name = l.product;
          if (name) a[name] = (a[name] || 0) + 1;
          return a;
        }, {}),
      )
        .sort((a, z) => z[1] - a[1])
        .slice(0, 6);
    return {
      foodSaved: sum(sales, (o) => o.total_paise / 100),
      recoveredKg: sum(
        sales.filter((o) => ["kg", "g"].includes(unit(o))),
        (o) => (unit(o) === "g" ? o.qty / 1000 : o.qty),
      ),
      wasteKg: this.one(
        "SELECT COALESCE(SUM(CASE WHEN i.unit='g' THEN -t.qty/1000.0 ELSE -t.qty END),0) n FROM inventory_transactions t JOIN inventory i ON i.id=t.inventory_id WHERE t.business_id=? AND t.kind='waste' AND i.unit IN ('kg','g') AND t.created_at>=?",
        b,
        startDay,
      ).n,
      surplusRevenue: sum(sales, (o) => o.total_paise / 100),
      purchaseSavings: sum(purchases, savings),
      labels: days.map((d) =>
        new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        }),
      ),
      invValue: days.map(
        (d) => snaps.find((s) => s.day === d)?.inventory_value ?? 0,
      ),
      wasteRisk: days.map((d) => snaps.find((s) => s.day === d)?.risk ?? 0),
      revenue: days.map((d) =>
        sum(
          sales.filter((o) => o.picked_at.startsWith(d)),
          (o) => o.total_paise / 100,
        ),
      ),
      savings: days.map((d) =>
        sum(
          purchases.filter((o) => o.picked_at.startsWith(d)),
          savings,
        ),
      ),
      created: days.map(
        (d) => ls.filter((l) => l.created_at.startsWith(d)).length,
      ),
      sold: days.map(
        (d) => sales.filter((o) => o.picked_at.startsWith(d)).length,
      ),
      topSurplus: top(ls),
      topNeeded: top(purchases.map((o) => listingProducts.get(o.listing_id)).filter(Boolean)),
      historyDays: snaps.length,
      createdRecent: ls.length,
    };
  }
  state(user) {
    if (!user) return { authed: false };
    const b = user.business_id,
      { inv, alerts, settings } = this.reconcile(b),
      rawOrders = this.all(
        "SELECT o.*,i.product,i.unit FROM orders o JOIN listings l ON l.id=o.listing_id JOIN inventory i ON i.id=l.inventory_id WHERE o.buyer_id=? OR o.seller_id=? ORDER BY o.created_at DESC",
        b,
        b,
      ),
      businessRows = this.all("SELECT * FROM businesses"),
      businessById = new Map(businessRows.map((r) => [r.id, r])),
      me = businessById.get(b),
      orderCounts = new Map(this.all(
        "SELECT seller_id,COUNT(*) n FROM orders WHERE status IN ('Picked up','Completed') GROUP BY seller_id",
      ).map((row) => [row.seller_id, row.n])),
      businesses = businessRows.map((r) => this.publicBiz(r, r.id === b, orderCounts.get(r.id) || 0)),
      publicById = new Map(businesses.map((row) => [row.id, row])),
      orders = rawOrders.map((o) => this.orderView(
        o, b, o, businessById.get(o.buyer_id === b ? o.seller_id : o.buyer_id)?.contact || "",
      ));
    const listingRows = this.all(
      "SELECT l.*,i.product,i.category,i.unit,i.market,i.batch FROM listings l JOIN inventory i ON i.id=l.inventory_id WHERE l.business_id=? OR (l.status='Active' AND l.remaining>0 AND l.expires_at>?) ORDER BY l.created_at DESC",
      b,
      now(),
    );
    const interestedByListing = new Map(this.all(
      "SELECT listing_id,COUNT(*) n FROM orders WHERE status<>'Cancelled' GROUP BY listing_id",
    ).map((row) => [row.listing_id, row.n]));
    const listings = listingRows.map((l) => {
      const sellerRow = businessById.get(l.business_id),
        needItem = inv.find(
          (i) =>
            i.product.toLowerCase() === l.product.toLowerCase() &&
            i.unit === l.unit &&
            i.shortage,
        ),
        dist = distance(me, sellerRow),
        need = needItem
          ? {
              product: needItem.product,
              qty: needItem.shortage.qty,
              unit: needItem.unit,
              normalCost: needItem.cost,
              byHours: 24,
            }
          : null;
      return {
        id: l.id,
        biz: l.business_id,
        inventoryItemId: l.business_id === b ? l.inventory_id : null,
        product: l.product,
        category: l.category,
        unit: l.unit,
        qty: l.qty,
        qtyRemaining: l.remaining,
        price: l.price,
        market: l.market,
        minOrder: l.min_order,
        expiresAt: l.expires_at,
        shelfHours: hours(l.expires_at),
        cond: l.condition,
        storage: l.storage,
        pickup: l.pickup,
        notes: l.notes,
        packaging: "Confirm with seller",
        source: "Seller-listed inventory",
        status: l.status,
        createdAt: l.created_at,
        createdMins: minutes(l.created_at),
        own: l.business_id === b,
        seller: publicById.get(l.business_id),
        dist,
        views: 0,
        interested: interestedByListing.get(l.id) || 0,
        match: matchScore(
          need,
          {
            product: l.product,
            unit: l.unit,
            qty: l.remaining,
            price: l.price,
            shelfHours: hours(l.expires_at),
          },
          dist,
        ),
        matchLabel: need ? "Shortage match" : "Add demand to match",
        discount: l.market
          ? Math.max(0, Math.round(100 * (1 - l.price / l.market)))
          : 0,
      };
    });
    const notifications = this.all(
      "SELECT * FROM notifications WHERE business_id=? ORDER BY created_at DESC LIMIT 300",
      b,
    ).map((n) => ({
      id: n.id,
      biz: b,
      kind: n.kind,
      prio: n.priority,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.is_read,
      mins: minutes(n.created_at),
      createdAt: n.created_at,
    }));
    const sensors = this.all(
      "SELECT s.*,r.value last_value,r.created_at last_reading_at FROM sensors s LEFT JOIN sensor_readings r ON r.id=(SELECT id FROM sensor_readings WHERE sensor_id=s.id ORDER BY created_at DESC LIMIT 1) WHERE s.business_id=?",
      b,
    ).map((s) => {
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        unit: s.unit,
        lastValue: s.last_value ?? null,
        lastReadingAt: s.last_reading_at ?? null,
        status: s.last_reading_at ? "Reading received" : "No readings",
      };
    });
    const insights = alerts
      .filter((a) => a.status === "pending")
      .map((a) => ({
        id: a.id,
        kind: a.kind.toUpperCase(),
        tone: a.kind === "shortage" ? "info" : "warning",
        title:
          a.kind === "shortage"
            ? `Plan supply for ${a.product}`
            : `Review ${a.product}`,
        body:
          a.kind === "shortage"
            ? `Your recorded daily demand projects a shortage of ${a.shortage} ${a.unit}.`
            : a.kind === "expiry"
              ? "This batch has reached its recorded expiry. Do not list or hand it over; review it and record disposal where appropriate."
              : `${a.surplus.mid} ${a.unit} may remain before expiry based on recorded demand.`,
        stats: [],
        action: null,
        impact:
          a.kind === "shortage"
            ? "Find compatible supply"
            : a.kind === "expiry"
              ? "Remove expired inventory from usable stock"
              : "Review stock and create a listing if appropriate",
        itemId: a.itemId,
      }));
    return {
      authed: true,
      authoritative: true,
      user: { id: user.id, email: user.email },
      bizId: b,
      onboarded: !!me.onboarded,
      businesses,
      inventory: { [b]: inv },
      salesHistory: this.salesHistory(b),
      listings,
      orders,
      alerts,
      notifications,
      analytics: { [b]: this.analytics(b, rawOrders) },
      insights,
      settings,
      sensors,
      watches: this.all(
        "SELECT id,product FROM watches WHERE business_id=?",
        b,
      ),
      syncAt: now(),
      syncedAt: now(),
      error: null,
    };
  }
}
