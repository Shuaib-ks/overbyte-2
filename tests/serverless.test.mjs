import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { databaseConfig, openDatabase, transaction } from '../server/database.mjs';
import { Service } from '../server/service.mjs';
import { createApp } from '../server.mjs';

const password = 'Serverless-test-password-482!';
const future = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();
const credentials = (name = 'Serverless Kitchen') => ({
  name, loc: 'Bengaluru', email: `${randomUUID()}@example.test`, password,
});
const inventory = (overrides = {}) => ({
  product: 'Chicken Breast', category: 'Meat', unit: 'kg', qty: 18, cost: 240,
  expiresAt: future(), dailyDemand: 7, storage: 'Refrigerated', ...overrides,
});
const rateLimited = (fn) => assert.throws(fn, (error) => error.status === 429 && /15 minutes/.test(error.message));

async function handlerFixture(t, options = {}) {
  const db = openDatabase(':memory:', { config: { driver: 'sqlite' } });
  const app = createApp({ database: db, monitorEnabled: false, secureCookies: true, cronSecret: 'serverless-test-cron-secret', ...options });
  // Vercel provides the handler directly and may have consumed/parsed the body.
  const wrapper = http.createServer(async (req, res) => {
    if (req.headers['x-test-preparsed']) {
      let text = '';
      for await (const chunk of req) text += chunk;
      if (req.headers['x-test-preparsed'] === 'getter') Object.defineProperty(req, 'body', { get() { return JSON.parse(text); } });
      else req.body = req.headers['x-test-preparsed'] === 'object' ? JSON.parse(text) : text;
    }
    await app.handler(req, res);
  });
  await new Promise((resolveListen) => wrapper.listen(0, '127.0.0.1', resolveListen));
  const base = `http://127.0.0.1:${wrapper.address().port}`;
  t.after(async () => {
    await new Promise((resolveClose) => {
      wrapper.close(resolveClose);
      wrapper.closeIdleConnections();
    });
    await app.close();
  });
  return {
    app,
    async request(path, { method = 'GET', data, body, headers = {} } = {}) {
      const response = await fetch(base + path, {
        method, headers: { ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ?? (data !== undefined ? JSON.stringify(data) : undefined),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
  };
}

test('Vercel storage configuration fails closed unless both persistent database credentials are supplied', () => {
  for (const env of [
    { VERCEL: '1' },
    { VERCEL: '1', TURSO_DATABASE_URL: 'libsql://overbyte.example.test' },
    { VERCEL: '1', TURSO_AUTH_TOKEN: 'test-token' },
    { TURSO_DATABASE_URL: 'libsql://overbyte.example.test' },
    { TURSO_AUTH_TOKEN: 'test-token' },
    { VERCEL: '1', TURSO_DATABASE_URL: ' ', TURSO_AUTH_TOKEN: ' ' },
  ]) assert.throws(() => databaseConfig(env), /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN/);
  assert.deepEqual(databaseConfig({}), { driver: 'sqlite' });
  assert.deepEqual(databaseConfig({ OVERBYTE_SQLITE_DRIVER: 'libsql' }), { driver: 'libsql' });
  assert.deepEqual(databaseConfig({ VERCEL: '1', TURSO_DATABASE_URL: ' libsql://overbyte.example.test ', TURSO_AUTH_TOKEN: ' test-token ' }), {
    url: 'libsql://overbyte.example.test', authToken: 'test-token',
  });
});

test('remote database configuration rejects insecure schemes and embedded URL credentials', () => {
  for (const url of [
    'not a URL', 'http://database.example.test', 'file:///tmp/database.sqlite',
    'ws://database.example.test', 'ftp://database.example.test',
    'libsql://username:password@database.example.test', 'https://username@database.example.test',
    'libsql://database.example.test?authToken=secret', 'https://database.example.test#secret',
  ]) assert.throws(() => databaseConfig({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: 'test-token' }), /invalid|secure libsql/);
  assert.deepEqual(databaseConfig({ TURSO_DATABASE_URL: 'https://overbyte.example.test', TURSO_AUTH_TOKEN: 'test-token' }), {
    url: 'https://overbyte.example.test', authToken: 'test-token',
  });
});

test('existing databases migrate idempotency storage and query indexes without losing inventory', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'overbyte-migration-test-'));
  const filename = join(directory, 'existing.sqlite');
  let db = openDatabase(filename, { config: { driver: 'sqlite' } });
  t.after(async () => { db.close(); await rm(directory, { recursive: true, force: true }); });
  const service = new Service(db), user = service.signup(credentials()).user;
  const original = service.addInventory(user.business_id, inventory());
  db.exec('DROP TABLE inventory_create_requests; DROP INDEX inventory_transactions_business_kind_time; PRAGMA user_version=0;');
  db.close();
  db = openDatabase(filename, { config: { driver: 'sqlite' } });
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM inventory').get().n, 1);
  assert.ok(db.prepare('SELECT id FROM inventory WHERE id=?').get(original.id));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='inventory_create_requests'").get());
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='inventory_transactions_business_kind_time'").get());
});

test('native libsql driver supports schema constraints and all-or-nothing service transactions', (t) => {
  const db = openDatabase(':memory:', { config: { driver: 'libsql' } });
  t.after(() => db.close());
  const service = new Service(db), account = service.signup(credentials()).user;
  const original = new Error('deliberate transaction failure');
  assert.throws(() => transaction(db, () => {
    db.prepare('INSERT INTO auth_attempts VALUES(?,?,?)').run('rollback-test', 1, Date.now() + 900000);
    throw original;
  }), (error) => error === original);
  assert.equal(service.one('SELECT COUNT(*) n FROM auth_attempts').n, 0);
  assert.throws(() => service.addInventory('missing-business', inventory()), /FOREIGN KEY/i);
  assert.equal(service.one('SELECT COUNT(*) n FROM inventory').n, 0);
  const first = service.addInventory(account.business_id, inventory());
  assert.equal(service.inventory(account.business_id)[0].id, first.id);
  assert.equal(service.one('SELECT COUNT(*) n FROM inventory_transactions').n, 1);
});

test('native libsql driver completes authenticated inventory, reservation, pickup, and analytics flow', (t) => {
  const db = openDatabase(':memory:', { config: { driver: 'libsql' } });
  t.after(() => db.close());
  const service = new Service(db), sellerCredentials = credentials('Hosted Seller');
  const sellerAuth = service.signup(sellerCredentials), seller = sellerAuth.user;
  const buyer = service.signup(credentials('Hosted Buyer')).user;
  assert.equal(service.session(sellerAuth.token).id, seller.id);
  assert.equal(service.login({ email: sellerCredentials.email, password }).user.id, seller.id);
  assert.deepEqual(service.inventory(buyer.business_id), []);
  const source = service.addInventory(seller.business_id, inventory());
  service.addInventory(buyer.business_id, inventory({ qty: 8, dailyDemand: 20 }));
  const listing = service.createListing(seller.business_id, {
    inventoryItemId: source.id, qty: 12, price: 180, minOrder: 5, pickup: 'Today 16:00–18:00',
  });
  const payload = { listingId: listing.id, qty: 10, idempotencyKey: randomUUID() };
  const order = service.createOrder(buyer.business_id, payload);
  assert.equal(service.createOrder(buyer.business_id, payload).id, order.id);
  assert.equal(service.one('SELECT remaining FROM listings WHERE id=?', listing.id).remaining, 2);
  assert.equal(service.inventory(buyer.business_id).reduce((sum, row) => sum + row.qty, 0), 8);
  assert.throws(() => service.advanceOrder(buyer.business_id, order.id), (error) => error.status === 403);
  service.advanceOrder(seller.business_id, order.id);
  service.advanceOrder(seller.business_id, order.id);
  service.advanceOrder(seller.business_id, order.id);
  assert.equal(service.inventory(seller.business_id)[0].qty, 8);
  assert.equal(service.inventory(buyer.business_id).reduce((sum, row) => sum + row.qty, 0), 18);
  assert.equal(service.state(seller).analytics[seller.business_id].surplusRevenue, 1800);
  assert.equal(service.state(buyer).analytics[buyer.business_id].purchaseSavings, 600);
  service.logout(sellerAuth.token);
  assert.equal(service.session(sellerAuth.token), null);
});

test('cron handler requires its bearer secret and reconciles every business without duplicate alerts', async (t) => {
  const f = await handlerFixture(t), service = f.app.service;
  const seller = service.signup(credentials('Cron Surplus Kitchen')).user;
  const buyer = service.signup(credentials('Cron Shortage Kitchen')).user;
  const item = service.addInventory(seller.business_id, inventory({ qty: 40, dailyDemand: 5 }));
  service.addInventory(buyer.business_id, inventory({ qty: 3, dailyDemand: 20 }));
  const listing = service.createListing(seller.business_id, { inventoryItemId: item.id, qty: 12, price: 180, minOrder: 1, pickup: 'Today' });
  service.run('UPDATE listings SET expires_at=? WHERE id=?', new Date(Date.now() - 1000).toISOString(), listing.id);
  for (const authorization of [undefined, 'Bearer wrong-secret', 'serverless-test-cron-secret']) {
    const result = await f.request('/api/cron', { headers: authorization ? { Authorization: authorization } : {} });
    assert.equal(result.status, 401);
  }
  assert.equal(service.one('SELECT status FROM listings WHERE id=?', listing.id).status, 'Active');
  const authorized = { headers: { Authorization: 'Bearer serverless-test-cron-secret' } };
  const result = await f.request('/api/cron', authorized);
  assert.equal(result.status, 200);
  assert.equal(result.body.businessesChecked, 2);
  assert.equal(result.body.ok, true);
  assert.equal(service.one('SELECT status FROM listings WHERE id=?', listing.id).status, 'Expired');
  assert.ok(service.one("SELECT COUNT(*) n FROM notifications WHERE business_id=? AND kind='AI ALERT'", seller.business_id).n >= 1);
  assert.equal(service.one("SELECT COUNT(*) n FROM notifications WHERE business_id=? AND kind='SHORTAGE'", buyer.business_id).n, 1);
  const count = service.one('SELECT COUNT(*) n FROM notifications').n;
  assert.equal((await f.request('/api/cron', authorized)).status, 200);
  assert.equal(service.one('SELECT COUNT(*) n FROM notifications').n, count);
  assert.equal(service.one('SELECT COUNT(*) n FROM daily_snapshots').n, 2);
});

test('cron remains inaccessible when its secret is not configured', async (t) => {
  const f = await handlerFixture(t, { cronSecret: '' });
  assert.equal((await f.request('/api/cron', { headers: { Authorization: 'Bearer ' } })).status, 401);
});

test('authentication limits are shared by service instances, survive restart, and store hashed keys', async (t) => {
  const temporaryParent = resolve(tmpdir()), directory = await mkdtemp(join(temporaryParent, 'overbyte-serverless-test-'));
  const filename = join(directory, 'auth.sqlite');
  let db = openDatabase(filename, { config: { driver: 'sqlite' } });
  t.after(async () => {
    db.close();
    assert.equal(dirname(resolve(directory)), temporaryParent);
    assert.ok(directory.startsWith(join(temporaryParent, 'overbyte-serverless-test-')));
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const first = new Service(db), second = new Service(db), keys = ['ip:192.0.2.8', 'email:private@example.test'];
  for (let i = 0; i < 15; i++) first.authAttempt(keys);
  for (let i = 0; i < 15; i++) second.authAttempt(keys);
  db.close();
  db = openDatabase(filename, { config: { driver: 'sqlite' } });
  const restarted = new Service(db);
  rateLimited(() => restarted.authAttempt(keys));
  const rows = restarted.all('SELECT * FROM auth_attempts');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.attempts === 31 && /^[a-f0-9]{64}$/.test(row.key_hash)));
  assert.doesNotMatch(JSON.stringify(rows), /private@example|192\.0\.2/);
  // Changing one dimension cannot evade a limit already reached on the other.
  rateLimited(() => restarted.authAttempt(['ip:192.0.2.9', keys[1]]));
  rateLimited(() => restarted.authAttempt([keys[0], 'email:other@example.test']));
  restarted.authAttempt(['ip:192.0.2.10', 'email:fresh@example.test']);
});

test('authentication attempt windows reset at fifteen minutes without extending on blocked retries', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-17T10:00:00.000Z') });
  const db = openDatabase(':memory:', { config: { driver: 'sqlite' } });
  t.after(() => db.close());
  const service = new Service(db), keys = ['ip:192.0.2.20'];
  for (let i = 0; i < 30; i++) service.authAttempt(keys);
  const resetAt = service.one('SELECT reset_at FROM auth_attempts').reset_at;
  t.mock.timers.tick(899999);
  rateLimited(() => service.authAttempt(keys));
  assert.equal(service.one('SELECT reset_at FROM auth_attempts').reset_at, resetAt);
  t.mock.timers.tick(1);
  service.authAttempt(keys);
  assert.equal(service.one('SELECT attempts FROM auth_attempts').attempts, 1);
  assert.equal(service.one('SELECT reset_at FROM auth_attempts').reset_at, resetAt + 900000);
});

