import http from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./server/database.mjs";
import { Service, HttpError } from "./server/service.mjs";
const root = dirname(fileURLToPath(import.meta.url));
const cookieToken = (req) =>
  (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("overbyte_session="))
    ?.slice(17);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
export function createApp({
  dbPath = resolve(root, "data/overbyte.sqlite"),
  secureCookies = process.env.COOKIE_SECURE === "true" ||
    process.env.VERCEL === "1",
  database,
  monitorEnabled = process.env.VERCEL !== "1",
  cronSecret = process.env.CRON_SECRET,
} = {}) {
  const db = database || openDatabase(dbPath),
    service = new Service(db);
  const cookie = (token, remove = false) =>
    `overbyte_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${remove ? 0 : 604800}${secureCookies ? "; Secure" : ""}`;
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const handler = async (req, res) => {
    const started = performance.now();
    const requestId = randomUUID();
    const timing = { requestId, dbCalls: 0, dbMs: 0, stateMs: 0, mutationMs: 0 };
    let apiPath = "";
    res.setHeader("X-Request-Id", requestId);
    const stateFor = (user) => {
      const start = performance.now();
      try { return service.state(user); }
      finally { timing.stateMs += performance.now() - start; }
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const url = new URL(req.url, "http://localhost"),
        path = url.pathname;
      if (path.startsWith("/api/")) {
        apiPath = path.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, ":id");
        if (!["GET", "POST", "PATCH"].includes(req.method))
          throw new HttpError(405, "Method not allowed.");
        if (req.headers["sec-fetch-site"] === "cross-site")
          throw new HttpError(403, "Cross-site requests are not allowed.");
        let p = {};
        if (req.method !== "GET") {
          if (req.headers.origin) {
            const origin = new URL(req.headers.origin);
            if (origin.host !== req.headers.host)
              throw new HttpError(
                403,
                "Request origin does not match this server.",
              );
          }
          if (
            !String(req.headers["content-type"]).startsWith("application/json")
          )
            throw new HttpError(415, "Send JSON data.");
          let body = "";
          let suppliedBody;
          try {
            suppliedBody = req.body;
          } catch {
            throw new HttpError(400, "Invalid JSON.");
          }
          if (suppliedBody !== undefined) {
            body =
              typeof suppliedBody === "string"
                ? suppliedBody
                : JSON.stringify(suppliedBody);
          } else {
            for await (const chunk of req) {
              body += chunk;
              if (Buffer.byteLength(body) > 65536)
                throw new HttpError(413, "Request is too large.");
            }
          }
          if (Buffer.byteLength(body) > 65536)
            throw new HttpError(413, "Request is too large.");
          try {
            p = JSON.parse(body || "{}");
          } catch {
            throw new HttpError(400, "Invalid JSON.");
          }
          if (!p || typeof p !== "object" || Array.isArray(p))
            throw new HttpError(400, "Expected an object.");
        }
        // No awaits remain after body parsing; query telemetry is scoped to
        // this request even when other requests are waiting on their bodies.
        service.telemetry = timing;
        if (path === "/api/health" && req.method === "GET") {
          db.prepare("SELECT 1").get();
          return json(res, 200, { ok: true });
        }
        if (path === "/api/cron" && req.method === "GET") {
          const digest = (value) =>
            createHash("sha256")
              .update(String(value || ""))
              .digest();
          if (
            !cronSecret ||
            !timingSafeEqual(
              digest(req.headers.authorization),
              digest(`Bearer ${cronSecret}`),
            )
          )
            throw new HttpError(401, "Unauthorized.");
          let checked = 0;
          for (const b of service.all("SELECT id FROM businesses")) {
            service.reconcile(b.id);
            checked++;
          }
          return json(res, 200, {
            ok: true,
            businessesChecked: checked,
            checkedAt: new Date().toISOString(),
          });
        }
        const token = cookieToken(req);
        let user = service.session(token);
        if (path === "/api/state" && req.method === "GET")
          return json(res, 200, stateFor(user));
        if (
          ["/api/auth/signup", "/api/auth/login"].includes(path) &&
          req.method === "POST"
        ) {
          const ip =
            process.env.VERCEL === "1"
              ? String(
                  req.headers["x-forwarded-for"] ||
                    req.socket?.remoteAddress ||
                    "unknown",
                )
                  .split(",")[0]
                  .trim()
              : req.socket?.remoteAddress || "unknown";
          service.authAttempt([
            `ip:${ip}`,
            `email:${String(p.email || "")
              .trim()
              .toLowerCase()
              .slice(0, 254)}`,
          ]);
          const auth = path.endsWith("signup")
            ? service.signup(p)
            : service.login(p);
          service.logout(token);
          res.setHeader("Set-Cookie", cookie(auth.token));
          return json(res, 200, {
            result: { id: auth.user.id },
            state: stateFor(auth.user),
          });
        }
        if (path === "/api/auth/logout" && req.method === "POST") {
          service.logout(token);
          res.setHeader("Set-Cookie", cookie("", true));
          return json(res, 200, {
            result: { ok: true },
            state: { authed: false },
          });
        }
        if (!user) throw new HttpError(401, "Please sign in to continue.");
        if (req.method === "GET")
          throw new HttpError(404, "Endpoint not found.");
        const b = user.business_id;
        let result, m;
        const mutationStarted = performance.now();
        if (path === "/api/inventory" && req.method === "POST")
          result = service.addInventory(b, p);
        else if (
          (m = path.match(/^\/api\/inventory\/([\w-]+)\/sales$/)) &&
          req.method === "POST"
        )
          result = service.registerSale(b, m[1], p);
        else if (
          (m = path.match(/^\/api\/inventory\/([\w-]+)$/)) &&
          req.method === "PATCH"
        )
          result = service.updateInventory(b, m[1], p);
        else if (
          (m = path.match(/^\/api\/inventory\/([\w-]+)\/(adjust|consume)$/)) &&
          req.method === "POST"
        )
          result = service.adjust(b, m[1], p, m[2] === "consume");
        else if (path === "/api/listings" && req.method === "POST")
          result = service.createListing(b, p);
        else if (
          (m = path.match(/^\/api\/listings\/([\w-]+)\/cancel$/)) &&
          req.method === "POST"
        )
          result = service.cancelListing(b, m[1]);
        else if (path === "/api/orders" && req.method === "POST")
          result = service.createOrder(b, p);
        else if (
          (m = path.match(/^\/api\/orders\/([\w-]+)\/(advance|cancel)$/)) &&
          req.method === "POST"
        )
          result =
            m[2] === "advance"
              ? service.advanceOrder(b, m[1])
              : service.cancelOrder(b, m[1]);
        else if (path === "/api/profile" && req.method === "PATCH")
          result = service.profile(b, p);
        else if (path === "/api/settings" && req.method === "PATCH")
          result = service.updateSettings(b, p);
        else if (path === "/api/onboarding" && req.method === "POST") {
          result = service.profile(b, p);
          service.run("UPDATE businesses SET onboarded=1 WHERE id=?", b);
        } else if (
          (m = path.match(/^\/api\/alerts\/([\w-]+)\/dismiss$/)) &&
          req.method === "POST"
        )
          result = service.dismiss(b, m[1]);
        else if (
          path === "/api/notifications/read-all" &&
          req.method === "POST"
        ) {
          service.run(
            "UPDATE notifications SET is_read=1 WHERE business_id=?",
            b,
          );
          result = { ok: true };
        } else if (
          (m = path.match(/^\/api\/notifications\/([\w-]+)\/read$/)) &&
          req.method === "POST"
        ) {
          service.owned("notifications", m[1], b);
          service.run(
            "UPDATE notifications SET is_read=1 WHERE id=? AND business_id=?",
            m[1],
            b,
          );
          result = { ok: true };
        } else if (path === "/api/sensors" && req.method === "POST")
          result = service.addSensor(b, p);
        else if (
          (m = path.match(/^\/api\/sensors\/([\w-]+)\/readings$/)) &&
          req.method === "POST"
        )
          result = service.reading(b, m[1], p);
        else if (path === "/api/watches" && req.method === "POST")
          result = service.watch(b, p);
        else throw new HttpError(404, "Endpoint not found.");
        timing.mutationMs = performance.now() - mutationStarted;
        return json(res, 200, { result, state: stateFor(user) });
      }
      if (!["GET", "HEAD"].includes(req.method))
        throw new HttpError(405, "Method not allowed.");
      const requested = decodeURIComponent(path === "/" ? "/index.html" : path);
      if (
        !/^\/(index\.html|src\/[\w/.-]+\.js|styles\/[\w/.-]+\.css|assets\/[\w/ .-]+)$/.test(
          requested,
        )
      )
        throw new HttpError(404, "File not found.");
      const target = resolve(root, "." + requested);
      if (!target.startsWith(root + sep))
        throw new HttpError(403, "Invalid path.");
      const actual = await realpath(target);
      if (actual !== target || !(await stat(actual)).isFile())
        throw new HttpError(404, "File not found.");
      res.writeHead(200, {
        "Content-Type": mime[extname(actual)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : await readFile(actual));
    } catch (e) {
      if (e.status === undefined && e.code !== "ENOENT")
        console.error(JSON.stringify({ event: "overbyte.api_error", requestId, code: e.code || e.name || "Error" }));
      if (!res.headersSent) {
        const storageError = /^(SQLITE|LIBSQL|HRANA|ETIMEDOUT|ECONN)/i.test(String(e.code || ""));
        json(res, e.status || (e.code === "ENOENT" ? 404 : storageError ? 503 : 500), {
          error: e.status
            ? e.message
            : e.code === "ENOENT"
              ? "File not found."
              : storageError
                ? `The database is temporarily unavailable. This change may already have been saved; refresh or retry the same request. Reference ${requestId}.`
                : `The server could not complete this request. Reference ${requestId}.`,
        });
      }
      else res.end();
    } finally {
      if (apiPath) console.info(JSON.stringify({
        event: "overbyte.api_timing", requestId, method: req.method,
        path: apiPath, status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
        dbCalls: timing.dbCalls, dbMs: Math.round(timing.dbMs),
        stateMs: Math.round(timing.stateMs), mutationMs: Math.round(timing.mutationMs),
      }));
      if (service.telemetry === timing) service.telemetry = null;
    }
  };
  const server = http.createServer(handler);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const monitor = monitorEnabled
    ? setInterval(() => {
        try {
          for (const b of service.all("SELECT id FROM businesses"))
            service.reconcile(b.id);
        } catch (e) {
          console.error("Inventory monitor:", e.message);
        }
      }, 60000)
    : null;
  monitor?.unref();
  return {
    server,
    handler,
    db,
    service,
    close: () =>
      new Promise((resolveClose) => {
        clearInterval(monitor);
        server.close(() => {
          db.close();
          resolveClose();
        });
        server.closeIdleConnections();
      }),
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp({
    dbPath: process.env.OVERBYTE_DB
      ? resolve(process.env.OVERBYTE_DB)
      : undefined,
  });
  const port = Number(process.env.PORT) || 3000,
    host = process.env.HOST || "127.0.0.1";
  app.server.listen(port, host, () =>
    console.log(`OverByte running at http://${host}:${port}`),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => app.close().then(() => process.exit(0)));
}
