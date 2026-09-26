import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';

// A deliberately small Hrana v3 fixture. The real native remote driver performs
// HTTP calls against this worker; SQLite and all business data remain in memory.
// It exercises transport/parser behavior, not Turso's proprietary server policy.
const db = new DatabaseSync(':memory:');
const trace = [];
const requests = [];
const stored = new Map();
if (workerData?.seed) db.exec(workerData.seed);

function decode(value) {
  if (value.type === 'null') return null;
  if (value.type === 'integer') return Number(value.value);
  if (value.type === 'blob') return Buffer.from(value.base64, 'base64');
  return value.value;
}

function encode(value) {
  if (value === null) return { type: 'null' };
  if (typeof value === 'bigint' || Number.isInteger(value))
    return { type: 'integer', value: String(value) };
  if (typeof value === 'number') return { type: 'float', value };
  if (value instanceof Uint8Array)
    return { type: 'blob', base64: Buffer.from(value).toString('base64') };
  return { type: 'text', value };
}

function sqlOf(statement) {
  const sql = statement.sql ?? stored.get(statement.sql_id);
  if (typeof sql !== 'string') throw new Error('Fixture received missing SQL');
  trace.push(sql);
  if (workerData?.rejectUserVersion && /\buser_version\b/i.test(sql))
    throw new Error('Fixture server policy rejects user_version');
  return sql;
}

const columns = (statement) => statement.columns().map((column) => ({
  name: column.name,
  decltype: column.type,
}));

function execute(input) {
  const statement = db.prepare(sqlOf(input));
  const cols = columns(statement);
  const params = input.named_args?.length
    ? [Object.fromEntries(input.named_args.map(({ name, value }) => [name, decode(value)]))]
    : (input.args ?? []).map(decode);
  let rows = [], changes = 0, lastInsertRowid = null;
  if (cols.length) {
    statement.setReturnArrays(true);
    rows = statement.all(...params).map((row) => row.map(encode));
  } else {
    const result = statement.run(...params);
    changes = Number(result.changes);
    lastInsertRowid = String(result.lastInsertRowid);
  }
  return {
    cols, rows: input.want_rows === false ? [] : rows,
    affected_row_count: changes, last_insert_rowid: lastInsertRowid,
    rows_read: rows.length, rows_written: changes, query_duration_ms: 0,
  };
}

const errorInfo = (error) => ({ code: error.code || 'SQLITE_ERROR', message: error.message });

function conditionMet(condition, results, errors) {
  if (!condition) return true;
  if (condition.type === 'ok') return results[condition.step] !== null;
  if (condition.type === 'error') return errors[condition.step] !== null;
  if (condition.type === 'not') return !conditionMet(condition.cond, results, errors);
  if (condition.type === 'and') return condition.conds.every((c) => conditionMet(c, results, errors));
  if (condition.type === 'or') return condition.conds.some((c) => conditionMet(c, results, errors));
  if (condition.type === 'is_autocommit') return !db.isTransaction;
  throw new Error(`Unsupported fixture condition: ${condition.type}`);
}

function batch(input) {
  const step_results = [], step_errors = [];
  for (const { stmt, condition } of input.steps) {
    let result = null, error = null;
    if (conditionMet(condition, step_results, step_errors)) {
      try { result = execute(stmt); }
      catch (caught) { error = errorInfo(caught); }
    }
    step_results.push(result);
    step_errors.push(error);
  }
  return { step_results, step_errors };
}

function pipeline(request) {
  switch (request.type) {
    case 'describe': {
      const sql = sqlOf(request);
      const statement = db.prepare(sql);
      return { type: 'describe', result: {
        params: [], cols: columns(statement), is_explain: false,
        is_readonly: /^\s*(SELECT|PRAGMA\s+\w+\s*;?\s*$)/i.test(sql),
      } };
    }
    case 'execute': return { type: 'execute', result: execute(request.stmt) };
    case 'batch': return { type: 'batch', result: batch(request.batch) };
    case 'sequence': db.exec(sqlOf(request)); return { type: 'sequence' };
    case 'get_autocommit': return { type: 'get_autocommit', is_autocommit: !db.isTransaction };
    case 'close':
      // Closing a real Hrana stream rolls back its open transaction. Enable this
      // in transaction tests to catch native statements reused across scopes.
      if (workerData?.strictTransactions && db.isTransaction) db.exec('ROLLBACK');
      return { type: 'close' };
    case 'store_sql': stored.set(request.sql_id, request.sql); return { type: 'store_sql' };
    case 'close_sql': stored.delete(request.sql_id); return { type: 'close_sql' };
    default: throw new Error(`Unsupported fixture request: ${request.type}`);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    requests.push({ path: request.url, types: input.requests?.map((item) => item.type) || ['cursor'] });
    if (/\/v[23]\/cursor$/.test(request.url)) {
      const result = batch(input.batch);
      const lines = [{ baton: 'fixture-stream', base_url: null }];
      result.step_results.forEach((step, index) => {
        if (result.step_errors[index]) {
          lines.push({ type: 'step_error', step: index, error: result.step_errors[index] });
        } else if (step) {
          lines.push({ type: 'step_begin', step: index, cols: step.cols });
          lines.push(...step.rows.map((row) => ({ type: 'row', row })));
          lines.push({ type: 'step_end', affected_row_count: step.affected_row_count,
            last_inserted_rowid: step.last_insert_rowid });
        }
      });
      response.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      response.end(lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
      return;
    }
    if (!/\/v[23]\/pipeline$/.test(request.url)) throw new Error('Unknown fixture endpoint');
    const results = input.requests.map((item) => {
      try { return { type: 'ok', response: pipeline(item) }; }
      catch (error) { return { type: 'error', error: errorInfo(error) }; }
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      baton: input.requests.some((item) => item.type === 'close') ? null : 'fixture-stream',
      base_url: null, results,
    }));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: errorInfo(error) }));
  }
});

parentPort.on('message', ({ id, type }) => {
  if (type === 'trace') parentPort.postMessage({ id, trace: [...trace] });
  if (type === 'requests') parentPort.postMessage({ id, requests: [...requests] });
});
server.listen(0, '127.0.0.1', () => {
  parentPort.postMessage({ url: `http://127.0.0.1:${server.address().port}` });
});
