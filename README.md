# OverByte

OverByte is a persistent, multi-business inventory and surplus application. The existing interface now uses a Node.js API and a database: local SQLite when running on your computer, or a hosted libSQL database on Vercel. It does not preload demo businesses or accept arbitrary login credentials.

## Run

1. Use Node.js 24.
2. Run `npm ci` in this directory to install the pinned dependencies.
3. Double-click `start.cmd`, or run `npm start` from this directory.
4. Open http://localhost:3000 and create your business account.

Keep the server running while using the app. The default server accepts local connections only. Each account owns a separate business. Use a second browser profile or sign out and create another account to test buyer and seller workflows. Multiple tabs in one browser share a login session.

The database is `data/overbyte.sqlite`; restarting the server or closing the browser does not erase accounts or inventory. Back up this file while the server is stopped. Do not replace it with the separate `data/ui-verification.sqlite` used during development checks. No sample users are added to the main database.

## Working features

- Signup, password-checked login, business onboarding, logout and expiring sessions.
- Per-business inventory batches, cost, expiry, supplier, storage, optional reference price and daily demand.
- Stock receipts, recorded use, corrections and disposal, with a transaction history in the database.
- Inventory-page sale registration, earliest-expiry deductions across batches, and persisted sales history.
- Surplus, expiry and shortage alerts; dismissal, preferences, notifications and saved purchase alerts.
- Approved listing creation, editable price, minimum quantity, pickup instructions, cancellation and shared marketplace discovery.
- Explained matching using product need, quantity, actual recorded purchase cost, shelf life and coordinates where provided.
- Order reservations, retry-safe order creation, cancellation, seller-confirmed handover, inventory transfer and completion.
- Actual transaction analytics, sales value, purchasing savings, weight transferred and recorded waste.
- Profile settings and device registration with persisted measured readings.

## How intelligence works

Forecasts are deterministic estimates using your data, not a trained machine-learning model. Clicking an Inventory item opens **Register Sale**. A sale deducts from the earliest-expiring usable batches of the same product and unit, never from another business, expired stock, or marketplace reservations. Deductions and sales history commit together; retrying the same request cannot record it twice. Use **View batch details** to keep accessing the existing item detail screen.

Once a product has registered sales, its forecast uses a seven-day weighted daily sales average: today has weight 7, yesterday 6, through weight 1 six days ago. Include zero-sale days since inventory tracking began, capped at seven UTC calendar days. Today's count is sales recorded so far, not an extrapolated full day. The weighted sum is divided by the sum of included weights. Expected sales before expiry equal this average times days remaining, allocated across batches earliest-expiry first so demand is not counted twice. Any positive uncommitted surplus is marked **Surplus Risk** and suggested for review, even below the old risk-score threshold. No marketplace listing is published automatically. Existing alert/notification preferences still apply.

Sales take precedence over manually entered demand. Before the first registered sale, existing planned-demand or recorded-consumption estimates remain the fallback; without those, the app asks for sales/demand data instead of inventing a sales rate. A product with older sales but none in the recent window correctly has a zero recent sales rate. Marketplace liquidation orders and stock disposal are not counted as normal customer sales. Predictions refresh after sale registration, inventory addition, stock changes, and ordinary refreshes. The Inventory sales history shows the latest 100 registrations; all records remain in the database.

Available stock subtracts quantities committed to open listings and pending seller orders. Demand is allocated across batches in expiry order. Projected surplus is available stock minus expected use before expiry. The risk score is the estimated unsold share of available stock, not a statistical probability. Shortage compares expected daily demand with unreserved stock plus confirmed incoming orders; pickup timing must still be checked by the business. Matching scores describe compatibility of available inputs, not prediction accuracy. Coordinates are optional and distance is straight-line distance.

The continuously running local server checks inventory every minute. It also recalculates on requests and saved changes. The browser refreshes from the server every 15 seconds while open, preserving active forms. Vercel background scheduling is described below; it does not run the local minute timer. Notifications are in-app; no fake marketplace events are generated. Publishing always requires the seller's confirmation.

