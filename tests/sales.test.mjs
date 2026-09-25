import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { Service } from '../server/service.mjs';
import { weightedDailySales } from '../server/sales-forecast.mjs';
import { createApp } from '../server.mjs';

const fixedNow = new Date('2026-09-18T12:00:00.000Z');
const future = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();
const driver = process.env.OVERBYTE_SQLITE_DRIVER === 'libsql' ? 'libsql' : 'sqlite';
const open = () => openDatabase(':memory:', { config: { driver } });
const closeTo = (actual, expected, tolerance = 0.011) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
const rejects = (fn, status) => assert.throws(fn, (error) => error.status === status);

function fixture(t) {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  const db = open(), service = new Service(db);
  t.after(() => db.close());
  return {
    db, service,
    account(name = 'Sales Kitchen') {
      return service.signup({ name, loc: 'Bengaluru', email: `${randomUUID()}@example.test`, password: 'Sales-test-password-482!' }).user;
    },
  };
}

function add(service, user, overrides = {}) {
  return service.addInventory(user.business_id, {
    product: 'Tomatoes', category: 'Vegetables', unit: 'kg', qty: 40,
    cost: 30, expiresAt: future(), storage: 'Refrigerated', ...overrides,
  }).id;
}
const rows = (service, user) => service.inventory(user.business_id);
const row = (service, user, id) => rows(service, user).find((entry) => entry.id === id);
const sell = (service, user, id, qty, idempotencyKey = randomUUID()) => service.registerSale(user.business_id, id, { qty, idempotencyKey });
const sellMany = (service, user, items, idempotencyKey = randomUUID()) => service.registerSales(user.business_id, { items, idempotencyKey });

test('weighted sales average emphasizes recent dates, includes zero-sale dates, and ignores old/future records', () => {
  const result = weightedDailySales([
    { qty: 14, createdAt: '2026-09-12T09:00:00Z' },
    { qty: 10, createdAt: '2026-09-17T09:00:00Z' },
    { qty: 8, createdAt: '2026-09-18T08:00:00Z' },
    { qty: 12, createdAt: '2026-09-18T11:00:00Z' },
    { qty: 1000, createdAt: '2026-09-11T23:59:59Z' },
    { qty: 1000, createdAt: '2026-09-18T13:00:00Z' },
  ], { now: fixedNow, startedAt: '2026-08-01T00:00:00Z' });
  closeTo(result.averageDailySales, 214 / 28);
  assert.equal(result.observationDays, 7);
  assert.equal(result.windowDays, 7);
  assert.deepEqual(result.dailyTotals.map((entry) => entry.qty), [14, 0, 0, 0, 0, 10, 20]);
  assert.deepEqual(result.dailyTotals.map((entry) => entry.weight), [1, 2, 3, 4, 5, 6, 7]);
});

test('new product observation starts on its first recorded day instead of inventing previous zero-sale days', () => {
  const result = weightedDailySales([
    { qty: 5, createdAt: '2026-09-17T20:00:00Z' },
    { qty: 8, createdAt: '2026-09-18T08:00:00Z' },
  ], { now: fixedNow, startedAt: '2026-09-17T19:00:00Z' });
  assert.equal(result.observationDays, 2);
  assert.deepEqual(result.dailyTotals.map((entry) => entry.weight), [6, 7]);
  closeTo(result.averageDailySales, 86 / 13);
  const today = weightedDailySales([{ qty: 6, createdAt: '2026-09-18T11:00:00Z' }], { now: fixedNow, startedAt: '2026-09-18T10:00:00Z' });
  assert.equal(today.observationDays, 1);
  assert.equal(today.averageDailySales, 6);
  assert.equal(weightedDailySales([], { now: fixedNow, startedAt: '2026-09-17T10:00:00Z' }).averageDailySales, 0);
});

