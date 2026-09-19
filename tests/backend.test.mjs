import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.mjs';
import { openDatabase } from '../server/database.mjs';

const password = 'Valid-test-password-482!';
const future = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();
const inventoryOf = (state) => state.inventory[state.bizId];
const listingOf = (state, id) => state.listings.find((listing) => listing.id === id);
const orderOf = (state, id) => state.orders.find((order) => order.id === id);

async function fixture(t) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'overbyte-http-test-'));
  const dbPath = join(directory, 'test.sqlite');
  let app;
  let base;
  async function start() {
    const database = openDatabase(dbPath, { config: { driver: process.env.OVERBYTE_SQLITE_DRIVER === 'libsql' ? 'libsql' : 'sqlite' } });
    app = createApp({ database, secureCookies: false, monitorEnabled: false });
    await new Promise((resolveListen, reject) => {
      app.server.once('error', reject);
      app.server.listen(0, '127.0.0.1', resolveListen);
    });
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => {
    if (app) await app.close();
    // libsql native statement handles are finalized by GC before Windows unlinks files.
    global.gc?.();
    // Only remove the unique directory allocated by this fixture.
    assert.ok(directory.startsWith(parent + sep));
    assert.ok(directory.slice(parent.length + 1).startsWith('overbyte-http-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  const client = () => {
    let cookie = '';
    return {
      async request(path, { method = 'GET', data, headers = {} } = {}) {
        const response = await fetch(base + path, {
          method,
          headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
          body: data === undefined ? undefined : JSON.stringify(data),
          redirect: 'manual',
        });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const text = await response.text();
        let body = text;
        if (response.headers.get('content-type')?.includes('application/json')) body = JSON.parse(text);
        return { status: response.status, body, headers: response.headers };
      },
      async getState() {
        const response = await this.request('/api/state');
        assert.equal(response.status, 200, JSON.stringify(response.body));
        return response.body;
      },
      async post(path, data = {}) { return this.request(path, { method: 'POST', data }); },
      async signup(name) {
        this.email = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${randomUUID()}@example.test`;
        const response = await this.post('/api/auth/signup', { email: this.email, password, name, type: 'Restaurant', loc: 'Bengaluru' });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        this.bizId = response.body.state.bizId;
        return response;
      },
    };
  };
  return {
    client,
    get app() { return app; },
    async restart() { await app.close(); app = null; await start(); },
  };
}

async function addInventory(client, overrides = {}) {
  const response = await client.post('/api/inventory', {
    product: 'Chicken Breast', category: 'Meat & Poultry', unit: 'kg', qty: 18,
    cost: 220, market: 240, expiresAt: future(), dailyDemand: 7,
    storage: 'Refrigerated', supplier: 'Test supplier', batch: 'BATCH-001', ...overrides,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const item = inventoryOf(response.body.state).find((row) => row.id === response.body.result.id);
  assert.ok(item);
  return item;
}

async function publish(client, item, overrides = {}) {
  const response = await client.post('/api/listings', {
    inventoryItemId: item.id, qty: 12, price: 180, minOrder: 5,
    expiresAt: item.expiresAt, pickup: 'Today, 18:00–20:00',
    notes: 'Sealed packs. Keep refrigerated.', cond: 'Fresh', storage: 'Refrigerated', ...overrides,
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const listing = listingOf(response.body.state, response.body.result.id);
  assert.ok(listing);
  return listing;
}

async function purchase(client, listing, qty = 10, idempotencyKey = randomUUID()) {
  const response = await client.post('/api/orders', { listingId: listing.id, qty, idempotencyKey });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const order = orderOf(response.body.state, response.body.result.id);
  assert.ok(order);
  return { order, state: response.body.state, idempotencyKey };
}

test('inventory retries return the committed batch without duplicate stock or movements', async (t) => {
  const f = await fixture(t);
  const buyer = f.client();
  await buyer.signup('Retry Kitchen');
  const payload = {
    product: 'Tomatoes', category: 'Produce', unit: 'kg', qty: 14,
    cost: 80, expiresAt: future(), dailyDemand: 3,
    storage: 'Refrigerated', supplier: '', batch: 'RETRY-001',
    idempotencyKey: randomUUID(),
  };
  const [first, simultaneous] = await Promise.all([
    buyer.post('/api/inventory', payload), buyer.post('/api/inventory', payload),
  ]);
  assert.equal(first.status, 200);
  assert.equal(simultaneous.status, 200);
  assert.equal(first.body.result.id, simultaneous.body.result.id);
  assert.equal((await buyer.getState()).inventory[buyer.bizId].length, 1);
  await f.restart();
  const replay = await buyer.post('/api/inventory', payload);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.result.id, first.body.result.id);
  assert.equal((await buyer.post('/api/inventory', { ...payload, qty: 15 })).status, 409);
  assert.equal(f.app.service.one('SELECT COUNT(*) n FROM inventory WHERE business_id=?', buyer.bizId).n, 1);
  assert.equal(f.app.service.one('SELECT COUNT(*) n FROM inventory_transactions WHERE business_id=?', buyer.bizId).n, 1);
});

test('state database read count stays bounded as unrelated products accumulate', async (t) => {
  const f = await fixture(t);
  const buyer = f.client();
  await buyer.signup('Batch Kitchen');
  const user = f.app.service.one('SELECT * FROM users WHERE business_id=?', buyer.bizId);
  const readCount = () => {
    const counters = { dbCalls: 0, dbMs: 0 };
    f.app.service.telemetry = counters;
    try { f.app.service.state(user); return counters.dbCalls; }
    finally { f.app.service.telemetry = null; }
  };
  const before = readCount();
  for (let index = 0; index < 20; index++) {
    f.app.service.addInventory(buyer.bizId, {
      product: `Item ${index}`, category: 'Other', unit: 'kg', qty: 8,
      cost: 40, expiresAt: future(72), dailyDemand: null,
      storage: 'Refrigerated', supplier: '', batch: `B${index}`,
    });
  }
  const after = readCount();
  assert.ok(after - before <= 7, `State grew from ${before} to ${after} database calls`);
  assert.ok(after < 40, `State used ${after} database calls`);
});

test('database failures return a useful status and a correlatable request ID', async (t) => {
  const f = await fixture(t);
  const buyer = f.client();
  await buyer.signup('Error Kitchen');
  const original = f.app.service.state;
  f.app.service.state = () => { throw Object.assign(new Error('private database details'), { code: 'SQLITE_BUSY' }); };
  try {
    const response = await buyer.request('/api/state');
    assert.equal(response.status, 503);
    const requestId = response.headers.get('x-request-id');
    assert.match(requestId, /^[a-f0-9-]{36}$/);
    assert.match(response.body.error, /database is temporarily unavailable/i);
    assert.ok(response.body.error.includes(requestId));
    assert.doesNotMatch(response.body.error, /private database details/);
  } finally { f.app.service.state = original; }
});

test('new accounts have empty private workspaces and password-based sessions', async (t) => {
  const f = await fixture(t);
  const client = f.client();
  assert.deepEqual(await client.getState(), { authed: false });
  assert.equal((await client.post('/api/inventory', {})).status, 401);
  const signup = await client.signup('Actual Kitchen');
  assert.match(signup.headers.get('set-cookie'), /HttpOnly/);
  assert.match(signup.headers.get('set-cookie'), /SameSite=Lax/);
  const state = signup.body.state;
  assert.equal(state.user.email, client.email);
  assert.equal(state.businesses.find((b) => b.id === state.bizId).name, 'Actual Kitchen');
  assert.equal(state.businesses.length, 1);
  assert.deepEqual(inventoryOf(state), []);
  for (const field of ['listings', 'orders', 'alerts', 'sensors', 'watches', 'notifications']) assert.deepEqual(state[field], [], field);
  for (const field of ['surplusRevenue', 'recoveredKg', 'purchaseSavings', 'foodSaved']) assert.equal(state.analytics[state.bizId][field], 0, field);
  assert.doesNotMatch(JSON.stringify(state), /GreenFork|password_hash|token_hash/);
  const storedUser = f.app.db.prepare('SELECT password_hash FROM users WHERE email=?').get(client.email);
  assert.notEqual(storedUser.password_hash, password);
  assert.equal((await client.post('/api/auth/logout')).status, 200);
  assert.deepEqual(await client.getState(), { authed: false });
  const wrong = await client.post('/api/auth/login', { email: client.email, password: 'wrong-password' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await client.getState(), { authed: false });
  const login = await client.post('/api/auth/login', { email: client.email.toUpperCase(), password });
  assert.equal(login.status, 200);
  assert.equal(login.body.state.bizId, state.bizId);
  const duplicate = await f.client().post('/api/auth/signup', { name: 'Duplicate', loc: 'Bengaluru', email: client.email, password });
  assert.equal(duplicate.status, 409);
});

test('inventory ownership is enforced and public business records hide private contact details', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), buyer = f.client();
  await seller.signup('Seller Kitchen');
  await buyer.signup('Buyer Kitchen');
  const item = await addInventory(seller);
  assert.equal((await seller.request('/api/profile', { method: 'PATCH', data: { owner: 'Private Owner', email: 'private@example.test' } })).status, 200);
  const buyerState = await buyer.getState();
  assert.deepEqual(Object.keys(buyerState.inventory), [buyer.bizId]);
  assert.deepEqual(inventoryOf(buyerState), []);
  const publicSeller = buyerState.businesses.find((b) => b.id === seller.bizId);
  assert.equal(publicSeller.verified, false);
  assert.equal(publicSeller.rating, null);
  assert.equal(publicSeller.owner, undefined);
  assert.equal(publicSeller.email, undefined);
  assert.equal((await buyer.request(`/api/inventory/${item.id}`, { method: 'PATCH', data: { dailyDemand: 100 } })).status, 404);
  assert.equal((await buyer.post(`/api/inventory/${item.id}/consume`, { qty: 1 })).status, 404);
  assert.equal((await buyer.post('/api/listings', { inventoryItemId: item.id, qty: 1, price: 1, pickup: 'Now' })).status, 404);
  const listing = await publish(seller, item);
  assert.equal((await buyer.post(`/api/listings/${listing.id}/cancel`)).status, 404);
  assert.equal((await seller.post('/api/orders', { listingId: listing.id, qty: 5, idempotencyKey: randomUUID() })).status, 400);
  assert.equal(inventoryOf(await seller.getState())[0].qty, 18);
});

test('listing commitments limit available stock and prevent consumption or duplicate listings', async (t) => {
  const f = await fixture(t);
  const seller = f.client(); await seller.signup('Stock Owner');
  const item = await addInventory(seller);
  await publish(seller, item);
  let own = inventoryOf(await seller.getState())[0];
  assert.equal(own.qty, 18);
  assert.equal(own.reservedQty, 12);
  assert.equal(own.availableToList, 6);
  const tooMuch = await seller.post('/api/listings', { inventoryItemId: item.id, qty: 7, price: 180, minOrder: 1, pickup: 'Now' });
  assert.equal(tooMuch.status, 409);
  assert.equal((await seller.post(`/api/inventory/${item.id}/consume`, { qty: 7 })).status, 409);
  assert.equal((await seller.post(`/api/inventory/${item.id}/adjust`, { delta: -7 })).status, 409);
  assert.equal((await seller.post(`/api/inventory/${item.id}/consume`, { qty: 6 })).status, 200);
  own = inventoryOf(await seller.getState())[0];
  assert.equal(own.qty, 12);
  assert.equal(own.availableToList, 0);
  assert.equal((await seller.post('/api/listings', { inventoryItemId: item.id, qty: 1, price: 0, pickup: 'Now' })).status, 400);
});

test('concurrent buyers cannot oversell and retried requests reserve stock only once', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), first = f.client(), second = f.client();
  await seller.signup('Concurrent Seller'); await first.signup('First Buyer'); await second.signup('Second Buyer');
  const item = await addInventory(seller);
  const listing = await publish(seller, item);
  const keys = [randomUUID(), randomUUID()];
  const buyers = [first, second];
  const results = await Promise.all(buyers.map((buyer, index) => buyer.post('/api/orders', { listingId: listing.id, qty: 8, idempotencyKey: keys[index] })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winnerIndex = results.findIndex((r) => r.status === 200);
  const winner = buyers[winnerIndex], winning = results[winnerIndex].body;
  const retry = await winner.post('/api/orders', { listingId: listing.id, qty: 8, idempotencyKey: keys[winnerIndex] });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.result.id, winning.result.id);
  assert.equal(retry.body.state.orders.length, 1);
  assert.deepEqual(inventoryOf(retry.body.state), []);
  assert.equal((await winner.post('/api/orders', { listingId: listing.id, qty: 7, idempotencyKey: keys[winnerIndex] })).status, 409);
  const sellerState = await seller.getState();
  assert.equal(listingOf(sellerState, listing.id).qtyRemaining, 4);
  assert.equal(sellerState.orders.length, 1);
  assert.equal(inventoryOf(sellerState)[0].qty, 18);
  assert.equal(inventoryOf(sellerState)[0].availableToList, 6);
});

test('cancellation releases stock once, and cancelled listings retain only live order reservations', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), buyer = f.client(), stranger = f.client();
  await seller.signup('Cancellation Seller'); await buyer.signup('Cancellation Buyer'); await stranger.signup('Unrelated Business');
  const item = await addInventory(seller);
  const listing = await publish(seller, item);
  const first = await purchase(buyer, listing);
  assert.equal((await stranger.post(`/api/orders/${first.order.id}/cancel`)).status, 404);
  assert.equal((await buyer.post(`/api/orders/${first.order.id}/cancel`)).status, 200);
  assert.equal((await buyer.post(`/api/orders/${first.order.id}/cancel`)).status, 200);
  let state = await seller.getState();
  assert.equal(listingOf(state, listing.id).qtyRemaining, 12);
  assert.equal(inventoryOf(state)[0].qty, 18);
  assert.equal(inventoryOf(state)[0].availableToList, 6);
  const second = await purchase(buyer, listing);
  assert.equal((await seller.post(`/api/listings/${listing.id}/cancel`)).status, 200);
  state = await seller.getState();
  assert.equal(listingOf(state, listing.id).status, 'Cancelled');
  assert.equal(inventoryOf(state)[0].reservedQty, 10);
  assert.equal(inventoryOf(state)[0].availableToList, 8);
  assert.equal((await buyer.post(`/api/orders/${second.order.id}/cancel`)).status, 200);
  state = await seller.getState();
  assert.equal(inventoryOf(state)[0].reservedQty, 0);
  assert.equal(inventoryOf(state)[0].availableToList, 18);
  assert.deepEqual(inventoryOf(await buyer.getState()), []);
  assert.equal(state.analytics[state.bizId].surplusRevenue, 0);
});

test('seller pickup transfers inventory exactly once, preserves expiry and updates completed analytics', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), buyer = f.client();
  await seller.signup('Handover Seller'); await buyer.signup('Handover Buyer');
  const source = await addInventory(seller);
  const beforeBuyer = await addInventory(buyer, { qty: 8, cost: 240, dailyDemand: 20, batch: 'BUYER-BASE' });
  const listing = await publish(seller, source);
  const { order } = await purchase(buyer, listing);
  assert.equal((await buyer.post(`/api/orders/${order.id}/advance`)).status, 403);
  assert.equal(inventoryOf(await buyer.getState()).reduce((sum, i) => sum + i.qty, 0), 8);
  const advances = await Promise.all([seller.post(`/api/orders/${order.id}/advance`), seller.post(`/api/orders/${order.id}/advance`)]);
  assert.ok(advances.every((r) => r.status === 200), JSON.stringify(advances.map((r) => r.body)));
  assert.equal((await seller.post(`/api/orders/${order.id}/advance`)).status, 200);
  const sellerState = await seller.getState(), buyerState = await buyer.getState();
  assert.equal(orderOf(sellerState, order.id).status, 'Completed');
  assert.equal(inventoryOf(sellerState)[0].qty, 8);
  assert.equal(inventoryOf(buyerState).reduce((sum, i) => sum + i.qty, 0), 18);
  assert.equal(inventoryOf(buyerState).length, 2);
  const received = inventoryOf(buyerState).find((i) => i.id !== beforeBuyer.id);
  assert.equal(received.qty, 10);
  assert.equal(received.expiresAt, listing.expiresAt);
  assert.equal(received.cost, 180);
  assert.equal(sellerState.analytics[seller.bizId].surplusRevenue, 1800);
  assert.equal(sellerState.analytics[seller.bizId].recoveredKg, 10);
  assert.equal(buyerState.analytics[buyer.bizId].purchaseSavings, 600);
  assert.equal((await buyer.post(`/api/orders/${order.id}/cancel`)).status, 409);
  assert.equal((await seller.post(`/api/orders/${order.id}/cancel`)).status, 409);
  const movementCounts = f.app.db.prepare("SELECT kind,COUNT(*) AS count FROM inventory_transactions WHERE kind IN ('sale','purchase') GROUP BY kind").all();
  assert.deepEqual(movementCounts.map((r) => [r.kind, r.count]), [['purchase', 1], ['sale', 1]]);
});

test('remaining stock below the minimum order can be purchased as a final remainder', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), buyer = f.client();
  await seller.signup('Remainder Seller'); await buyer.signup('Remainder Buyer');
  const listing = await publish(seller, await addInventory(seller));
  assert.equal((await buyer.post('/api/orders', { listingId: listing.id, qty: 2, idempotencyKey: randomUUID() })).status, 400);
  await purchase(buyer, listing, 10);
  const last = await purchase(buyer, listing, 2);
  assert.equal(last.order.qty, 2);
  const state = await seller.getState();
  assert.equal(listingOf(state, listing.id).qtyRemaining, 0);
  assert.equal(listingOf(state, listing.id).status, 'Reserved');
  assert.equal(state.orders.reduce((sum, order) => sum + order.qty, 0), 12);
});

test('sessions, inventories, listings and orders survive a server restart', async (t) => {
  const f = await fixture(t);
  const seller = f.client(), buyer = f.client();
  await seller.signup('Persistent Seller'); await buyer.signup('Persistent Buyer');
  const item = await addInventory(seller);
  const listing = await publish(seller, item);
  const { order } = await purchase(buyer, listing);
  await f.restart();
  const sellerState = await seller.getState(), buyerState = await buyer.getState();
  assert.equal(sellerState.authed, true);
  assert.equal(sellerState.bizId, seller.bizId);
  assert.equal(inventoryOf(sellerState)[0].id, item.id);
  assert.equal(listingOf(sellerState, listing.id).qtyRemaining, 2);
  assert.equal(orderOf(buyerState, order.id).qty, 10);
  assert.equal(orderOf(buyerState, order.id).status, 'Ready for pickup');
  assert.deepEqual(inventoryOf(buyerState), []);
  const freshClient = f.client();
  const login = await freshClient.post('/api/auth/login', { email: seller.email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.state.bizId, seller.bizId);
});

test('static serving never exposes private application files or database paths', async (t) => {
  const f = await fixture(t);
  const client = f.client();
  for (const path of ['/server.mjs', '/server/database.mjs', '/server/service.mjs', '/data/overbyte.sqlite', '/data/overbyte.sqlite-wal', '/package.json', '/.env', '/tests/backend.test.mjs', '/assets/../server.mjs', '/src/%2e%2e/server.mjs', '/src/%252e%252e/server.mjs']) {
    const response = await client.request(path);
    assert.ok([403, 404].includes(response.status), `${path}: ${response.status}`);
    assert.doesNotMatch(String(response.body), /CREATE TABLE|password_hash|SQLite format/);
  }
  const page = await client.request('/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await client.request('/src/pages/surplus.js')).status, 200);
  const crossSite = await client.post('/api/auth/signup', {});
  assert.equal(crossSite.status, 400);
  const forbiddenOrigin = await client.request('/api/auth/login', { method: 'POST', data: {}, headers: { Origin: 'https://untrusted.example.test' } });
  assert.equal(forbiddenOrigin.status, 403);
  const forbiddenFetch = await client.request('/api/state', { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(forbiddenFetch.status, 403);
});
