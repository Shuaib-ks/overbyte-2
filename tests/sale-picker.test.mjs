import test from 'node:test';
import assert from 'node:assert/strict';
import { saleProducts } from '../src/sale-form.js';
import { render as renderDashboard } from '../src/pages/dashboard.js';

const now = Date.parse('2026-09-23T12:00:00.000Z');
const expires = hours => new Date(now + hours * 3_600_000).toISOString();
const batch = (id, overrides = {}) => ({
  id, product: 'Milk', unit: 'L', qty: 5, reservedQty: 0,
  expiresAt: expires(24), ...overrides,
});

test('dashboard exposes Register Sale as its first primary quick action', () => {
  // Charts inject a stylesheet when the otherwise string-based view renders.
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => ({}), head: { appendChild() {} } };
  try {
    const html = renderDashboard();
    assert.match(html, /class="qa-btn primary" id="qa-sale"[^]*?Register Sale<\/button>/);
    assert.ok(html.indexOf('id="qa-sale"') < html.indexOf('id="qa-add"'));
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('sale picker groups trimmed, case-insensitive products and uses the earliest available batch', () => {
  const inventory = [
    batch('later', { product: ' milk ', qty: 3.337, reservedQty: 0.11, expiresAt: expires(48) }),
    batch('reserved-earlier', { qty: 10, reservedQty: 10, expiresAt: expires(1) }),
    batch('earliest', { product: 'MILK', qty: 2.222, expiresAt: expires(6), batch: 'Batch A' }),
  ];

  assert.deepEqual(saleProducts(inventory, now), [{ ...inventory[2], available: 5.45 }]);
});

test('sale picker excludes expired, empty, and fully reserved stock', () => {
  const inventory = [
    batch('expired', { expiresAt: expires(-1) }),
    batch('expires-now', { expiresAt: expires(0) }),
    batch('empty', { qty: 0 }),
    batch('negative', { qty: -2 }),
    batch('fully-reserved', { reservedQty: 5 }),
    batch('over-reserved', { reservedQty: 6 }),
    batch('available', { qty: 4, reservedQty: 1 }),
    batch('unreserved', { qty: 2, reservedQty: undefined }),
  ];

  const products = saleProducts(inventory, now);
  assert.equal(products.length, 1);
  assert.equal(products[0].available, 5);
  assert.ok(['available', 'unreserved'].includes(products[0].id));
  assert.deepEqual(saleProducts(inventory.slice(0, 6), now), []);
  assert.deepEqual(saleProducts([], now), []);
});

test('sale picker keeps units separate, sorts choices, and leaves input unchanged', () => {
  const inventory = [
    batch('banana', { product: 'Banana', unit: 'kg' }),
    batch('apple-packs', { product: 'Apple', unit: 'packs' }),
    batch('apple-kg', { product: 'Apple', unit: 'kg' }),
  ];
  const before = structuredClone(inventory);
  inventory.forEach(Object.freeze);
  Object.freeze(inventory);

  const products = saleProducts(inventory, now);
  assert.deepEqual(products.map(({ id, available }) => ({ id, available })), [
    { id: 'apple-kg', available: 5 },
    { id: 'apple-packs', available: 5 },
    { id: 'banana', available: 5 },
  ]);
  assert.deepEqual(inventory, before);
  assert.notEqual(products[0], inventory[2]);
});