test('registering a sale allocates earliest-expiring batches first, even when a later batch was clicked', (t) => {
  const { service, account } = fixture(t), user = account();
  const later = add(service, user, { qty: 10, batch: 'LATE', expiresAt: future(72) });
  const early = add(service, user, { product: 'tomatoes', qty: 4, batch: 'EARLY', expiresAt: future(24) });
  const result = sell(service, user, later, 6);
  assert.equal(row(service, user, early).qty, 0);
  assert.equal(row(service, user, later).qty, 8);
  const history = service.salesHistory(user.business_id);
  assert.equal(history.length, 1);
  assert.equal(history[0].id, result.id);
  assert.equal(history[0].qty, 6);
  assert.equal(history[0].unit, 'kg');
  assert.equal(history[0].createdAt, fixedNow.toISOString());
  assert.deepEqual(history[0].allocations.map((allocation) => [allocation.inventoryItemId, allocation.batch, allocation.qty]), [[early, 'EARLY', 4], [later, 'LATE', 2]]);
  const movements = service.all("SELECT inventory_id,qty FROM inventory_transactions WHERE business_id=? AND kind='retail_sale' ORDER BY inventory_id", user.business_id);
  assert.deepEqual(movements.map((movement) => [movement.inventory_id, movement.qty]), [[early, -4], [later, -2]].sort((a, b) => a[0].localeCompare(b[0])));
  assert.deepEqual(service.state(user).salesHistory, history);
  assert.equal(service.one('SELECT COUNT(*) n FROM listings').n, 0);
});

test('sale requests are idempotent, reject changed retries, and allow a zero-stock reference batch', (t) => {
  const { service, account } = fixture(t), user = account();
  const early = add(service, user, { qty: 2, expiresAt: future(24) });
  const later = add(service, user, { qty: 6, expiresAt: future(72) });
  const key = randomUUID(), first = sell(service, user, early, 2, key);
  assert.equal(sell(service, user, early, 2, key).id, first.id);
  assert.equal(row(service, user, early).qty, 0);
  assert.equal(row(service, user, later).qty, 6);
  rejects(() => sell(service, user, early, 3, key), 409);
  assert.equal(service.salesHistory(user.business_id).length, 1);
  sell(service, user, early, 3);
  assert.equal(row(service, user, later).qty, 3);
  const otherProduct = add(service, user, { product: 'Potatoes', qty: 20 });
  rejects(() => sell(service, user, otherProduct, 2, key), 409);
  assert.equal(row(service, user, otherProduct).qty, 20);
});