An order reserves a listing immediately. Physical inventory transfers only when the seller confirms pickup. A purchase does not increase physical stock before handover. Existing orders remain valid if a seller cancels the unsold remainder of a listing. Expired stock cannot be ordered or handed over.

## API and modules

`server.mjs`: HTTP routes, session cookies, same-origin checks, request limits and static-file allowlist.

`server/database.mjs`: SQLite schema and transaction wrapper.

`api/index.mjs`: Vercel serverless entrypoint using the same authorized application routes and remote database.

`scripts/build.mjs`: allowlisted static build; only the browser application and approved assets enter `public/`.

`server/service.mjs`: account authorization, inventory ledger, reservations, orders, alerts, analytics and device readings.

`server/sales-forecast.mjs`: lightweight weighted-sales calculation; no external model or dependencies. `POST /api/inventory/:id/sales` accepts `{qty, idempotencyKey}` and returns the updated workspace. The additive `inventory_sales` and `inventory_sale_allocations` tables initialize through the existing SQLite/libSQL schema on restart/cold start; existing inventory is not reset.

`src/engines.js`: pure forecast, risk, pricing and matching rules, suitable for replacing with a model-backed service later.

`src/store.js`: authenticated API client and shared UI state. No account data or passwords are saved in browser storage.

Major endpoints: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/state`, `/api/inventory`, `/api/listings`, `/api/orders`, `/api/profile`, `/api/settings`, `/api/sensors`, `/api/watches`. Mutations use JSON, require a session except signup/login, and enforce business ownership. Order creation requires an `idempotencyKey`.

`POST /api/inventory` also accepts an `idempotencyKey`. The add-inventory form retains the same key when a response is lost and the user retries, so a completed request returns the original batch rather than adding stock twice. Reusing a key with different fields returns HTTP 409. The small `inventory_create_requests` table and targeted query indexes are migrated in place; existing inventory rows are not rewritten. The client waits up to 70 seconds, beyond the configured Vercel function limit of 60 seconds, and distinguishes a slow response, a network failure, an invalid upstream response, and a server error. An uncertain result should be retried from the same form or checked by refreshing inventory before starting a new add operation.

API functions emit structured `overbyte.api_timing` logs with a request ID, route, status, total duration, database call count/time, state-render time, and mutation time. `overbyte.database_init` measures cold-start database initialization and `overbyte.slow_query` identifies individual calls over 500 ms without recording SQL parameters or credentials. The response's `X-Request-Id` matches its timing log. If latency persists after deployment, compare cold-start time and `dbMs` with total duration, then inspect slow-query entries and the Turso database region/connectivity. Local SQLite tests do not measure the deployed database's network latency.

## Verification

Run `npm test` and `npm run build`. Tests create isolated databases and cover authentication, account isolation, persistence, overselling, duplicate requests, cancellation, pickup transfer, forecasts, notifications, expiry, settings, sensors and deployment packaging. Browser checks also cover signup → inventory → alert → publish → matched purchase → pickup → analytics, plus mobile layout. These local checks do not replace the deployed smoke test below.

## Deploy to Vercel

Deployment configuration is included, but the project has not been deployed or connected to a production database by this change. Credentials and a Vercel project are still required.

1. Create a **libSQL-backed Turso database** and a database authentication token. This adapter uses libSQL, not Turso's separate new database engine. See the [official libSQL driver](https://github.com/tursodatabase/libsql-js).
2. Import this root project into Vercel. Select the directory containing this README, `vercel.json`, `api/` and `server.mjs`, **not** the separate nested `overbyte/` project. Use Framework Preset **Other** and Node.js **24.x**.
3. In Vercel Project Settings → Environment Variables, add:

   | Variable | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | Your hosted database URL, such as `libsql://your-database-your-organization.turso.io` |
   | `TURSO_AUTH_TOKEN` | A write-capable authentication token for that database |
   | `CRON_SECRET` | A long, randomly generated secret, at least 32 characters |

   Configure these for Production. Use a separate test database/token for Preview deployments so preview testing cannot alter production inventory. Never add these secrets to browser code or commit a populated `.env` file. `.env.example` contains placeholders only.
