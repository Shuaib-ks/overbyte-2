import { createApp } from "../server.mjs";
import { randomUUID } from "node:crypto";
import { describeError } from "../server/diagnostics.mjs";

/** Vercel reuses successful instances. A failed startup is retried next request. */
export function createServerlessHandler(createApplication = createApp, logger = console) {
  let application;
  return async function handler(request, response) {
    if (!application) {
      const started = performance.now();
      const requestId = randomUUID();
      try {
        application = createApplication({ monitorEnabled: false });
      } catch (error) {
        logger.error(JSON.stringify({
          event: "overbyte.initialization_error", requestId,
          error: describeError(error),
        }));
        response.writeHead(503, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
          "Retry-After": "5",
        });
        const message = error.stage === "configuration"
          ? "The server's database connection is not configured correctly. Please contact the administrator."
          : "Persistent storage could not start. Please retry; if this continues, contact the administrator.";
        response.end(JSON.stringify({
          error: `${message} Reference ${requestId}.`,
          code: "DATABASE_INITIALIZATION_FAILED",
          requestId,
        }));
        return;
      } finally {
        logger.info(JSON.stringify({
          event: "overbyte.database_init", requestId, ok: Boolean(application),
          durationMs: Math.round(performance.now() - started),
        }));
      }
    }
    return await application.handler(request, response);
  };
}

export default createServerlessHandler();
