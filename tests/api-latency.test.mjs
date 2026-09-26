import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { openDatabase } from '../server/database.mjs';
import { Service } from '../server/service.mjs';

async function fixture(t) {
  const worker = new Worker(new URL('./fixtures/hrana-worker.mjs', import.meta.url), {
    workerData: { strictTransactions: true },
  });
  t.after(() => worker.terminate());
  const [{ url }] = await once(worker, 'message');
  const db = openDatabase(':memory:', { config: { url, authToken: 'test-only-token' } });
  t.after(() => db.close());
  const service = new Service(db);
  const { user, token } = service.signup({
    name: 'Latency Kitchen', loc: 'Test', email: 'latency@example.test',
    password: 'Latency-test-password-123!',
  });
  const items = ['Tomatoes', 'Potatoes', 'Carrots'].map((product) => ({
    inventoryItemId: service.addInventory(user.business_id, {
      product, category: 'Vegetables', unit: 'kg', qty: 100, cost: 20,
      expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(), storage: 'Refrigerated',
    }).id,
    qty: 1,
  }));
  async function requests() {
    const pending = once(worker, 'message');
    worker.postMessage({ id: 1, type: 'requests' });
    return (await pending)[0].requests;
  }
  async function measured(action) {
    const before = (await requests()).length;
    const value = action();
    return { value, requests: (await requests()).slice(before) };
  }
  return { service, db, user, token, items, measured };
}

test('native remote full state and multi-product sale have bounded network round trips', async (t) => {
  const { service, user, token, items, measured } = await fixture(t);
  const initial = await measured(() => service.state(user));
  assert.ok(initial.requests.length <= 8, `Initial state used ${initial.requests.length} HTTP calls`);
  const warm = await measured(() => service.state(user));
  assert.ok(warm.requests.length <= 2, `Unchanged state used ${warm.requests.length} HTTP calls`);

  // This mirrors the complete authenticated mutation response, including its
  // refreshed dashboard, rather than measuring SQL execution on local SQLite.
  const payload = { items, idempotencyKey: 'latency-basket' };
  const basket = await measured(() => {
    const authed = service.session(token);
    const result = service.registerSales(authed.business_id, payload);
    return { result, state: service.state(authed) };
  });
  assert.ok(basket.requests.length <= 24, `Full basket response used ${basket.requests.length} HTTP calls`);
  assert.equal(basket.value.result.sales.length, 3);
  assert.equal(basket.value.state.salesHistory.length, 3);
  for (const item of basket.value.state.inventory[user.business_id]) assert.equal(item.qty, 99);
  const replay = await measured(() => service.registerSales(user.business_id, payload));
  assert.deepEqual(replay.value, basket.value.result);
  assert.ok(replay.requests.length <= 8, `Basket replay used ${replay.requests.length} HTTP calls`);
  t.diagnostic(JSON.stringify({ initialState: initial.requests.length, warmState: warm.requests.length,
    authenticatedBasketAndState: basket.requests.length, replay: replay.requests.length }));
});

test('reused native statements do not leak writes outside a rolled-back transaction', async (t) => {
  const { service, user, items } = await fixture(t);
  const sql = 'UPDATE inventory SET qty=? WHERE id=?';
  const iid = items[0].inventoryItemId;
  service.run(sql, 98, iid);
  assert.throws(() => service.tx(() => {
    service.run(sql, 80, iid);
    throw new Error('rollback-check');
  }), /rollback-check/);
  assert.equal(service.one('SELECT qty FROM inventory WHERE id=?', iid).qty, 98);
  service.tx(() => service.run(sql, 97, iid));
  assert.throws(() => service.tx(() => {
    service.run(sql, 70, iid);
    throw new Error('rollback-check-again');
  }), /rollback-check-again/);
  assert.equal(service.one('SELECT qty FROM inventory WHERE id=? AND business_id=?', iid, user.business_id).qty, 97);
});