test('multi-product sales allocate each product FEFO, respect reservations, and update history and forecasts', (t) => {
  const { service, account } = fixture(t), user = account();
  const early = add(service, user, { qty: 4, batch: 'EARLY', expiresAt: future(24) });
  const later = add(service, user, { qty: 10, batch: 'LATER', expiresAt: future(72) });
  const potatoes = add(service, user, { product: 'Potatoes', qty: 10 });
  service.createListing(user.business_id, { inventoryItemId: early, qty: 1, price: 20, minOrder: 1, pickup: 'Today' });
  const result = sellMany(service, user, [{ inventoryItemId: later, qty: 6 }, { inventoryItemId: potatoes, qty: 2 }]);
  assert.equal(result.sales.length, 2);
  assert.deepEqual(result.sales[0].allocations.map((allocation) => [allocation.inventoryItemId, allocation.qty]), [[early, 3], [later, 3]]);
  assert.deepEqual(result.sales[1].allocations.map((allocation) => [allocation.inventoryItemId, allocation.qty]), [[potatoes, 2]]);
  assert.equal(row(service, user, early).qty, 1);
  assert.equal(row(service, user, early).reservedQty, 1);
  assert.equal(row(service, user, later).qty, 7);
  assert.equal(row(service, user, potatoes).qty, 8);
  assert.equal(row(service, user, later).salesDailyAverage, 6);
  assert.equal(row(service, user, potatoes).salesDailyAverage, 2);
  assert.equal(row(service, user, potatoes).demandSource, 'sales');
  assert.deepEqual(new Set(service.salesHistory(user.business_id).map((sale) => sale.id)), new Set(result.sales.map((sale) => sale.id)));
  assert.equal(service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE kind='retail_sale'").n, 3);
});

test('a failed product rolls back the whole basket and the same key can retry corrected quantities', (t) => {
  const { service, account } = fixture(t), user = account();
  const tomatoes = add(service, user, { qty: 5 });
  const potatoes = add(service, user, { product: 'Potatoes', qty: 2 });
  const key = randomUUID();
  rejects(() => sellMany(service, user, [{ inventoryItemId: tomatoes, qty: 3 }, { inventoryItemId: potatoes, qty: 3 }], key), 409);
  assert.equal(row(service, user, tomatoes).qty, 5);
  assert.equal(row(service, user, potatoes).qty, 2);
  assert.deepEqual(service.salesHistory(user.business_id), []);
  assert.equal(service.one('SELECT COUNT(*) n FROM inventory_sale_allocations').n, 0);
  assert.equal(service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE kind='retail_sale'").n, 0);
  const result = sellMany(service, user, [{ inventoryItemId: tomatoes, qty: 3 }, { inventoryItemId: potatoes, qty: 2 }], key);
  assert.equal(result.sales.length, 2);
  assert.equal(row(service, user, tomatoes).qty, 2);
  assert.equal(row(service, user, potatoes).qty, 0);
});

test('basket retries are idempotent and reject edited quantities, products, ordering, and line counts', (t) => {
  const { service, account } = fixture(t), user = account();
  const tomatoes = add(service, user, { qty: 10 });
  const potatoes = add(service, user, { product: 'Potatoes', qty: 10 });
  const carrots = add(service, user, { product: 'Carrots', qty: 10 });
  const items = [{ inventoryItemId: tomatoes, qty: 3 }, { inventoryItemId: potatoes, qty: 2 }];
  const key = randomUUID(), first = sellMany(service, user, items, key);
  assert.deepEqual(sellMany(service, user, items, key), first);
  for (const edited of [
    [items[0], { ...items[1], qty: 3 }],
    [items[0], { inventoryItemId: carrots, qty: 2 }],
    [...items].reverse(),
    items.slice(0, 1),
    [...items, { inventoryItemId: carrots, qty: 1 }],
  ]) rejects(() => sellMany(service, user, edited, key), 409);
  assert.equal(row(service, user, tomatoes).qty, 7);
  assert.equal(row(service, user, potatoes).qty, 8);
  assert.equal(row(service, user, carrots).qty, 10);
  assert.equal(service.salesHistory(user.business_id).length, 2);
  assert.equal(service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE kind='retail_sale'").n, 2);
  const internalKey = service.one('SELECT idempotency_key FROM inventory_sales WHERE id=?', first.sales[0].id).idempotency_key;
  assert.ok(internalKey.length <= 100);
  rejects(() => sell(service, user, tomatoes, 3, internalKey), 400);
  assert.ok(sell(service, user, tomatoes, 1, key).id);
  assert.deepEqual(sellMany(service, user, items, key), first);
});

test('baskets validate ownership, unique product/unit lines and size, and support a single product', (t) => {
  const { service, account } = fixture(t), user = account(), other = account('Other Kitchen');
  const tomatoes = add(service, user, { qty: 3 });
  const sameProduct = add(service, user, { product: 'tomatoes', qty: 2, expiresAt: future(72) });
  const grams = add(service, user, { unit: 'g', qty: 10 });
  const foreign = add(service, other, { product: 'Potatoes', qty: 10 });
  const line = { inventoryItemId: tomatoes, qty: 1 };
  for (const items of [undefined, null, {}, [], Array(21).fill(line), [null], [line, line], [line, { inventoryItemId: sameProduct, qty: 1 }]])
    rejects(() => sellMany(service, user, items), 400);
  rejects(() => sellMany(service, user, [line, { inventoryItemId: foreign, qty: 1 }]), 404);
  assert.equal(row(service, user, tomatoes).qty, 3);
  assert.deepEqual(service.salesHistory(user.business_id), []);
  assert.equal(row(service, other, foreign).qty, 10);
  const key = randomUUID();
  const first = sellMany(service, user, [{ inventoryItemId: tomatoes, qty: 3 }], key);
  assert.equal(first.sales.length, 1);
  assert.equal(row(service, user, tomatoes).qty, 0);
  assert.deepEqual(sellMany(service, user, [{ inventoryItemId: tomatoes, qty: 3 }], key), first);
  assert.equal(sellMany(service, user, [line, { inventoryItemId: grams, qty: 1 }]).sales.length, 2);
});

test('sale stock, allocations, forecasts, and idempotency survive reopening persistent storage', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: fixedNow });
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'overbyte-sales-test-'));
  const filename = join(directory, 'sales.sqlite');
  const options = { config: { driver } };
  let db = openDatabase(filename, options), service = new Service(db);
  t.after(async () => {
    db.close();
    // Native libsql statement handles must be finalized before Windows unlinks them.
    global.gc?.();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(dirname(resolve(directory)), parent);
    assert.ok(directory.startsWith(join(parent, 'overbyte-sales-test-')));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const account = (name) => service.signup({ name, loc: 'Bengaluru', email: `${randomUUID()}@example.test`, password: 'Persistent-sales-password-482!' }).user;
  const user = account('Persistent Sales Kitchen'), other = account('Private Other Kitchen');
  const early = add(service, user, { qty: 3, batch: 'EARLY', expiresAt: future(24) });
  const later = add(service, user, { qty: 20, batch: 'LATE', expiresAt: future(72) });
  const key = randomUUID();
  const sale = sell(service, user, later, 5, key);
  const history = service.salesHistory(user.business_id);
  assert.deepEqual(history[0].allocations.map((allocation) => [allocation.inventoryItemId, allocation.qty]), [[early, 3], [later, 2]]);
  db.close();
  db = openDatabase(filename, options);
  service = new Service(db);
  assert.equal(row(service, user, early).qty, 0);
  assert.equal(row(service, user, later).qty, 18);
  assert.deepEqual(service.salesHistory(user.business_id), history);
  assert.deepEqual(service.state(other).salesHistory, []);
  assert.equal(sell(service, user, later, 5, key).id, sale.id);
  assert.equal(row(service, user, later).qty, 18);
  assert.equal(service.salesHistory(user.business_id).length, 1);
  assert.equal(service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE kind='retail_sale'").n, 2);
  rejects(() => service.updateInventory(user.business_id, early, { product: 'Potatoes' }), 400);
  rejects(() => service.updateInventory(user.business_id, later, { unit: 'g' }), 400);
  const item = row(service, user, later);
  assert.equal(item.product, 'Tomatoes');
  assert.equal(item.unit, 'kg');
  assert.equal(item.demandSource, 'sales');
  assert.equal(item.salesDailyAverage, 5);
  assert.equal(item.demand, 15);
  assert.equal(item.surplus.mid, 3);
  assert.equal(service.salesHistory(user.business_id)[0].product, 'Tomatoes');
  assert.equal(service.salesHistory(user.business_id)[0].unit, 'kg');
});

test('sales reject invalid quantities and overselling without changing stock or sales history', (t) => {
  const { service, account } = fixture(t), user = account();
  const id = add(service, user, { qty: 5 });
  for (const qty of [0, -1, null, '', 'not a number', Infinity, NaN, 1.001]) rejects(() => sell(service, user, id, qty), 400);
  rejects(() => sell(service, user, id, 5.01), 409);
  assert.equal(row(service, user, id).qty, 5);
  assert.deepEqual(service.salesHistory(user.business_id), []);
  const pieces = add(service, user, { product: 'Croissants', unit: 'pcs', qty: 5 });
  rejects(() => sell(service, user, pieces, 1.5), 400);
  sell(service, user, id, 0.01);
  assert.equal(row(service, user, id).qty, 4.99);
  sell(service, user, id, 4.99);
  assert.equal(row(service, user, id).qty, 0);
  rejects(() => sell(service, user, id, 0.01), 409);
});

test('sales never draw from another business, another product, another unit, or an expired batch', (t) => {
  const { service, account } = fixture(t), user = account(), other = account('Other Kitchen');
  const id = add(service, user, { qty: 3 });
  const expired = add(service, user, { qty: 100 });
  service.run('UPDATE inventory SET expires_at=? WHERE id=?', new Date(Date.now() - 1).toISOString(), expired);
  const grams = add(service, user, { qty: 1000, unit: 'g' });
  const potatoes = add(service, user, { product: 'Potatoes', qty: 50 });
  const foreign = add(service, other, { qty: 100 });
  rejects(() => sell(service, user, foreign, 1), 404);
  rejects(() => sell(service, user, id, 4), 409);
  sell(service, user, id, 3);
  assert.equal(row(service, user, id).qty, 0);
  assert.equal(row(service, user, expired).qty, 100);
  assert.equal(row(service, user, grams).qty, 1000);
  assert.equal(row(service, user, potatoes).qty, 50);
  assert.equal(row(service, other, foreign).qty, 100);
  assert.deepEqual(service.state(other).salesHistory, []);
});

test('FEFO sale allocation respects existing marketplace reservations', (t) => {
  const { service, account } = fixture(t), user = account();
  const early = add(service, user, { qty: 18, expiresAt: future(24) });
  const later = add(service, user, { qty: 10, expiresAt: future(72) });
  service.createListing(user.business_id, { inventoryItemId: early, qty: 12, price: 20, minOrder: 1, pickup: 'Today' });
  sell(service, user, later, 8);
  assert.equal(row(service, user, early).qty, 12);
  assert.equal(row(service, user, early).reservedQty, 12);
  assert.equal(row(service, user, later).qty, 8);
  rejects(() => sell(service, user, later, 9), 409);
  assert.equal(service.salesHistory(user.business_id).length, 1);
  sell(service, user, later, 8);
  assert.equal(row(service, user, early).qty, 12);
  assert.equal(row(service, user, later).qty, 0);
});

test('a failed batch write rolls back every stock deduction and the entire sale record', (t) => {
  const { db, service, account } = fixture(t), user = account();
  const early = add(service, user, { qty: 2, expiresAt: future(24) });
  const later = add(service, user, { qty: 5, expiresAt: future(72) });
  assert.match(later, /^[a-zA-Z0-9_-]+$/);
  db.exec(`CREATE TRIGGER fail_second_sale BEFORE UPDATE OF qty ON inventory WHEN OLD.id='${later}' BEGIN SELECT RAISE(ABORT,'Test allocation failure'); END`);
  assert.throws(() => sell(service, user, later, 4));
  assert.equal(row(service, user, early).qty, 2);
  assert.equal(row(service, user, later).qty, 5);
  assert.deepEqual(service.salesHistory(user.business_id), []);
  assert.equal(service.one('SELECT COUNT(*) n FROM inventory_sale_allocations').n, 0);
  assert.equal(service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE kind='retail_sale'").n, 0);
});

test('recorded retail sales become the demand source and stay isolated from other stock movements and businesses', (t) => {
  const { service, account } = fixture(t), user = account(), other = account('Unrelated Kitchen');
  const id = add(service, user, { qty: 100, dailyDemand: 50 });
  service.run('UPDATE inventory SET created_at=? WHERE id=?', '2026-09-12T09:00:00.000Z', id);
  const yesterday = sell(service, user, id, 7);
  service.run('UPDATE inventory_sales SET created_at=? WHERE id=?', '2026-09-17T09:00:00.000Z', yesterday.id);
  sell(service, user, id, 14);
  service.adjust(user.business_id, id, { qty: 20 }, true);
  const grams = add(service, user, { qty: 1000, unit: 'g' });
  sell(service, user, grams, 500);
  const potatoes = add(service, user, { product: 'Potatoes', qty: 100 });
  sell(service, user, potatoes, 50);
  const otherId = add(service, other, { qty: 100 });
  sell(service, other, otherId, 50);
  const item = row(service, user, id);
  assert.equal(item.qty, 59);
  assert.equal(item.demandSource, 'sales');
  assert.equal(item.salesHistoryAvailable, true);
  assert.equal(item.salesObservationDays, 7);
  assert.equal(item.salesWindowDays, 7);
  assert.equal(item.salesDailyAverage, 5);
  assert.equal(item.effectiveDailyDemand, 5);
  assert.equal(item.demand, 10);
  assert.equal(item.surplus.mid, 49);
});

test('old sales age out to zero demand without falling back to a manual rate, while products without sales stay honest', (t) => {
  const { service, account } = fixture(t), user = account();
  const unknown = add(service, user, { product: 'Unknown Product' });
  assert.equal(row(service, user, unknown).salesHistoryAvailable, false);
  assert.equal(row(service, user, unknown).forecastAvailable, false);
  const id = add(service, user, { qty: 30, dailyDemand: 10 });
  const sale = sell(service, user, id, 2);
  service.run('UPDATE inventory SET created_at=? WHERE id=?', '2026-09-01T09:00:00.000Z', id);
  service.run('UPDATE inventory_sales SET created_at=? WHERE id=?', '2026-09-10T09:00:00.000Z', sale.id);
  const item = row(service, user, id);
  assert.equal(item.demandSource, 'sales');
  assert.equal(item.salesDailyAverage, 0);
  assert.equal(item.demand, 0);
  assert.equal(item.surplus.mid, 28);
});

test('sales forecasts allocate demand once across FEFO batches', (t) => {
  const { service, account } = fixture(t), user = account();
  const early = add(service, user, { qty: 7, expiresAt: future(24) });
  const later = add(service, user, { qty: 11, expiresAt: future(48) });
  sell(service, user, later, 4);
  const first = row(service, user, early), second = row(service, user, later);
  assert.equal(first.qty, 3);
  assert.equal(second.qty, 11);
  assert.equal(first.salesDailyAverage, 4);
  assert.equal(second.salesDailyAverage, 4);
  assert.equal(first.demand, 4);
  assert.equal(second.demand, 5);
  assert.equal(first.surplus.mid, 0);
  assert.equal(second.surplus.mid, 6);
});

test('even a small positive sales-based surplus creates an approval-only suggestion below the legacy threshold', (t) => {
  const { service, account } = fixture(t), user = account();
  const id = add(service, user, { qty: 21, expiresAt: future(24) });
  service.updateSettings(user.business_id, { wasteTarget: 80 });
  sell(service, user, id, 10);
  const item = row(service, user, id);
  assert.equal(item.qty, 11);
  assert.equal(item.demand, 10);
  assert.equal(item.surplus.mid, 1);
  assert.match(item.aiStatus, /^surplus risk$/i);
  const state = service.state(user);
  assert.ok(state.alerts.some((alert) => alert.kind === 'surplus' && alert.itemId === id && alert.status === 'pending'));
  assert.deepEqual(state.listings, []);
  service.updateSettings(user.business_id, { autoAlerts: false });
  assert.equal(row(service, user, id).surplus.mid, 1);
});

async function httpFixture(t) {
  const app = createApp({ database: open(), secureCookies: false, monitorEnabled: false });
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    app,
    client() {
      let cookie = '';
      return {
        async request(path, method = 'GET', data) {
          const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: data === undefined ? undefined : JSON.stringify(data) });
          if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
          return { status: response.status, body: await response.json() };
        },
        async signup(name) {
          const result = await this.request('/api/auth/signup', 'POST', { name, loc: 'Bengaluru', email: `${randomUUID()}@example.test`, password: 'Sales-http-password-482!' });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          this.bizId = result.body.state.bizId;
          return result.body.state;
        },
        async add(overrides = {}) {
          const result = await this.request('/api/inventory', 'POST', { product: 'Tomatoes', category: 'Vegetables', unit: 'kg', qty: 20, cost: 30, storage: 'Refrigerated', expiresAt: future(48), ...overrides });
          assert.equal(result.status, 200, JSON.stringify(result.body));
          return result.body;
        },
      };
    },
  };
}

