import { createApp } from "../server.mjs";

let application;

/** Vercel reuses this instance; durable state lives in the remote database. */
export default async function handler(request, response) {
  try {
    if (!application) {
      const started = performance.now();
      try { application = createApp({ monitorEnabled: false }); }
      finally { console.info(JSON.stringify({ event: "overbyte.database_init", durationMs: Math.round(performance.now() - started) })); }
    }
    return await application.handler(request, response);
  } catch (error) {
    // Never expose connection strings, credentials, or internal SQL to clients.
    console.error("OverByte initialization failed:", error.code || error.name);
    response.writeHead(503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({
        error:
          "Persistent storage is unavailable. Check the deployment database configuration and retry.",
      }),
    );
  }
}
