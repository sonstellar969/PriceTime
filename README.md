# PriceTime — Crypto Paper Exchange

PriceTime is a multi-crypto paper-trading web app and data-structures project. It has user authentication, persistent demo accounts in Neon Postgres, a custom price-time matching engine, live TradingView crypto charts, and an order replay benchmark. Charts display external USDT market data; all PriceTime orders and INR balances are simulated, with no real crypto transactions.

The chart widget uses exchange-qualified crypto symbols such as `BINANCE:DOGEUSDT`. The earlier NSE-style equity symbols are intentionally not used: they are not available through this widget's data source in this setup. TradingView's embed is a chart widget, not a general market-data REST API; its free chart data and real-time status depend on the selected exchange and TradingView entitlements.

**Live site:** https://sonstellar969.github.io/PriceTime/

**Repository:** https://github.com/sonstellar969/PriceTime
**Neon API:** `https://br-nameless-forest-ao724sdq-api.compute.c-2.ap-southeast-1.aws.neon.tech/`

## What is implemented

- Responsive React + TypeScript web app with Trade, Portfolio, Reports, and Replay views.
- Neon Managed Auth email/password sign-up, sign-in, session restore, and sign-out.
- First login provisions a ₹100,000 demo wallet and 10 demo units per supported crypto.
- PostgreSQL persistence for profiles, demo wallets, reserved money/units, positions, FIFO lots, orders, executions, order events, realized P/L, and replay runs.
- A deployed Neon Function API that authenticates Managed Auth JWTs, queries the pooled Postgres URL, and serializes order writes with a Postgres transaction lock.
- Crypto order books: `DOGE`, `XRP`, `ADA`, `TRX`, and `AVAX`.
- Limit and market orders, price priority, FIFO time priority, partial fills, self-trade prevention, cancellation, integer-paise accounting, and cash/unit reservations.
- Best bid/ask, spread, top-five levels, execution tape, and 20-trade circular moving average.
- FIFO realized P/L and current holding cost basis; unrealized P/L uses the latest simulated fill.
- Search and five implemented report sorts: bubble, selection, insertion, merge, and quick sort.
- CSV replay up to 10,000 orders. Compares the BST/DLL engine with an array book and records run metrics.
- TradingView Advanced Chart widget for Binance spot pairs `DOGEUSDT`, `XRPUSDT`, `ADAUSDT`, `TRXUSDT`, and `AVAXUSDT`. Charts show live/public USDT-market data; the paper order book remains separate and INR-denominated.
- GitHub Actions workflow builds and publishes the static frontend to GitHub Pages.
- Neon schema/migrations as code, with Neon project configuration in `neon.ts`.

## Data structures

| Project requirement | Implemented structure | Role |
|---|---|---|
| Bid and ask price levels | Two ordinary BSTs per symbol | Find the best sell (minimum) and best buy (maximum); delete an empty level. |
| FIFO orders per price | Doubly linked list at each level | Preserve time priority and unlink cancelled orders in O(1) after ID lookup. |
| Locate order ID | Sorted append-only ID array with binary search | IDs increase in order, so an ordinary ID BST would skew. |
| Trade tape | Singly linked list | Append executions in match order. |
| Recent execution average | Circular buffer of 20 paise prices | Overwrite the oldest value and recompute a moving average. |
| Cost basis | FIFO lot records in Postgres, consumed FIFO | Calculate realized profit/loss as crypto units are sold. |
| Trader search | Linear scan/filter of the trader’s trade report | A direct scan of the selected report history. |
| Sort reports | Bubble, selection, insertion, merge, quick | Run on copied trade rows and show elapsed time. |
| Replay comparison | Custom engine versus array scan | Compare identical CSV input and trade count. |

The matching algorithm remains in `apps/api/src/engine/orderBook.ts`. Postgres stores durable state; the API reconstructs the in-memory BST and DLL from the append-only order event history before applying new writes. This keeps the DS implementation responsible for selecting fills and surviving Function restarts. Order updates, balance settlement, FIFO lots, and trade records are committed together.

## How trading works

