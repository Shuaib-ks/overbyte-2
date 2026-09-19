import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
export class DatabaseInitializationError extends Error {
  constructor(stage, cause) {
    super(`Database initialization failed during ${stage}.`, { cause });
    this.name = "DatabaseInitializationError";
    this.stage = stage;
  }
}
export const schema = `
  CREATE TABLE IF NOT EXISTS businesses(id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,loc TEXT NOT NULL,owner TEXT DEFAULT '',contact TEXT DEFAULT '',pickup TEXT DEFAULT '',lat REAL,lng REAL,onboarded INTEGER DEFAULT 0,settings TEXT DEFAULT '{}',created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),email TEXT UNIQUE NOT NULL COLLATE NOCASE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS inventory(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),product TEXT NOT NULL,category TEXT NOT NULL,unit TEXT NOT NULL,qty REAL NOT NULL CHECK(qty>=0),cost REAL NOT NULL CHECK(cost>=0),market REAL,expires_at TEXT NOT NULL,daily_demand REAL,storage TEXT NOT NULL,supplier TEXT DEFAULT '',batch TEXT DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS inventory_transactions(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),inventory_id TEXT NOT NULL REFERENCES inventory(id),kind TEXT NOT NULL,qty REAL NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS listings(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),inventory_id TEXT NOT NULL REFERENCES inventory(id),qty REAL NOT NULL CHECK(qty>0),remaining REAL NOT NULL CHECK(remaining>=0),price REAL NOT NULL CHECK(price>0),min_order REAL NOT NULL CHECK(min_order>0),expires_at TEXT NOT NULL,pickup TEXT NOT NULL,notes TEXT DEFAULT '',condition TEXT NOT NULL,storage TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),buyer_id TEXT NOT NULL REFERENCES businesses(id),seller_id TEXT NOT NULL REFERENCES businesses(id),qty REAL NOT NULL CHECK(qty>0),price REAL NOT NULL,total_paise INTEGER NOT NULL,reference_price REAL,status TEXT NOT NULL,pickup TEXT NOT NULL,payment_status TEXT DEFAULT 'Due at pickup',idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL,picked_at TEXT,completed_at TEXT,UNIQUE(buyer_id,idempotency_key));
  CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),kind TEXT NOT NULL,priority TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,link TEXT,event_key TEXT,is_read INTEGER DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(business_id,event_key));
  CREATE TABLE IF NOT EXISTS alert_dismissals(business_id TEXT NOT NULL REFERENCES businesses(id),alert_id TEXT NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(business_id,alert_id));
  CREATE TABLE IF NOT EXISTS sensors(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),name TEXT NOT NULL,type TEXT NOT NULL,unit TEXT NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sensor_readings(id TEXT PRIMARY KEY,sensor_id TEXT NOT NULL REFERENCES sensors(id),value REAL NOT NULL,created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS watches(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),product TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(business_id,product));
  CREATE TABLE IF NOT EXISTS daily_snapshots(business_id TEXT NOT NULL REFERENCES businesses(id),day TEXT NOT NULL,inventory_value REAL NOT NULL,risk REAL NOT NULL,PRIMARY KEY(business_id,day));
  CREATE INDEX IF NOT EXISTS inventory_business ON inventory(business_id);
  CREATE INDEX IF NOT EXISTS listing_inventory ON listings(inventory_id);
  CREATE INDEX IF NOT EXISTS orders_listing ON orders(listing_id);
  CREATE INDEX IF NOT EXISTS transactions_inventory ON inventory_transactions(inventory_id,created_at);
  CREATE INDEX IF NOT EXISTS notifications_business ON notifications(business_id,created_at);
  CREATE INDEX IF NOT EXISTS readings_sensor ON sensor_readings(sensor_id,created_at);

  CREATE TABLE IF NOT EXISTS auth_attempts(key_hash TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS auth_attempts_expiry ON auth_attempts(reset_at);
  CREATE TABLE IF NOT EXISTS inventory_sales(id TEXT PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id),product TEXT NOT NULL,unit TEXT NOT NULL,qty REAL NOT NULL CHECK(qty>0),idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(business_id,idempotency_key));
  CREATE TABLE IF NOT EXISTS inventory_sale_allocations(sale_id TEXT NOT NULL REFERENCES inventory_sales(id),inventory_id TEXT NOT NULL REFERENCES inventory(id),qty REAL NOT NULL CHECK(qty>0),PRIMARY KEY(sale_id,inventory_id));
  CREATE INDEX IF NOT EXISTS sales_product_history ON inventory_sales(business_id,lower(product),unit,created_at);
  CREATE INDEX IF NOT EXISTS sale_allocations_inventory ON inventory_sale_allocations(inventory_id);
  CREATE TABLE IF NOT EXISTS inventory_create_requests(business_id TEXT NOT NULL REFERENCES businesses(id),idempotency_key TEXT NOT NULL,inventory_id TEXT NOT NULL REFERENCES inventory(id),payload_hash TEXT NOT NULL,PRIMARY KEY(business_id,idempotency_key));
  CREATE INDEX IF NOT EXISTS inventory_transactions_business_kind_time ON inventory_transactions(business_id,kind,created_at);
  CREATE INDEX IF NOT EXISTS listings_business_status_expiry ON listings(business_id,status,expires_at);
  CREATE INDEX IF NOT EXISTS orders_buyer_status ON orders(buyer_id,status);
  CREATE INDEX IF NOT EXISTS orders_seller_status ON orders(seller_id,status);
`;