4. Deploy with the included settings: install `npm ci`, build `npm run build`, output directory `public`. The root `api/index.mjs` function serves `/api/*`; the browser continues using the same UI and hash routes. Node functions and these settings are described in [Vercel's runtime documentation](https://vercel.com/docs/functions/runtimes/node-js) and [configuration reference](https://vercel.com/docs/project-configuration/vercel-json).
5. Open the deployment's `/api/health`, then create a new account and complete the smoke test below. Check function logs if the database connection fails. HTTPS session cookies are secure automatically on Vercel.

The hosted database persists across redeployments and is shared by function instances. Tables are initialized on the first database connection. Vercel must have the hosted database credentials; it must not use an ephemeral local SQLite file. Existing local accounts and inventory are **not automatically migrated** to the hosted database. Plan a separate backup/import operation if you need to preserve existing local business data.

Only frontend files enter the static build. Local databases, credentials, archives, backend source, and the separate nested project are excluded from public output. `.vercelignore` also restricts deployment uploads. The libSQL native dependency is included explicitly in the function bundle. Keep optional npm dependencies enabled because they supply the platform-specific database binding.

### Background alerts on Vercel

Requests, saved changes, and the open app's refresh continue to recalculate inventory forecasts. The included production cron calls `/api/cron` once daily. It uses `CRON_SECRET` as a bearer credential; an unauthenticated request cannot trigger the inventory sweep. [Vercel automatically supplies this authorization header](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The daily default is compatible with Hobby scheduling limits. It is **not continuous minute-by-minute monitoring when nobody is using the app**. For frequent unattended checking, use a Vercel plan supporting a more frequent schedule or an authenticated external scheduler calling the same endpoint. Review [current cron limits and scheduling precision](https://vercel.com/docs/cron-jobs/usage-and-pricing) before changing `vercel.json`. Cron jobs run on production deployments, not preview deployments.

### Deployed smoke test

Use dedicated test accounts and inventory, not real business stock:

1. Create a seller account; verify that its inventory is empty. Add a future-expiring batch with expected daily use lower than available stock.
2. Review the generated surplus alert and publish a quantity from that batch. Verify nothing was published before approval.
3. Create a separate buyer account with a relevant shortage. Confirm the seller's listing is discoverable and the buyer cannot edit the seller's stock.
4. Purchase a quantity. Check that the listing remainder decreases, the order appears for both businesses, and physical buyer stock does not change until seller-confirmed handover.
5. Confirm pickup as seller; verify both inventory ledgers and analytics update exactly once.
6. Sign out, sign back in, and redeploy; verify that the remote database retains the accounts and orders.
7. Check Vercel Cron logs for a successful authorized sweep. Confirm a request without the bearer credential is rejected.

## External services

Payments are arranged directly at pickup; no online payment is charged. Email verification/reset delivery, trained ML, POS feeds, live hardware connections and independent business verification are not connected. Device readings can be entered through the UI or the authenticated readings endpoint. The reference price is user-entered, not a live market feed.

For self-hosting instead of Vercel, run the Node server behind HTTPS with a persistent database volume, set `COOKIE_SECURE=true`, and configure `HOST` and `PORT` for your environment. A static-only upload or a `file://` URL cannot provide the backend. Integrations requiring provider credentials need to be connected separately.

Local environment variables: `PORT` (default 3000), `HOST` (default 127.0.0.1), `OVERBYTE_DB` (optional local database path), `COOKIE_SECURE` (true for HTTPS). To run locally against hosted storage, provide the Turso variables above in the process environment, or use `node --env-file=.env server.mjs` with your own uncommitted `.env`. Never point development tests at a production database.