test('authenticated sale API persists history, recalculates after sale/add/adjust, and does not publish automatically', async (t) => {
  const f = await httpFixture(t), owner = f.client(), stranger = f.client(), anonymous = f.client();
  await owner.signup('HTTP Sales Owner');
  await stranger.signup('HTTP Other Owner');
  const initial = await owner.add({ qty: 20, expiresAt: future(24), batch: 'EARLY' });
  const id = initial.result.id, path = `/api/inventory/${id}/sales`;
  assert.equal((await anonymous.request(path, 'POST', { qty: 1, idempotencyKey: randomUUID() })).status, 401);
  assert.equal((await stranger.request(path, 'POST', { qty: 1, idempotencyKey: randomUUID() })).status, 404);
  const sale = await owner.request(path, 'POST', { qty: 4, idempotencyKey: randomUUID() });
  assert.equal(sale.status, 200, JSON.stringify(sale.body));
  let item = sale.body.state.inventory[owner.bizId].find((entry) => entry.id === id);
  assert.equal(item.qty, 16);
  assert.equal(item.demandSource, 'sales');
  closeTo(item.surplus.mid, 12);
  assert.equal(sale.body.state.salesHistory.length, 1);
  assert.deepEqual(sale.body.state.listings, []);
  const added = await owner.add({ qty: 5, expiresAt: item.expiresAt, batch: 'LATER' });
  assert.ok(added.state.inventory[owner.bizId].every((entry) => entry.demandSource === 'sales'));
  closeTo(added.state.inventory[owner.bizId].reduce((sum, entry) => sum + entry.surplus.mid, 0), 17);
  const adjusted = await owner.request(`/api/inventory/${id}/adjust`, 'POST', { delta: 3, kind: 'received' });
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
  closeTo(adjusted.body.state.inventory[owner.bizId].reduce((sum, entry) => sum + entry.surplus.mid, 0), 20);
  const again = await owner.request('/api/state');
  assert.equal(again.body.salesHistory[0].id, sale.body.result.id);
  assert.deepEqual((await stranger.request('/api/state')).body.salesHistory, []);
  const invalid = await owner.request(path, 'POST', { qty: 25, idempotencyKey: randomUUID() });
  assert.equal(invalid.status, 409);
  const after = (await owner.request('/api/state')).body;
  assert.equal(after.inventory[owner.bizId].reduce((sum, entry) => sum + entry.qty, 0), 24);
  assert.equal(after.salesHistory.length, 1);
});