// Inspect actual schema objects rather than depending on a PRAGMA version or
// assuming a previous migration finished. Every statement is additive and safe
// to replay if another function instance initialized the same database first.
const schemaObjects = schema.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => {
  const match = /^CREATE (TABLE|INDEX) IF NOT EXISTS (\w+)/i.exec(sql);
  if (!match) throw new Error("Unrecognized OverByte schema statement.");
  return { sql, type: match[1].toLowerCase(), name: match[2] };
});

export function initializeSchema(db) {
  let existing;
  try {
    existing = new Set(db.prepare(
      "SELECT type,name FROM sqlite_master WHERE type IN ('table','index')",
    ).all().map((row) => `${row.type}:${row.name}`));
  } catch (error) {
    throw new DatabaseInitializationError("schema_inspection", error);
  }
  const missing = schemaObjects.filter((object) => !existing.has(`${object.type}:${object.name}`));
  try {
    if (missing.length) db.exec(missing.map((object) => object.sql + ";").join("\n"));
  } catch (error) {
    throw new DatabaseInitializationError("schema_migration", error);
  }
}

/** Hosted instances must use durable remote storage, never their temporary disk. */
export function databaseConfig(env = process.env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (url || authToken || env.VERCEL === "1") {
    if (!url || !authToken)
      throw new Error(
        "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to connect persistent storage.",
      );
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("TURSO_DATABASE_URL is invalid.");
    }
    if (
      !["libsql:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "TURSO_DATABASE_URL must be a secure libsql:// or https:// database URL without embedded credentials.",
      );
    }
    return { url, authToken };
  }
  return {
    driver: env.OVERBYTE_SQLITE_DRIVER === "libsql" ? "libsql" : "sqlite",
  };
}

export function openDatabase(filename = ":memory:", options = {}) {
  let db;
  let stage = "configuration";
  try {
    const config = options.config || databaseConfig(options.env);
    stage = "driver_load";
    const Database = config.url || config.driver === "libsql" ? require("libsql") : DatabaseSync;
    stage = "connection";
    if (config.url) {
      db = new Database(config.url, { authToken: config.authToken });
    } else {
      if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
      db = new Database(filename);
      stage = "local_settings";
      db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    }
    stage = "foreign_keys";
    db.exec("PRAGMA foreign_keys=ON;");
    stage = "schema_initialization";
    initializeSchema(db);
    return db;
  } catch (error) {
    // Cleanup must not replace the exception that explains the outage.
    try { db?.close(); } catch {}
    if (error instanceof DatabaseInitializationError) throw error;
    throw new DatabaseInitializationError(stage, error);
  }
}

export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    // A remote connection may already have rolled back after an interruption.
    // Preserve the original error so a failed write never appears successful.
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}