test('direct serverless handler accepts pre-parsed bodies and issues secure, reusable sessions', async (t) => {
  const f = await handlerFixture(t), account = credentials('Parsed Body Kitchen');
  const signup = await f.request('/api/auth/signup', { method: 'POST', data: account, headers: { 'X-Test-Preparsed': 'object' } });
  assert.equal(signup.status, 200, JSON.stringify(signup.body));
  assert.equal(signup.body.state.authed, true);
  assert.deepEqual(signup.body.state.inventory[signup.body.state.bizId], []);
  const setCookie = signup.headers.get('set-cookie');
  assert.match(setCookie, /; HttpOnly/);
  assert.match(setCookie, /; SameSite=Lax/);
  assert.match(setCookie, /; Secure(?:;|$)/);
  const cookie = setCookie.split(';')[0];
  const saved = await f.request('/api/inventory', {
    method: 'POST', data: inventory(), headers: { 'X-Test-Preparsed': 'object', Cookie: cookie },
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.state.inventory[signup.body.state.bizId][0].qty, 18);
  const login = await f.request('/api/auth/login', {
    method: 'POST', data: { email: account.email, password }, headers: { 'X-Test-Preparsed': 'string' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.state.bizId, signup.body.state.bizId);
  assert.equal((await f.request('/api/state', { headers: { Cookie: cookie } })).body.authed, true);
});

test('pre-parsed serverless bodies retain JSON validation and request size limits', async (t) => {
  const f = await handlerFixture(t);
  const malformed = await f.request('/api/auth/login', { method: 'POST', body: '{', headers: { 'X-Test-Preparsed': 'string' } });
  assert.equal(malformed.status, 400);
  assert.match(malformed.body.error, /Invalid JSON/);
  const getterError = await f.request('/api/auth/login', { method: 'POST', body: '{', headers: { 'X-Test-Preparsed': 'getter' } });
  assert.equal(getterError.status, 400);
  assert.match(getterError.body.error, /Invalid JSON/);
  for (const data of [[], null, 'not an object']) {
    const result = await f.request('/api/auth/login', { method: 'POST', data, headers: { 'X-Test-Preparsed': 'object' } });
    assert.equal(result.status, 400);
  }
  const huge = await f.request('/api/auth/login', {
    method: 'POST', data: { email: 'x'.repeat(65537) }, headers: { 'X-Test-Preparsed': 'object' },
  });
  assert.equal(huge.status, 413);
  assert.match(huge.body.error, /too large/);
});