1. Neon Auth issues a signed session token. The frontend sends a short-lived bearer token to the Neon Function.
2. The API verifies that JWT against the branch JWKS and derives the trader identity from the token.
3. A Postgres transaction takes an advisory lock, loads the symbol’s order-event stream, and replays it into the custom order book.
4. The API checks available demo cash/units and reserves what the order needs.
5. The BST chooses the best opposite price; the price’s DLL supplies the earliest order. It records one trade per match, including partial fills.
6. The same database transaction settles cash, reserved units, FIFO lots, order statuses, trade rows, and the event log.
7. The web app refreshes account and order-book state every three seconds. TradingView provides the separate public market chart.

Money uses integer paise in the engine and database: ₹101.00 is `10100`. No floating-point prices are used for order matching or settlement.

## Market charts and data

The charts use TradingView’s embeddable Advanced Chart widget, which supplies its own public chart data feed. This is not a general-purpose market-data API. Data availability, real-time versus delayed status, and exchange coverage depend on TradingView and exchange entitlements. The order book, fills, spread, wallet, and P/L remain PriceTime simulation data.

References: [TradingView charting libraries](https://www.tradingview.com/free-charting-libraries/) and [TradingView datafeed documentation](https://www.tradingview.com/charting-library-docs/latest/connecting_data/). The separately hosted Advanced Charts library is not used; the public widget avoids bundling a restricted library. TradingView attribution is shown in the app.

## Neon setup already completed

- Neon project: `PriceTime` (`bitter-hall-79878300`), AWS Singapore (`aws-ap-southeast-1`).
- Branch: `production` (`br-nameless-forest-ao724sdq`).
- Enabled services: Postgres, Neon Auth, and Neon Functions.
- Function slug: `api`; API URL is listed above.
- Schema migration: `apps/api/drizzle/0000_initial_schema.sql` has been applied to the production branch.
- Trusted auth origin: `https://sonstellar969.github.io`.
- The pooled and direct database URLs are stored only in the ignored root `.env.local`. Do not copy connection strings into source control or frontend variables.

## Local development

Requires Node.js 20 or newer and npm.

```bash
npm ci
npm run dev
```

This starts a local Neon Function at `http://localhost:3001` with the linked Neon branch environment, and Vite at `http://localhost:5173`. Local API calls use the Neon project configured in `.neon`; the app’s production frontend variables are injected by the Pages workflow.

Build and test:

```bash
npm run build
npm test
npm run db:generate -w @pricetime/api
npm run db:migrate -w @pricetime/api
```

Drizzle migration commands use `DATABASE_URL_UNPOOLED` for schema changes. Normal app queries use the Neon-injected pooled `DATABASE_URL`.

## Environment and secrets

- Root `.env.local`: created by Neon CLI; contains private pooled/direct DB URLs and Neon environment metadata. It is gitignored.
- Root `.env.functions`: local allowlist for app origins, gitignored.
- `apps/web/.env.local`: local Vite API/Auth URLs, gitignored. Locally the API URL points at port 3001.
- GitHub repository Actions variables (public URLs, not passwords): `VITE_API_URL` and `VITE_NEON_AUTH_URL`.
- Never expose `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, a Neon API key, or any auth signing key through a `VITE_*` variable.

## GitHub Pages deployment

`.github/workflows/pages.yml` deploys the Vite artifact from `apps/web/dist` whenever `main` changes. Vite uses the `/PriceTime/` base path in Actions, while local dev uses `/`.

Required repository variables:

```text
VITE_API_URL=https://br-nameless-forest-ao724sdq-api.compute.c-2.ap-southeast-1.aws.neon.tech
VITE_NEON_AUTH_URL=https://ep-bold-haze-ao4a44mo.neonauth.c-2.ap-southeast-1.aws.neon.tech/neondb/auth
```

API authentication and account state stay on Neon; the static site contains only public endpoint URLs.

## API

All `/api/*` routes require `Authorization: Bearer <Neon Auth JWT>`.

| Route | Purpose |
|---|---|
| `GET /health` | Prove the Function can connect to Postgres. |
| `GET /api/symbols` | Supported cryptos, display names, demo reference values. |
| `GET /api/account` | Wallet, positions, FIFO cost basis, P/L, orders, recent trades. |
| `GET /api/books/:symbol` | Reconstructed book, top-five levels, spread, average, executions. |
| `GET /api/books` | All symbol snapshots. |
| `GET /api/orders` | Current user’s order history. |
| `POST /api/orders` | Submit a limit or market order. |
| `DELETE /api/orders/:symbol/:id` | Cancel an open limit order and release reserves. |
| `GET /api/trades` | Current user’s executions for reports/search. |
| `POST /api/replay?symbol=AVAX` | Process a CSV of up to 10,000 orders. |

CSV header supported: `timestamp,trader,side,type,price,quantity` or `side,type,pricePaise,quantity`. Limit price accepts rupees with decimals or integer paise. Example without a header:

```csv
SELL,LIMIT,148100,8
SELL,LIMIT,148100,4
BUY,LIMIT,148100,9
SELL,MARKET,,2
```

## Main files

```text
apps/api/src/engine/orderBook.ts       BST, DLL queues, SLL trade history, circular prices
apps/api/src/engine/orderBook.test.ts  Deterministic match-priority test
apps/api/src/function.ts               Authenticated Neon Function API and settlement
apps/api/src/db/schema.ts              Typed Drizzle schema
apps/api/drizzle/                      Versioned SQL migrations
apps/web/src/main.tsx                  Full trading UI, auth, reports, replay
apps/web/src/lib/auth.ts               Managed Neon Auth client
apps/web/src/lib/api.ts                Authenticated API client
apps/web/src/styles.css                Responsive product styling
neon.ts                                 Neon Postgres/Auth/Function branch config
.github/workflows/pages.yml             GitHub Pages build and publish
design-system/pricetime/                Persisted UI design guidance
```

## Important limits / future improvement

- The API rebuilds a book by replaying a symbol’s full order-event history for each request. That deliberately keeps the custom structures authoritative and restart-safe for a classroom simulator; larger systems should persist snapshots/checkpoints and replay only later events.
- GitHub Pages hosts static assets only. The authenticated REST API runs as a Neon Function next to Postgres.
- External crypto charts may be delayed and depend on TradingView exchange data rights. They do not control paper fills.
- Add rate limiting/abuse controls before opening registration to a large public audience.
- For production use, configure custom auth email SMTP and verify email recovery/verification workflows.

## Scope and handoff status

The requested direction is a full web experience named **PriceTime**, backed by Neon, with demo-only trading and no real-money or exchange execution. Multiple crypto symbols are supported from day one. GitHub Pages serves the frontend; Neon Functions and Postgres provide the authenticated backend and persistence. The exchange engine is the project's data-structures core, not a replacement for a real exchange.

Implemented in this version: crypto watchlist and TradingView charts; email/password auth; demo wallet and holdings; limit/market orders; BST/DLL matching with partial fills and cancellation; account/order/trade persistence; portfolio and FIFO P/L; searchable/sortable trade reports; CSV replay benchmark; GitHub Pages workflow; Neon production API/database configuration.

Verified during this handoff: production Neon health connects to Postgres and reports the five crypto symbols; the authenticated account/book/order flow was exercised against a disposable development branch; the local React app restores a session and loads wallet, order book, maker liquidity, and recent executions; the TradingView DOGEUSDT and XRPUSDT charts render; all four engine tests and the production build pass; GitHub Actions deployed commit `2aa21ae` and the live Pages URL serves the PriceTime sign-in screen. Do not use the disposable development branch for real data.

Still pending / sensible next steps: add broader automated integration tests for cancel, market sells, partial fills, and cash/unit reservation edge cases; optionally add more coins only after checking TradingView exchange-symbol availability; configure production email verification/recovery and abuse controls before promoting the app beyond a class demo. Keep API keys and database connection strings out of frontend variables and Git history. Real exchange connectivity, deposits, and withdrawals are explicitly out of scope.

## Project purpose

Educational demonstration of BSTs, doubly linked FIFO queues, binary search, singly linked trade history, circular buffers, FIFO accounting, sorting/searching, database persistence, API authentication, and web UI integration. No deposits, withdrawals, brokerage routing, live order execution, or investment advice.
