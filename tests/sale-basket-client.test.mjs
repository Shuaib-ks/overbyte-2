import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, store } from '../src/store.js';

test('multi-product sale uses one request, preserves retry key, and applies server stock', async (t) => {
  const requests = [];
  const items = [{ inventoryItemId: 'tomatoes', qty: 2 }, { inventoryItemId: 'bread', qty: 3 }];
  const next = { authed: true, bizId: 'kitchen', businesses: [], inventory: { kitchen: [{ id: 'bread', qty: 7 }] } };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    if (requests.length === 1) throw new TypeError('Connection interrupted');
    return new Response(JSON.stringify({ result: { sales: [{ id: 'a' }, { id: 'b' }] }, state: next }), { status: 200 });
  });
  const options = { idempotencyKey: 'same-customer-sale' };
  await assert.rejects(actions.registerSales(items, options), /Connection interrupted/);
  const result = await actions.registerSales(items, options);
  assert.equal(requests.length, 2, 'one basket request per attempt, not one request per product');
  assert.equal(requests[0].url, '/api/sales');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.deepEqual(requests[0].body, { items, idempotencyKey: options.idempotencyKey });
  assert.deepEqual(requests[1].body, requests[0].body);
  assert.equal(result.sales.length, 2);
  assert.equal(store.get().inventory.kitchen[0].qty, 7);
});
