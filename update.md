# PriceTime — project handoff and DS checklist

Last updated: 2026-10-20

Repository: `sonstellar969/PriceTime`

Live site: <https://sonstellar969.github.io/PriceTime/>

Main branch at this handoff: `a8c2a15` (`Update PriceTime deployment handoff status`)

This file is the continuation brief for the next coding agent (Agy CLI). **PriceTime is the project name.** The goal is a full, hosted, multi-crypto paper-trading website backed by Neon Postgres, with an exchange-style matching engine that visibly demonstrates the required data structures and algorithms. All trading is fake/demo money; there must be no real exchange execution, deposit, or withdrawal feature.

## The required course topics

| Topic | Current status | Current implementation / remaining work |
|---|---|---|
| Linear search | Implemented, needs explicit tests | Reports filters the user's trade rows by symbol and trader ID in `apps/web/src/main.tsx`. Add a named reusable linear-search function and unit tests if the course rubric expects a standalone algorithm. |
| Binary search | Implemented, needs explicit tests | `OrderBook.findOrder()` binary-searches the monotonically increasing order array to locate an ID for cancel. The sorted-array choice is intentional: inserting increasing IDs into an ordinary BST would skew it. Add direct found/not-found tests and document O(log n) lookup. |
| Singly linked list (SLL) | Implemented | Trade tape is `Trade.next` with `tradeHead`/`tradeTail` in `apps/api/src/engine/orderBook.ts`. Add a test for append order and traversal if the rubric expects visible evidence. |
| Circular linked list (CLL) | **Not implemented yet** | Recent prices currently use `new Array<number>(20)` plus a wrapping index. That is a circular buffer, **not** a circular linked list. Replace or supplement it with a real CLL whose tail points to head; test insertion, wraparound/overwrite, traversal, and moving-average correctness. |
| Doubly linked list (DLL) | Implemented and tested | Orders at each price level use `Order.prev`/`Order.next`; cancel unlinks a middle node in O(1) after order lookup. Covered by the DLL cancellation test. |
| Queue using linked lists | Implemented in the engine; make the coursework framing clearer | Each `PriceLevel` is a FIFO queue backed by the DLL (`enqueue`, `unlink`, head/tail). This is the time-priority order queue. There is not yet a separate generic `Queue<T>` class; add one only if the rubric requires a standalone linked-queue demo. |
| Stack using linked lists | **Not implemented yet** | Add an explicit linked-node `Stack<T>` with `push`, `pop`, `peek`, and `isEmpty`, plus empty/single/multiple-node tests. Do not claim FIFO lots are a stack: the existing accounting implementation is FIFO. |
| Binary search tree (BST) | Implemented and tested | Separate unbalanced BSTs hold bid and ask price levels. Best ask is minimum; best bid is maximum. BST deletion handles leaf/one-child/two-child cases; two-child deletion has a test. Add broader randomized/invariant tests and note that an ordinary unbalanced BST has O(n) worst-case behavior. |
| Bubble sort | Implemented in Reports; add tests | Sorts copied trade rows by selected time/price/quantity field. |
| Selection sort | Implemented in Reports; add tests | Same report sort UI. |
| Insertion sort | Implemented in Reports; add tests | Same report sort UI. |
| Merge sort | Implemented in Reports; add tests | Same report sort UI. |
| Quick sort | Implemented in Reports; add tests | Same report sort UI. |

The sorting implementations currently live in the UI component rather than a tested algorithms module. A good next step is to move all five into `apps/web/src/algorithms/sorts.ts` (or a shared package), preserve the UI selection/elapsed-time display, and test ordering, duplicates, empty arrays, and singleton arrays. Do not use native `.sort()` inside the implementations being demonstrated.

## Implemented app functionality

