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
- Supported demo symbols: DOGE, XRP, ADA, TRX, AVAX. Price-time matching supports limit/market orders, price priority, FIFO priority, partial fills, cancellation, and integer-paise accounting.
- Top-five order-book levels, bid/ask spread, trade tape, recent-trade moving average using a real Circular Linked List (CLL), cash/units validation, portfolio, and FIFO realized P/L.
- Reusable linear and binary search algorithms, plus five standalone sorting algorithms (Bubble, Selection, Insertion, Merge, Quick) driving trade reports with millisecond execution timing.
- CSV replay up to 10,000 orders, comparing BST/DLL matching with a plain-array baseline and verifying identical trade execution sequences (counts, prices, and quantities).
- TradingView Advanced Chart embed configured for Binance crypto pairs `BINANCE:<SYMBOL>USDT`. The chart is public market display; the PriceTime INR book and fills are simulation data, not pegged to live crypto prices.
- GitHub Pages hosting and Neon production API/Postgres/Auth configuration.

## Verified state

- `npm test`: 26 comprehensive unit and integration tests pass across:
  - `src/engine/orderBook.test.ts` (price/time priority with partial fill, DLL middle cancellation, two-child BST deletion, 20-price circular moving average)
  - `src/engine/dataStructures.test.ts` (CircularLinkedList invariant `tail.next === head`, wraparound overwrite, moving average, Stack LIFO operations, DoublyLinkedQueue FIFO and unlinking)
  - `src/engine/algorithms.test.ts` (linearSearch, linearSearchFirst, binarySearch, Bubble, Selection, Insertion, Merge, and Quick sort on empty, singleton, reverse, duplicate, random, and trade records)
  - `src/engine/edgeCases.test.ts` (CLL pointer verification, linked Stack audit history, binarySearch O(log n) order lookup, market orders with zero/partial liquidity, multi-price level sweep, cancellation edge cases, OrderBook vs arrayReplay benchmark sequence equivalence, FIFO lots realized P/L)
- `npm run build`: API TypeScript build (`tsc -p tsconfig.json`) and frontend production build (`tsc -b && vite build`) both succeed with zero errors.
- Replay benchmark now compares full trade sequence, price, and quantity equivalence rather than just total trade count.

## Guardrails

- Product name: **PriceTime**, never MarketForge.
- Multi-crypto paper trading; all accounts use demo balances only.
- No exchange execution, real-money handling, deposits, withdrawals, or investment advice.
- Never commit Neon pooled/direct connection strings, passwords, JWTs, or auth signing secrets. Only the public frontend API/Auth URLs belong in Pages build variables.
- The production Neon branch is `production`; use an expiring development branch for integration tests.
