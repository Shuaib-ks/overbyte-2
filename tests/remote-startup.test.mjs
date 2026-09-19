import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { openDatabase } from '../server/database.mjs';

const require = createRequire(import.meta.url);
const Database = require('libsql');

async function fixture(t, options = {}) {
  const worker = new Worker(new URL('./fixtures/hrana-worker.mjs', import.meta.url), {
    workerData: options,
  });
  t.after(() => worker.terminate());
  const [{ url }] = await once(worker, 'message');
  return {
    url,
    async trace() {
      const response = once(worker, 'message');
      worker.postMessage({ id: 1, type: 'trace' });
      return (await response)[0].trace;
    },
  };
}

test('installed native remote driver reads and writes user_version over real HTTP', async (t) => {
  const f = await fixture(t);
  const db = new Database(f.url, { authToken: 'test-only-token' });
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys=ON;');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 0);
  db.exec('PRAGMA user_version=2;');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  db.exec('CREATE TABLE retained_inventory(id TEXT PRIMARY KEY, qty REAL);');
  db.prepare('INSERT INTO retained_inventory VALUES(?, ?)').run('batch-1', 18);
  assert.equal(db.prepare('SELECT qty FROM retained_inventory WHERE id=?').get('batch-1').qty, 18);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    .some((row) => row.name === 'retained_inventory'));
  assert.ok((await f.trace()).some((sql) => /user_version/i.test(sql)));
});

test('remote database initializes and reopens existing schema through native transport', async (t) => {
  const f = await fixture(t);
  const options = { config: { url: f.url, authToken: 'test-only-token' } };
  let db = openDatabase(':memory:', options);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='inventory_create_requests'").get());
  db.exec("INSERT INTO businesses(id,name,type,loc,created_at) VALUES('b1','Preserved Kitchen','Restaurant','Test','2026-09-19');");
  const beforeReopen = (await f.trace()).length;
  db.close();
  db = openDatabase(':memory:', options);
  t.after(() => db.close());
  assert.equal(db.prepare("SELECT name FROM businesses WHERE id='b1'").get().name, 'Preserved Kitchen');
  const reopenSql = (await f.trace()).slice(beforeReopen);
  assert.ok(!reopenSql.some((sql) => /\bCREATE\s+(TABLE|INDEX)\b/i.test(sql)),
    'A fully initialized schema must not run DDL again on every cold start');
});