test('multi-product sale API authenticates ownership and returns the complete basket and refreshed state', async (t) => {
  const f = await httpFixture(t), owner = f.client(), stranger = f.client(), anonymous = f.client();
  await owner.signup('HTTP Basket Owner');
  await stranger.signup('HTTP Other Basket Owner');
  const tomatoes = (await owner.add({ qty: 10 })).result.id;
  const potatoes = (await owner.add({ product: 'Potatoes', qty: 10 })).result.id;
  const payload = { items: [{ inventoryItemId: tomatoes, qty: 3 }, { inventoryItemId: potatoes, qty: 2 }], idempotencyKey: randomUUID() };
  assert.equal((await anonymous.request('/api/sales', 'POST', payload)).status, 401);
  assert.equal((await stranger.request('/api/sales', 'POST', payload)).status, 404);
  const sale = await owner.request('/api/sales', 'POST', payload);
  assert.equal(sale.status, 200, JSON.stringify(sale.body));
  assert.equal(sale.body.result.sales.length, 2);
  assert.equal(sale.body.state.salesHistory.length, 2);
  assert.equal(sale.body.state.inventory[owner.bizId].find((item) => item.id === tomatoes).qty, 7);
  assert.equal(sale.body.state.inventory[owner.bizId].find((item) => item.id === potatoes).qty, 8);
  const retry = await owner.request('/api/sales', 'POST', payload);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.result, sale.body.result);
  assert.equal((await owner.request('/api/sales', 'POST', { ...payload, items: payload.items.slice(0, 1) })).status, 409);
  assert.deepEqual((await stranger.request('/api/state')).body.salesHistory, []);
});

