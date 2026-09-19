import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.mjs';
import { Service } from '../server/service.mjs';

const startTime = new Date('2026-09-17T10:00:00.000Z');
const future = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();
const past = (days) => new Date(Date.now() - days * 86_400_000).toISOString();

function fixture(t, { persistent = false } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: startTime });
  const temporaryParent = resolve(tmpdir());
  const directory = persistent ? mkdtempSync(join(temporaryParent, 'overbyte-forecast-test-')) : null;
  const filename = directory ? join(directory, 'forecast.sqlite') : ':memory:';
  const databaseOptions = { config: { driver: process.env.OVERBYTE_SQLITE_DRIVER === 'libsql' ? 'libsql' : 'sqlite' } };
  let db = openDatabase(filename, databaseOptions), service = new Service(db);
  t.after(async () => {
    db.close();
    // Release native libsql statement handles before removing a Windows test database.
    global.gc?.();
    await new Promise((resolve) => setImmediate(resolve));
    if (directory) {
      assert.equal(dirname(resolve(directory)), temporaryParent);
      assert.ok(directory.startsWith(join(temporaryParent, 'overbyte-forecast-test-')));
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
  return {
    get db() { return db; },
    get service() { return service; },
    account(name = 'Forecast Kitchen') {
      return service.signup({ name, loc: 'Bengaluru', email: `${randomUUID()}@example.test`, password: 'Forecast-test-password-482!' }).user;
    },
    restart() {
      assert.ok(persistent, 'Restart requires a file database.');
      db.close();
      db = openDatabase(filename, databaseOptions);
      service = new Service(db);
    },
  };
}

function add(service, user, overrides = {}) {
  return service.addInventory(user.business_id, {
    product: 'Tomatoes', category: 'Vegetables', unit: 'kg', qty: 40, cost: 30,
    market: 45, expiresAt: future(), storage: 'Refrigerated', ...overrides,
  }).id;
}

const items = (service, user) => service.inventory(user.business_id);
const item = (service, user, id) => items(service, user).find((row) => row.id === id);
const notifications = (service, user, kind) => service.all('SELECT * FROM notifications WHERE business_id=? AND kind=?', user.business_id, kind);
const rejects = (fn, status, message) => assert.throws(fn, (error) => error.status === status && message.test(error.message));

test('unknown demand produces no invented demand, waste probability, shortages, or AI alerts', (t) => {
  const f = fixture(t), user = f.account();
  const id = add(f.service, user);
  const state = f.service.state(user), row = state.inventory[user.business_id].find((entry) => entry.id === id);
  assert.equal(row.dailyDemand, null);
  assert.equal(row.effectiveDailyDemand, null);
  assert.equal(row.demand, null);
  assert.equal(row.demandSource, 'none');
  assert.equal(row.forecastAvailable, false);
  assert.equal(row.risk.probability, null);
  assert.equal(row.risk.risk, 'unknown');
  assert.equal(row.surplus.mid, 0);
  assert.equal(row.shortage, null);
  assert.equal(row.aiStatus, 'Needs demand data');
  assert.deepEqual(state.alerts, []);
  assert.deepEqual(state.insights, []);
  assert.equal(state.analytics[user.business_id].wasteRisk.at(-1), 0);
  assert.deepEqual(notifications(f.service, user, 'AI ALERT'), []);
  assert.deepEqual(notifications(f.service, user, 'SHORTAGE'), []);
});

test('explicit daily use drives explainable surplus and daily shortage projections', (t) => {
  const f = fixture(t), user = f.account();
  const surplusId = add(f.service, user, { qty: 40, dailyDemand: 5 });
  const shortageId = add(f.service, user, { product: 'Flour', qty: 3, dailyDemand: 8, expiresAt: future(72) });
  const surplus = item(f.service, user, surplusId), shortage = item(f.service, user, shortageId);
  assert.equal(surplus.demandSource, 'planned');
  assert.equal(surplus.forecastAvailable, true);
  assert.equal(surplus.effectiveDailyDemand, 5);
  assert.equal(surplus.demand, 10);
  assert.deepEqual(surplus.surplus, { low: 30, mid: 30, high: 30 });
  assert.equal(surplus.risk.probability, 75);
  assert.equal(surplus.aiStatus, 'Surplus risk');
  assert.equal(shortage.demand, 24);
  assert.equal(shortage.surplus.mid, 0);
  assert.equal(shortage.shortage.qty, 5);
  assert.equal(shortage.shortage.byHour, 9);
  assert.equal(shortage.aiStatus, 'Shortage');
  const alerts = f.service.alerts(user.business_id);
  assert.deepEqual(alerts.map((alert) => [alert.itemId, alert.kind]).sort(), [[surplusId, 'surplus'], [shortageId, 'shortage']].sort());
  assert.equal(alerts.find((alert) => alert.itemId === shortageId).shortage, 5);
});

test('an explicit zero daily use is a valid forecast rather than missing data', (t) => {
  const f = fixture(t), user = f.account();
  const id = add(f.service, user, { qty: 12, dailyDemand: 0 });
  const row = item(f.service, user, id);
  assert.equal(row.forecastAvailable, true);
  assert.equal(row.demandSource, 'planned');
  assert.equal(row.demand, 0);
  assert.equal(row.surplus.mid, 12);
  assert.equal(row.risk.probability, 100);
  assert.equal(row.shortage, null);
});

test('recorded consumption uses recent history for the same account, product, and unit', (t) => {
  const f = fixture(t), user = f.account(), other = f.account('Other Kitchen');
  const id = add(f.service, user, { qty: 100 });
  f.service.adjust(user.business_id, id, { qty: 12 }, true);
  f.service.run("UPDATE inventory_transactions SET created_at=? WHERE inventory_id=? AND kind='consumption'", past(2), id);
  f.service.adjust(user.business_id, id, { qty: 8 }, true);
  f.service.run("UPDATE inventory_transactions SET created_at=? WHERE inventory_id=? AND kind='consumption' AND qty=-8", past(1), id);
  f.service.adjust(user.business_id, id, { delta: -3, kind: 'waste' });
  f.service.adjust(user.business_id, id, { delta: 5, kind: 'received' });
  const oldId = add(f.service, user, { qty: 100 });
  f.service.adjust(user.business_id, oldId, { qty: 50 }, true);
  f.service.run("UPDATE inventory_transactions SET created_at=? WHERE inventory_id=? AND kind='consumption'", past(8), oldId);
  const grams = add(f.service, user, { unit: 'g', qty: 1000 });
  f.service.adjust(user.business_id, grams, { qty: 500 }, true);
  const flour = add(f.service, user, { product: 'Flour', qty: 100 });
  f.service.adjust(user.business_id, flour, { qty: 40 }, true);
  const otherId = add(f.service, other, { qty: 100 });
  f.service.adjust(other.business_id, otherId, { qty: 70 }, true);
  let row = item(f.service, user, id);
  assert.equal(row.qty, 82);
  assert.equal(row.demandSource, 'consumption');
  assert.equal(row.effectiveDailyDemand, 10, '20 kg consumed over two days, excluding other stock movements and histories');
  assert.equal(row.forecastAvailable, true);
  assert.equal(items(f.service, user).filter((entry) => entry.product === 'Tomatoes' && entry.unit === 'kg').reduce((sum, entry) => sum + entry.demand, 0), 20);
  f.service.updateInventory(user.business_id, id, { dailyDemand: 6 });
  row = item(f.service, user, id);
  assert.equal(row.effectiveDailyDemand, 6);
  assert.equal(row.demandSource, 'planned');
  f.service.updateInventory(user.business_id, id, { dailyDemand: null });
  assert.equal(item(f.service, user, id).effectiveDailyDemand, 10);
  assert.equal(item(f.service, user, id).demandSource, 'consumption');
});

test('same-product batches share demand and allocate usage to the earliest expiry first', (t) => {
  const f = fixture(t), user = f.account();
  const early = add(f.service, user, { qty: 3, dailyDemand: 4, expiresAt: future(24), batch: 'EARLY' });
  const later = add(f.service, user, { product: 'tomatoes', qty: 7, dailyDemand: 4, expiresAt: future(48), batch: 'LATE' });
  const first = item(f.service, user, early), second = item(f.service, user, later);
  assert.equal(first.demand, 4);
  assert.equal(first.surplus.mid, 0);
  assert.equal(second.demand, 5, 'The later batch covers 8 kg over two days less the 3 kg supplied by the early batch.');
  assert.equal(second.surplus.mid, 2);
  assert.equal(first.shortage, null);
  assert.equal(second.shortage, null);
  assert.equal(items(f.service, user).reduce((sum, row) => sum + Math.min(row.qty, row.demand), 0), 8);
});

test('multiple batches report one shortage against total unreserved product stock', (t) => {
  const f = fixture(t), user = f.account();
  add(f.service, user, { qty: 1, dailyDemand: 10, expiresAt: future(24) });
  add(f.service, user, { qty: 2, dailyDemand: 10, expiresAt: future(48) });
  const shortages = items(f.service, user).filter((row) => row.shortage);
  assert.equal(shortages.length, 1);
  assert.equal(shortages[0].shortage.qty, 7);
  assert.equal(f.service.alerts(user.business_id).filter((alert) => alert.kind === 'shortage').length, 1);
});

test('pending inbound orders reduce shortage without crediting physical inventory before pickup', (t) => {
  const f = fixture(t), buyer = f.account('Buyer Kitchen'), seller = f.account('Seller Kitchen');
  const buyerId = add(f.service, buyer, { qty: 5, dailyDemand: 20 });
  const sellerId = add(f.service, seller, { qty: 20 });
  const listing = f.service.createListing(seller.business_id, { inventoryItemId: sellerId, qty: 20, price: 20, minOrder: 1, pickup: 'Today 17:00–19:00' });
  assert.equal(item(f.service, buyer, buyerId).shortage.qty, 15);
  const firstOrder = f.service.createOrder(buyer.business_id, { listingId: listing.id, qty: 8, idempotencyKey: randomUUID() });
  let row = item(f.service, buyer, buyerId);
  assert.equal(row.incomingQty, 8);
  assert.equal(row.shortage.qty, 7);
  assert.equal(row.qty, 5);
  assert.equal(row.availableToList, 5);
  assert.equal(items(f.service, buyer).length, 1);
  f.service.cancelOrder(buyer.business_id, firstOrder.id);
  row = item(f.service, buyer, buyerId);
  assert.equal(row.incomingQty, 0);
  assert.equal(row.shortage.qty, 15);
  const secondOrder = f.service.createOrder(buyer.business_id, { listingId: listing.id, qty: 12, idempotencyKey: randomUUID() });
  assert.equal(item(f.service, buyer, buyerId).shortage.qty, 3);
  f.service.advanceOrder(seller.business_id, secondOrder.id);
  const afterPickup = items(f.service, buyer);
  assert.equal(afterPickup.reduce((sum, entry) => sum + entry.qty, 0), 17);
  assert.ok(afterPickup.every((entry) => entry.incomingQty === 0));
  assert.equal(afterPickup.filter((entry) => entry.shortage).length, 1);
  assert.equal(afterPickup.find((entry) => entry.shortage).shortage.qty, 3);
});

test('expired stock cannot be listed and listings cannot extend the batch expiry', (t) => {
  const f = fixture(t), user = f.account();
  rejects(() => add(f.service, user, { expiresAt: past(1) }), 400, /future date/);
  const id = add(f.service, user, { expiresAt: future(24) });
  const payload = { inventoryItemId: id, qty: 5, price: 20, minOrder: 1, pickup: 'Today' };
  rejects(() => f.service.createListing(user.business_id, { ...payload, expiresAt: future(48) }), 400, /outlive/);
  assert.equal(f.service.one('SELECT COUNT(*) n FROM listings').n, 0);
  f.service.run('UPDATE inventory SET expires_at=? WHERE id=?', past(1), id);
  rejects(() => f.service.createListing(user.business_id, payload), 400, /Expired stock/);
  assert.equal(f.service.one('SELECT COUNT(*) n FROM listings').n, 0);
  const state = f.service.state(user);
  assert.equal(state.inventory[user.business_id][0].aiStatus, 'Expired');
  assert.deepEqual(state.alerts.map((alert) => alert.kind), ['expiry']);
});

test('sensor readings and preferences persist, and sensor access is scoped to its owning account', (t) => {
  const f = fixture(t, { persistent: true }), user = f.account(), other = f.account('Other Kitchen');
  const sensor = f.service.addSensor(user.business_id, { name: 'Cold room', type: 'Temperature', unit: '°C' });
  assert.equal(f.service.state(user).sensors[0].status, 'No readings');
  rejects(() => f.service.reading(other.business_id, sensor.id, { value: 99 }), 404, /not found/);
  assert.equal(f.service.one('SELECT COUNT(*) n FROM sensor_readings').n, 0);
  f.service.reading(user.business_id, sensor.id, { value: 4.2 });
  t.mock.timers.tick(1000);
  f.service.reading(user.business_id, sensor.id, { value: -2.5 });
  f.service.updateSettings(user.business_id, { notifySensors: false, listingSuggestions: false, wasteTarget: 65 });
  f.restart();
  const state = f.service.state(user);
  assert.equal(state.sensors.length, 1);
  assert.equal(state.sensors[0].id, sensor.id);
  assert.equal(state.sensors[0].lastValue, -2.5);
  assert.equal(state.sensors[0].lastReadingAt, '2026-09-17T10:00:01.000Z');
  assert.equal(state.sensors[0].status, 'Reading received');
  assert.equal(f.service.one('SELECT COUNT(*) n FROM sensor_readings WHERE sensor_id=?', sensor.id).n, 2);
  assert.equal(state.settings.notifySensors, false);
  assert.equal(state.settings.listingSuggestions, false);
  assert.equal(state.settings.wasteTarget, 65);
  assert.deepEqual(f.service.state(other).sensors, []);
  assert.equal(f.service.state(other).settings.notifySensors, true);
  assert.equal(f.service.state(other).settings.wasteTarget, 50);
  const before = notifications(f.service, user, 'SENSOR').length;
  f.service.reading(user.business_id, sensor.id, { value: 1.5 });
  assert.equal(notifications(f.service, user, 'SENSOR').length, before);
  assert.equal(f.service.one('SELECT COUNT(*) n FROM sensor_readings WHERE sensor_id=?', sensor.id).n, 3);
});

test('alert settings control visibility and threshold while notification preferences control delivery', (t) => {
  const f = fixture(t), user = f.account();
  add(f.service, user, { qty: 40, dailyDemand: 5 });
  f.service.updateSettings(user.business_id, { autoAlerts: false });
  assert.deepEqual(f.service.state(user).alerts, []);
  assert.deepEqual(notifications(f.service, user, 'AI ALERT'), []);
  f.service.updateSettings(user.business_id, { autoAlerts: true, wasteTarget: 80 });
  assert.deepEqual(f.service.state(user).alerts, []);
  f.service.updateSettings(user.business_id, { wasteTarget: 50, notifyAI: false });
  assert.equal(f.service.state(user).alerts.length, 1);
  assert.deepEqual(notifications(f.service, user, 'AI ALERT'), []);
  f.service.updateSettings(user.business_id, { notifyAI: true });
  f.service.state(user);
  assert.equal(notifications(f.service, user, 'AI ALERT').length, 1);
  f.service.updateSettings(user.business_id, { notifyMarket: false, notifyOrders: false, notifySensors: false, notifyAI: false });
  for (const kind of ['LISTING', 'MARKETPLACE', 'ORDER', 'SENSOR', 'SHORTAGE']) {
    f.service.notify(user.business_id, kind, 'Muted notification', 'Should not be saved.');
    assert.deepEqual(notifications(f.service, user, kind), [], kind);
  }
  f.service.updateSettings(user.business_id, { notifyMarket: true, notifyOrders: true, notifySensors: true, notifyAI: true });
  for (const kind of ['LISTING', 'MARKETPLACE', 'ORDER', 'SENSOR', 'SHORTAGE']) {
    f.service.notify(user.business_id, kind, 'Enabled notification', 'Saved after opting in.');
    assert.equal(notifications(f.service, user, kind).length, 1, kind);
  }
  rejects(() => f.service.updateSettings(user.business_id, { notifyAI: 'false' }), 400, /true or false/);
  rejects(() => f.service.updateSettings(user.business_id, { wasteTarget: 81 }), 400, /between/);
});

test('unchanged alerts notify once and dismissals persist until the underlying inventory changes', (t) => {
  const f = fixture(t), user = f.account();
  const id = add(f.service, user, { qty: 40, dailyDemand: 5 });
  const first = f.service.state(user).alerts[0];
  f.service.state(user);
  assert.equal(notifications(f.service, user, 'AI ALERT').length, 1);
  f.service.dismiss(user.business_id, first.id);
  let state = f.service.state(user);
  assert.equal(state.alerts[0].status, 'dismissed');
  assert.deepEqual(state.insights, []);
  assert.equal(notifications(f.service, user, 'AI ALERT').length, 1);
  f.service.adjust(user.business_id, id, { delta: 5, kind: 'received' });
  state = f.service.state(user);
  assert.equal(state.alerts[0].status, 'pending');
  assert.notEqual(state.alerts[0].fingerprint, first.fingerprint);
  assert.equal(state.insights.length, 1);
  assert.equal(notifications(f.service, user, 'AI ALERT').length, 2);
});

test('waste disposal reduces stock and counts only kg and g with correct kilogram conversion', (t) => {
  const f = fixture(t), user = f.account(), other = f.account('Other Kitchen');
  const kg = add(f.service, user, { product: 'Potatoes', qty: 10 });
  const grams = add(f.service, user, { product: 'Herbs', unit: 'g', qty: 1500 });
  const liters = add(f.service, user, { product: 'Milk', unit: 'L', qty: 10 });
  const pieces = add(f.service, user, { product: 'Eggs', unit: 'pcs', qty: 12 });
  f.service.adjust(user.business_id, kg, { delta: -2.5, kind: 'waste' });
  f.service.adjust(user.business_id, grams, { delta: -750, kind: 'waste' });
  f.service.adjust(user.business_id, liters, { delta: -2, kind: 'waste' });
  f.service.adjust(user.business_id, pieces, { delta: -3, kind: 'waste' });
  f.service.adjust(user.business_id, kg, { qty: 1 }, true);
  f.service.adjust(user.business_id, kg, { delta: -1, kind: 'adjustment' });
  const otherKg = add(f.service, other, { qty: 10 });
  f.service.adjust(other.business_id, otherKg, { delta: -4, kind: 'waste' });
  assert.equal(item(f.service, user, kg).qty, 5.5);
  assert.equal(item(f.service, user, grams).qty, 750);
  assert.equal(item(f.service, user, liters).qty, 8);
  assert.equal(item(f.service, user, pieces).qty, 9);
  assert.equal(f.service.analytics(user.business_id, []).wasteKg, 3.25);
  assert.equal(f.service.analytics(other.business_id, []).wasteKg, 4);
  assert.equal(f.service.analytics(user.business_id, []).recoveredKg, 0);
  assert.equal(f.service.one("SELECT COUNT(*) n FROM inventory_transactions WHERE business_id=? AND kind='waste'", user.business_id).n, 4);
  rejects(() => f.service.adjust(user.business_id, kg, { delta: 1, kind: 'waste' }), 400, /Invalid stock movement/);
  assert.equal(item(f.service, user, kg).qty, 5.5);
  assert.equal(f.service.analytics(user.business_id, []).wasteKg, 3.25);
});
