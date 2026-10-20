# PriceTime — project handoff and DS checklist

Last updated: 2026-10-20

Repository: `sonstellar969/PriceTime`

Live site: <https://sonstellar969.github.io/PriceTime/>

This file tracks the data structures and algorithms implementation and verification status for PriceTime. **PriceTime is the project name.** The goal is a full, hosted, multi-crypto paper-trading website backed by Neon Postgres, with an exchange-style matching engine that visibly demonstrates all required data structures and algorithms. All trading is fake/demo money; there is no real exchange execution, deposit, or withdrawal feature.

## The required course topics

| Topic | Current status | Implementation & test coverage |
|---|---|---|
| Linear search | **Implemented & tested** | `linearSearch` and `linearSearchFirst` in `apps/web/src/algorithms/search.ts` and `apps/api/src/engine/algorithms.ts`. Filters user trade rows in Reports in `apps/web/src/main.tsx`. Tested across empty, non-matching, single-match, and multi-match cases in `algorithms.test.ts`. |
| Binary search | **Implemented & tested** | `binarySearch` in `apps/web/src/algorithms/search.ts` and `apps/api/src/engine/algorithms.ts`. Used by `OrderBook.findOrder()` to locate orders by monotonic ID in O(log n) time. Tested for first, middle, last, below-min, above-max, and gap lookups in `algorithms.test.ts` and `edgeCases.test.ts`. |
| Singly linked list (SLL) | **Implemented & tested** | Trade tape is `Trade.next` with `tradeHead`/`tradeTail` in `apps/api/src/engine/orderBook.ts`. Also used in `StackNode<T>` for the engine action audit stack. Tested in `orderBook.test.ts` and `edgeCases.test.ts`. |
| Circular linked list (CLL) | **Implemented & tested** | `CircularLinkedList<T>` in `apps/api/src/engine/dataStructures.ts` where `tail.next === head` at all times. Powers the 20-execution price moving average in `OrderBook`. Tested for single-element cycle, multi-element cycle, wraparound overwrite, moving-average computation, and pointer invariance in `dataStructures.test.ts` and `edgeCases.test.ts`. |
| Doubly linked list (DLL) | **Implemented & tested** | Orders at each price level use `Order.prev`/`Order.next`; cancel unlinks a middle node in O(1) after order lookup. Also provided as generic `DoublyLinkedQueue<T>`. Covered by DLL cancellation test and `dataStructures.test.ts`. |
| Queue using linked lists | **Implemented & tested** | Each `PriceLevel` is a FIFO queue backed by the DLL (`enqueue`, `unlink`, head/tail) preserving time priority. Also implemented as generic `DoublyLinkedQueue<T>` in `dataStructures.ts` with enqueue, dequeue, peek, and O(1) arbitrary node unlinking. Tested in `dataStructures.test.ts`. |
| Stack using linked lists | **Implemented & tested** | Explicit linked-node `Stack<T>` in `apps/api/src/engine/dataStructures.ts` with `push`, `pop`, `peek`, `isEmpty`, `size`, `toArray`, and `clear`. Integrated into `OrderBook` as `actionStack` to record order submissions and cancellations in LIFO order for audit history. Tested in `dataStructures.test.ts` and `edgeCases.test.ts`. |
| Binary search tree (BST) | **Implemented & tested** | Separate unbalanced BSTs (`PriceTree`) hold bid and ask price levels. Best ask is minimum; best bid is maximum. Handles leaf, single-child, and two-child level deletion. Tested in `orderBook.test.ts` and `edgeCases.test.ts`. |
| Bubble sort | **Implemented & tested** | Pure implementation in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts` with early-exit optimization. Used in Reports UI. Tested on empty, singleton, duplicate, reverse, random, and trade records in `algorithms.test.ts`. |
| Selection sort | **Implemented & tested** | Pure in-place implementation in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts`. Used in Reports UI. Tested across all test fixtures in `algorithms.test.ts`. |
| Insertion sort | **Implemented & tested** | Pure in-place implementation in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts`. Used in Reports UI. Tested across all test fixtures in `algorithms.test.ts`. |
| Merge sort | **Implemented & tested** | Pure divide-and-conquer implementation in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts`. Used in Reports UI. Tested across all test fixtures in `algorithms.test.ts`. |
| Quick sort | **Implemented & tested** | Pure Hoare-partitioned implementation in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts`. Used in Reports UI. Tested across all test fixtures in `algorithms.test.ts`. |

## Implemented app functionality

- React + TypeScript responsive site with Trade, Portfolio, Reports, and Replay views.
- Neon Managed Auth sign-up/sign-in/session restoration/sign-out. API calls use the JWT on the session returned by `authClient.getSession()`.
- Neon Postgres persistence for users, demo cash, crypto units, reserved balances, orders, order events, executions, FIFO lots/P&L, and replay runs. Engine state is rebuilt from order events when the API needs to match.
- Neon Function API for authenticated account, book, order, cancellation, trade, and replay operations.
- Supported demo symbols: BTC, ETH (with ETHUSD alias), DOGE, XRP, ADA, TRX, AVAX. Price-time matching supports limit/market orders, price priority, FIFO priority, partial fills, cancellation, and integer-paise accounting.
- Top-five order-book levels, bid/ask spread, trade tape, recent-trade moving average using a real Circular Linked List (CLL), cash/units validation, portfolio, and FIFO realized P/L.
- Reusable linear and binary search algorithms, plus five standalone sorting algorithms (Bubble, Selection, Insertion, Merge, Quick) driving trade reports with millisecond execution timing.
- CSV replay up to 10,000 orders, comparing BST/DLL matching with a plain-array baseline and verifying identical trade execution sequences (counts, prices, and quantities).
- TradingView Advanced Chart embed configured for Binance crypto pairs `BINANCE:<SYMBOL>USDT`. The chart is public market display; the PriceTime INR book and fills are simulation data, not pegged to live crypto prices.
- GitHub Pages hosting and Neon production API/Postgres/Auth configuration.

## Profit & Loss (P&L) Implementation & Verification

PriceTime tracks and renders Realized and Unrealized P/L in real time:

1. **FIFO Lot Settlement (`settleTrade` in `apps/api/src/function.ts`)**:
   - Each buy execution creates a lot in `mf_portfolio_lots` (`user_id`, `symbol`, `quantity`, `unit_cost_paise`, `opened_at`).
   - Each sell execution consumes lots strictly First-In, First-Out (oldest `opened_at` first).
   - $\text{Cost Basis} = \sum (\text{consumed units} \times \text{lot unit cost paise})$.
   - $\text{Proceeds} = \text{sold units} \times \text{fill price paise}$.
   - $\text{Realized P/L} = \text{proceeds} - \text{cost basis}$, recorded in `mf_realized_pnl`.
   - Verified by unit test `FIFO lots accounting logic: consumption and realized P/L calculation` in `edgeCases.test.ts`.
2. **Unrealized P&L Calculation (`GET /api/account`)**:
   - For every symbol holding: $(\text{last trade price paise} \times \text{owned units}) - \text{total cost basis paise}$.
   - Updates as market prices shift and new trades execute.
3. **UI Integration (`apps/web/src/main.tsx`)**:
   - **Trade Desk**: Top metric bar displays **Realized FIFO P/L**, **Unrealized P/L** for the active coin, and current coin holding quantity with green/red indicator tones. Placing an order immediately re-fetches account balances and updates P&L.
   - **Portfolio Desk**: Shows four summary metrics: **Available demo cash**, **Realized FIFO P/L**, **Unrealized P/L (Total)** across all coins, and **Net Total P/L** (Realized + Unrealized), plus a per-crypto table with holding details.

## What has been implemented vs what is pending

### Completed & Implemented
- [x] All 13 required course topics implemented and covered by automated tests:
  - Linear Search (`linearSearch`, `linearSearchFirst` in `algorithms.ts`, used in Reports UI)
  - Binary Search (`binarySearch` in `algorithms.ts`, used in `OrderBook.findOrder()`)
  - Singly Linked List (`Trade.next` execution tape, `StackNode<T>`)
  - Circular Linked List (`CircularLinkedList<T>` with `tail.next === head` invariant powering moving averages)
  - Doubly Linked List (Price level order queue with O(1) unlinking, generic `DoublyLinkedQueue<T>`)
  - Queue using Linked Lists (`PriceLevel` FIFO time priority, `DoublyLinkedQueue<T>`)
  - Stack using Linked Lists (`Stack<T>` LIFO audit action stack in `OrderBook`)
  - Binary Search Tree (`PriceTree` bid/ask price levels with insert, find, delete, min, max)
  - 5 Sorting Algorithms (Bubble, Selection, Insertion, Merge, Quick Sort in `sorts.ts` with ms timing)
- [x] Real-time P&L tracking (Realized FIFO P/L, Unrealized P/L, Net P/L) on Trade desk and Portfolio.
- [x] Full matching engine edge cases: market buy/sell with zero liquidity, partial liquidity, multi-price level sweeps, head/middle/tail cancellation.
- [x] Replay benchmark verifying exact trade sequence, price, and quantity equivalence against the plain-array baseline.
- [x] TradingView live crypto chart widgets for all 7 coins (BTC, ETH/ETHUSD, DOGE, XRP, ADA, TRX, AVAX).
- [x] Neon Managed Auth integration and Postgres transactional persistence.
- [x] Account identity reconciliation and foreign key `ON UPDATE CASCADE` migration ensuring seamless session logins without `mf_users_email_idx` unique violations.
- [x] Event-sourced order ID alignment: `OrderBook.submit()` preserves order IDs stored in events during replay, preventing monotonic ID desync and guaranteeing O(log n) binary search cancellation accuracy.
- [x] Hardened order cancellation (`DELETE /api/orders/:symbol/:id`): unlinks orders from DLL levels, refunds reserved demo cash or shares directly to reserving user account, marks status `CANCELLED`, and appends cancel action to engine audit stack.
- [x] Defensive `/api/account` query: joins user IDs by current auth token subject and verified email, providing defensive defaults for wallet balances and realized P&L to eliminate 500 errors.
- [x] UI stability: background polling refresh warnings are logged to console without clobbering active user action banners, and open order filters cleanly expose all cancellable orders with positive remaining quantities.
- [x] JSONB event log migration updating event payload trader IDs on user reconciliation.
- [x] Dedicated 14-topic verification test suite (`apps/api/src/engine/verify-all-topics.test.ts`) covering all 13 required course DS&A topics plus FIFO P&L calculations.
- [x] Multi-crypto expansion: Added BTC (Bitcoin) and ETH (Ethereum, with ETHUSD alias support) across matching engine, database, and Binance TradingView chart widgets.
- [x] 40 unit and integration tests passing (`npm test`).
- [x] 9-stage end-to-end automated API feature test suite passing (`npm run test:e2e`).
- [x] Production build passing (`npm run build`).

### Pending / Sensible future enhancements (Out of scope for coursework rubric)
- [ ] Historical P/L equity curve chart over time (currently shows live cumulative Realized & Unrealized P/L numbers).
- [ ] Snapshotting/checkpointing the event stream for very high volume production (classroom scale replays full event log safely).
- [ ] Email verification & password reset SMTP configuration for open public registration (class demo uses instant email/password auth).

## Verified state

- `npm test`: 40 comprehensive unit and integration tests pass across:
  - `src/engine/orderBook.test.ts` (price/time priority with partial fill, DLL middle cancellation, two-child BST deletion, 20-price circular moving average)
  - `src/engine/dataStructures.test.ts` (CircularLinkedList invariant `tail.next === head`, wraparound overwrite, moving average, Stack LIFO operations, DoublyLinkedQueue FIFO and unlinking)
  - `src/engine/algorithms.test.ts` (linearSearch, linearSearchFirst, binarySearch, Bubble, Selection, Insertion, Merge, and Quick sort on empty, singleton, reverse, duplicate, random, and trade records)
  - `src/engine/edgeCases.test.ts` (CLL pointer verification, linked Stack audit history, binarySearch O(log n) order lookup, market orders with zero/partial liquidity, multi-price level sweep, cancellation edge cases, OrderBook vs arrayReplay benchmark sequence equivalence, FIFO lots realized P/L)
  - `src/engine/verify-all-topics.test.ts` (1-to-1 explicit verification tests for Linear Search, Binary Search, Singly Linked List, Circular Linked List, Doubly Linked List, FIFO Queue, LIFO Stack, BST, Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, Quick Sort, and FIFO Lot P&L Accounting)
- `npm run test:e2e`: 9-stage end-to-end integration test suite passes against the live running API:
  - 1. Health check & database connection
  - 2. Neon Auth user registration & EdDSA JWT issuance
  - 3. Symbols metadata retrieval (DOGE, XRP, ADA, TRX, AVAX)
  - 4. Account bootstrap: ₹100,000 cash, 10 units each across 5 assets, 0 realized P&L
  - 5. Order book snapshots, BST levels, and Circular Linked List moving average
  - 6. Resting Limit Buy order placement and ₹90.00 cash reservation
  - 7. Order cancellation and ₹90.00 cash refund
  - 8. Sell trade execution against maker bid with FIFO lot consumption and Realized P&L calculation
  - 9. Replay engine benchmark with BST/DLL vs Array replay exact sequence equivalence
- `npm run build`: API TypeScript build (`tsc -p tsconfig.json`) and frontend production build (`tsc -b && vite build`) both succeed with zero errors.
- Replay benchmark now compares full trade sequence, price, and quantity equivalence rather than just total trade count.
- GitHub repository description updated via `gh repo edit`.

## Guardrails

- Product name: **PriceTime**, never MarketForge.
- Multi-crypto paper trading; all accounts use demo balances only.
- No exchange execution, real-money handling, deposits, withdrawals, or investment advice.
- Never commit Neon pooled/direct connection strings, passwords, JWTs, or auth signing secrets. Only the public frontend API/Auth URLs belong in Pages build variables.
- The production Neon branch is `production`; use an expiring development branch for integration tests.