test('concurrent sale API requests cannot oversell and each successful sale is atomically FEFO allocated', async (t) => {
  const f = await httpFixture(t), client = f.client();
  await client.signup('Concurrent Sales Owner');
  const early = await client.add({ qty: 2, expiresAt: future(24), batch: 'EARLY' });
  const later = await client.add({ qty: 5, expiresAt: future(72), batch: 'LATER' });
  const path = `/api/inventory/${later.result.id}/sales`;
  const keys = [randomUUID(), randomUUID()];
  const results = await Promise.all(keys.map((idempotencyKey) => client.request(path, 'POST', { qty: 4, idempotencyKey })));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const winner = results.findIndex((result) => result.status === 200);
  const retry = await client.request(path, 'POST', { qty: 4, idempotencyKey: keys[winner] });
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.result.id, results[winner].body.result.id);
  const state = (await client.request('/api/state')).body;
  assert.equal(state.inventory[client.bizId].find((entry) => entry.id === early.result.id).qty, 0);
  assert.equal(state.inventory[client.bizId].find((entry) => entry.id === later.result.id).qty, 3);
  assert.equal(state.salesHistory.length, 1);
  assert.equal(state.salesHistory[0].allocations.reduce((sum, allocation) => sum + allocation.qty, 0), 4);
  assert.ok(state.inventory[client.bizId].every((entry) => entry.qty >= 0));
});