- React + TypeScript responsive site with Trade, Portfolio, Reports, and Replay views.
- Neon Managed Auth sign-up/sign-in/session restoration/sign-out. API calls use the JWT on the session returned by `authClient.getSession()`.
- Neon Postgres persistence for users, demo cash, crypto units, reserved balances, orders, order events, executions, FIFO lots/P&L, and replay runs. Engine state is rebuilt from order events when the API needs to match.
- Neon Function API for authenticated account, book, order, cancellation, trade, and replay operations.
- Supported demo symbols: DOGE, XRP, ADA, TRX, AVAX. Price-time matching supports limit/market orders, price priority, FIFO priority, partial fills, cancellation, and integer-paise accounting.
- Top-five order-book levels, bid/ask spread, trade tape, recent-trade moving average (currently using the array circular buffer noted above), cash/units validation, portfolio, and FIFO realized P/L.
- Trade search and all five requested report sorts (tests still needed).
- CSV replay up to 10,000 orders, comparing BST/DLL matching with a plain-array baseline and recording the result.
- TradingView Advanced Chart embed configured for Binance crypto pairs `BINANCE:<SYMBOL>USDT`. The chart is public market display; the PriceTime INR book and fills are simulation data, not pegged to live crypto prices. DOGEUSDT and XRPUSDT were verified rendering; verify ADA, TRX, and AVAX in the hosted app too.
- GitHub Pages hosting and Neon production API/Postgres/Auth configuration.

The TradingView embed is a chart widget, not a general-purpose market-data REST API. Use exchange-qualified symbols and check availability for each coin. The earlier NSE/stock symbols produced a TradingView availability error in this setup; crypto pairs were selected to resolve that mismatch. Never describe demo book prices as live prices.

## Verified state at handoff

- `npm test`: 4 engine tests pass (price/time priority with partial fill; DLL middle cancellation; two-child BST deletion; 20-price moving average).
- `npm run build`: API TypeScript build and frontend production build pass.
- `npx --yes neon@latest deploy --branch production --env .env.functions`: deployed updated PriceTime API. Production `/health` returned `status: ok`, database `neondb`, and symbols DOGE/XRP/ADA/TRX/AVAX.
- GitHub Pages workflow run `39366143002` completed successfully; live URL serves the PriceTime sign-in page.
- Authenticated account/book/order behavior was exercised against a disposable Neon development branch and the local browser app loaded wallet, book, maker liquidity, and executions. **Production signup/order flow was not exercised with a new production account**; don't create test accounts or transact against production just to repeat that check.
- GitHub repo description now describes PriceTime as a multi-crypto paper-trading exchange with demo funds only.

## Explicitly unfinished / next work

1. Implement and test the **linked circular list**, then switch the recent-price moving average to use it (or clearly demonstrate both CLL and ring-buffer variants).
2. Implement and test a **linked-list Stack<T>**. Keep the existing DLL FIFO queue as the order queue; add a generic queue class only if required to make the topic demonstrable on its own.
3. Extract and test the five sorts, plus reusable linear and binary search functions. Keep report behavior intact.
4. Add matching-engine edge tests: market order with no liquidity/partial liquidity, market sell, insufficient cash/units, cancellation reserve release, same-trader self-cross rejection, FIFO lots and realized P/L, and multi-price matching.
5. Smoke-test all five TradingView chart symbols and auth/order flow using a safe disposable branch/account, never with real money.
6. Review replay result equivalence and benchmark methodology; it currently compares trade counts, and should also compare full trade sequences/prices/quantities before presenting it as equivalent.
7. Keep README.md synchronized with the above changes. It is the general project overview; this `update.md` is the detailed DS checklist/handoff.

## Suggested implementation order for the next agent

1. Read `README.md`, this file, and `apps/api/src/engine/orderBook.ts`; run `npm test && npm run build` to establish baseline.
2. Add explicit CLL and linked Stack<T> implementations with focused unit tests. Decide whether to extract the existing DLL queue into a named reusable class without changing its FIFO pointer semantics.
3. Extract search/sort implementations into testable modules and test all required algorithms.
4. Add API/engine edge-case tests on an isolated Neon branch; avoid schema changes to production unless required and migration-reviewed.
5. Run tests/build; update this file and README with truthful status; deploy only after verifying environment/branch and never expose secrets.

## Interruption / working-tree note

Per the user's report, the previous assistant turn was stopped while the assistant was editing a file (the README handoff update). The saved PriceTime changes are present in commits `2aa21ae` and `a8c2a15`; inspection found no partially written tracked file. This `update.md` is the new detailed handoff requested after that interruption. There is also an empty, untracked root `.gitkeep` in the current worktree; it was left untouched and is not part of this handoff.

## Guardrails

- Product name: **PriceTime**, never MarketForge.
- Multi-crypto paper trading; all accounts use demo balances only.
- No exchange execution, real-money handling, deposits, withdrawals, or investment advice.
- Never commit Neon pooled/direct connection strings, passwords, JWTs, or auth signing secrets. Only the public frontend API/Auth URLs belong in Pages build variables.
- The production Neon branch is `production`; use an expiring development branch for integration tests.
