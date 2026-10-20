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
- Crypto order books: `BTC`, `ETH`, `DOGE`, `XRP`, `ADA`, `TRX`, and `AVAX`.
- Limit and market orders, price priority, FIFO time priority, partial fills, self-trade prevention, cancellation, integer-paise accounting, and cash/unit reservations.
- Best bid/ask, spread, top-five levels, execution tape, and 20-trade circular moving average.
- FIFO realized P/L and current holding cost basis; unrealized P/L uses the latest simulated fill.
- Search and five implemented report sorts: bubble, selection, insertion, merge, and quick sort.
- CSV replay up to 10,000 orders. Compares the BST/DLL engine with an array book and records run metrics.
- TradingView Advanced Chart widget for Binance spot pairs `BTCUSDT`, `ETHUSDT`, `DOGEUSDT`, `XRPUSDT`, `ADAUSDT`, `TRXUSDT`, and `AVAXUSDT`. Charts show live/public USDT-market data; the paper order book remains separate and INR-denominated.
- GitHub Actions workflow builds and publishes the static frontend to GitHub Pages.
- Neon schema/migrations as code, with Neon project configuration in `neon.ts`.

## Data Structures & Algorithms — Topics Used, Locations & Logic

PriceTime is architected around foundational data structures and classical algorithms to implement an exchange-grade matching engine and high-performance financial reporting desk.

### Quick Reference Matrix

| Required Topic | File Location | Data Structure / Function | Role in PriceTime | Time / Space Complexity |
|---|---|---|---|---|
| **Linear Search** | `apps/web/src/algorithms/search.ts`<br>`apps/api/src/engine/algorithms.ts` | `linearSearch()`, `linearSearchFirst()` | Filters execution history in Reports desk and provides fallback lookup | $O(n)$ Time / $O(1)$ Space |
| **Binary Search** | `apps/web/src/algorithms/search.ts`<br>`apps/api/src/engine/algorithms.ts` | `binarySearch()`, `OrderBook.findOrder()` | Fast $O(\log n)$ order ID lookup for status queries and cancellation | $O(\log n)$ Time / $O(1)$ Space |
| **Singly Linked List (SLL)** | `apps/api/src/engine/orderBook.ts`<br>`apps/api/src/engine/dataStructures.ts` | `Trade.next`, `tradeHead`, `tradeTail`, `StackNode<T>` | Chronological execution tape and backing nodes for stack frames | $O(1)$ Append / $O(n)$ Space |
| **Circular Linked List (CLL)** | `apps/api/src/engine/dataStructures.ts`<br>`apps/api/src/engine/orderBook.ts` | `CircularLinkedList<T>` (`tail.next === head`) | Ring buffer tracking the 20-trade rolling execution price moving average | $O(1)$ Overwrite / $O(k)$ Space |
| **Doubly Linked List (DLL)** | `apps/api/src/engine/orderBook.ts`<br>`apps/api/src/engine/dataStructures.ts` | `PriceLevel` (`Order.prev`, `Order.next`), `DoublyLinkedQueue<T>` | Holds resting orders at each price level; enables $O(1)$ arbitrary unlinking on cancel | $O(1)$ Insert/Delete / $O(n)$ Space |
| **Queue (Linked List)** | `apps/api/src/engine/orderBook.ts`<br>`apps/api/src/engine/dataStructures.ts` | `PriceLevel.enqueue()`, `DoublyLinkedQueue<T>` | Enforces strict First-In, First-Out (FIFO) time priority among orders at the same price | $O(1)$ Enqueue/Dequeue / $O(n)$ Space |
| **Stack (Linked List)** | `apps/api/src/engine/dataStructures.ts`<br>`apps/api/src/engine/orderBook.ts` | `Stack<T>` (`actionStack`), `StackNode<T>` | Last-In, First-Out (LIFO) engine audit history for submits and cancellations | $O(1)$ Push/Pop / $O(n)$ Space |
| **Binary Search Tree (BST)** | `apps/api/src/engine/orderBook.ts` | `PriceTree` (`BSTNode<PriceLevel>`), `buyTree`, `sellTree` | Maintains discrete price levels; queries Best Bid (max) and Best Ask (min) | $O(\log k)$ Avg Search/Insert/Delete |
| **Bubble Sort** | `apps/web/src/algorithms/sorts.ts`<br>`apps/api/src/engine/algorithms.ts` | `bubbleSort()` | Sorts user trade reports with early-termination optimization | $O(n^2)$ Worst/Avg, $O(n)$ Best |
| **Selection Sort** | `apps/web/src/algorithms/sorts.ts`<br>`apps/api/src/engine/algorithms.ts` | `selectionSort()` | Sorts trade reports by finding successive minimum values in-place | $O(n^2)$ Comparisons, $O(n)$ Swaps |
| **Insertion Sort** | `apps/web/src/algorithms/sorts.ts`<br>`apps/api/src/engine/algorithms.ts` | `insertionSort()` | Sorts trade reports by shifting larger elements into sorted subarrays | $O(n^2)$ Worst, $O(n)$ Best (nearly sorted) |
| **Merge Sort** | `apps/web/src/algorithms/sorts.ts`<br>`apps/api/src/engine/algorithms.ts` | `mergeSort()` | Stable divide-and-conquer sorting for high-volume trade reports | $O(n \log n)$ Time / $O(n)$ Space |
| **Quick Sort** | `apps/web/src/algorithms/sorts.ts`<br>`apps/api/src/engine/algorithms.ts` | `quickSort()` | In-place Hoare-partitioned divide-and-conquer sorting for trade reports | $O(n \log n)$ Avg Time / $O(\log n)$ Space |
| **FIFO Lots (Accounting)** | `apps/api/src/function.ts`<br>`mf_portfolio_lots`, `mf_realized_pnl` | `settleTrade()` | Realized P/L calculation consuming oldest purchase lots first on asset sales | Strict chronological tax-lot matching |

---

### Detailed Breakdown of Topics, Usage & Underlying Logics

#### 1. Linear Search
- **Where Used**: 
  - `apps/web/src/algorithms/search.ts` (`linearSearch`, `linearSearchFirst`)
  - `apps/api/src/engine/algorithms.ts`
  - Integrated in `apps/web/src/main.tsx` in the **Reports Desk** search bar to filter execution rows by user ID, order ID, or symbol.
  - Used as a defensive fallback in `OrderBook.findOrder(id)` in `apps/api/src/engine/orderBook.ts`.
- **Logic**:
  - Starts at index `0` and steps sequentially through each item $i$ up to $n - 1$.
  - Evaluates a predicate function `predicate(item, index)`. If true, the item is collected (or immediately returned in `linearSearchFirst`).
  - Does not require elements to be ordered or pre-indexed.
  - Worst and average time complexity: $O(n)$; space complexity: $O(1)$.

#### 2. Binary Search
- **Where Used**: 
  - `apps/web/src/algorithms/search.ts` and `apps/api/src/engine/algorithms.ts` (`binarySearch`)
  - Integrated in `apps/api/src/engine/orderBook.ts` in `OrderBook.findOrder(id)` to locate orders in $O(\log n)$ time.
- **Logic**:
  - Operates over an array sorted strictly monotonically by key (such as the engine's append-only `orders` array indexed by monotonic `orderId`).
  - Maintains `low = 0` and `high = array.length - 1`. At each step, calculates the midpoint `mid = Math.floor((low + high) / 2)` and extracts the key using `keySelector(array[mid])`.
  - If `key === target`, returns `{ found: true, index: mid, item: array[mid] }`.
  - If `key < target`, discards the lower half by updating `low = mid + 1`.
  - If `key > target`, discards the upper half by updating `high = mid - 1`.
  - Halves the candidate search space in every iteration, achieving $O(\log n)$ time complexity.

#### 3. Singly Linked List (SLL)
- **Where Used**:
  - `apps/api/src/engine/orderBook.ts` (`Trade.next`, `tradeHead`, `tradeTail`).
  - `apps/api/src/engine/dataStructures.ts` (`StackNode<T>`).
- **Logic**:
  - Each node contains its payload (`Trade` execution details or generic data `value`) and a single directional reference (`next`) pointing to the following node or `null`.
  - **Trade Execution Tape**: As trades execute, a new `Trade` node is appended to `tradeTail.next` and `tradeTail` is updated in $O(1)$ time without resizing dynamic arrays.
  - Iteration traverses from `tradeHead` through `node.next` until `null`, providing an unalterable chronological record of executions.

#### 4. Circular Linked List (CLL)
- **Where Used**:
  - `apps/api/src/engine/dataStructures.ts` (`CircularLinkedList<T>`).
  - Integrated in `apps/api/src/engine/orderBook.ts` to power the rolling **20-trade execution price moving average**.
- **Logic**:
  - An explicit linked node structure with `head`, `tail`, `capacity` (20), and `length`.
  - **Invariant Guarantee**: `tail.next === head` is maintained at all times, forming a closed ring (verified by unit tests).
  - **Ring Buffer Overwrite**: When the list reaches its capacity of 20 elements, appending a new trade price does not reallocate memory; instead, it overwrites the oldest node at `head`, reassigns `tail = head`, and advances `head = head.next`, maintaining the circular invariant in $O(1)$ time.
  - **Moving Average Computation**: Traverses the ring from `head` along `next` pointers for exactly `length` steps, accumulating prices to compute $\frac{\sum \text{pricePaise}}{\text{count}}$ in integer paise.

#### 5. Doubly Linked List (DLL)
- **Where Used**:
  - `apps/api/src/engine/orderBook.ts` (Order chaining in `PriceLevel` via `Order.prev` and `Order.next`).
  - `apps/api/src/engine/dataStructures.ts` (`DoublyLinkedQueue<T>`).
- **Logic**:
  - Nodes maintain bidirectional links: `prev` points to the preceding order, and `next` points to the succeeding order.
  - **$O(1)$ Arbitrary Node Deletion**: When an order is cancelled or filled, it is removed without scanning or shifting an array:
    ```typescript
    if (order.prev) order.prev.next = order.next;
    else this.head = order.next;
    if (order.next) order.next.prev = order.prev;
    else this.tail = order.prev;
    order.prev = order.next = null;
    ```
  - This guarantees that order cancellations from the middle of deep price queues execute in $O(1)$ time without disrupting time priority.

#### 6. Queue Using Linked Lists (FIFO)
- **Where Used**:
  - `apps/api/src/engine/orderBook.ts` (`PriceLevel` queue management).
  - `apps/api/src/engine/dataStructures.ts` (`DoublyLinkedQueue<T>`).
- **Logic**:
  - Enforces strict **First-In, First-Out (FIFO)** time priority for orders resting at the identical limit price level.
  - `enqueue(order)` appends to the queue's `tail` in $O(1)$ time.
  - When liquidity is taken, `head` supplies the earliest resting order first.
  - Guarantees fairness: orders placed earlier at the same price level are fully matched before later orders receive fills.

#### 7. Stack Using Linked Lists (LIFO)
- **Where Used**:
  - `apps/api/src/engine/dataStructures.ts` (`Stack<T>`).
  - Integrated in `apps/api/src/engine/orderBook.ts` as `actionStack` to track engine operations (`SUBMIT`, `CANCEL`, `FILL`).
- **Logic**:
  - Implements a linked **Last-In, First-Out (LIFO)** data structure with `top` pointing to a `StackNode<T>`.
  - `push(item)` allocates a new node with `node.next = top`, and updates `top = node` in $O(1)$ time.
  - `pop()` reads `top.value`, updates `top = top.next`, and returns the most recent action in $O(1)$ time.
  - Provides instant access to the most recent engine events for audit logs, telemetry, and debugging.

#### 8. Binary Search Tree (BST)
- **Where Used**:
  - `apps/api/src/engine/orderBook.ts` (`PriceTree`, `BSTNode<PriceLevel>`).
  - Instantiated twice per symbol: `buyTree` (bids) and `sellTree` (asks).
- **Logic**:
  - Each tree node represents a discrete `PriceLevel` keyed by its integer `pricePaise`, containing the doubly-linked queue of orders at that price.
  - **Best Price Retrieval**:
    - **Bids (`buyTree`)**: Highest buy price is found at the rightmost node by calling `max()` in $O(\text{depth})$ time.
    - **Asks (`sellTree`)**: Lowest sell price is found at the leftmost node by calling `min()` in $O(\text{depth})$ time.
  - **Tree Pruning on Depletion**: When all orders at a price level are filled or cancelled, the level node is removed from the BST via standard tree deletion, gracefully handling:
    - Leaf nodes (direct removal).
    - Single-child nodes (splicing parent to child).
    - Two-child nodes (replacing node with in-order successor, maintaining tree invariant).
  - Yields $O(\log k)$ average search, insertion, and deletion where $k$ is the number of active price levels.

#### 9–13. Five Sorting Algorithms
Implemented in `apps/web/src/algorithms/sorts.ts` and `apps/api/src/engine/algorithms.ts`, and interactively selectable in the **Reports Desk** UI:

1. **Bubble Sort (`bubbleSort`)**:
   - Iteratively scans the array, comparing adjacent elements `arr[i]` and `arr[i + 1]`.
   - Swaps them if they violate the comparator order.
   - Includes an early-termination optimization: if a full pass completes with `swapped === false`, sorting terminates immediately ($O(n)$ best case). Worst/Average: $O(n^2)$.
2. **Selection Sort (`selectionSort`)**:
   - Partitions the array into a sorted prefix and an unsorted suffix.
   - In each pass, finds the minimum element in the unsorted region and performs a single swap with the first element of that region.
   - Minimizes memory writes ($O(n)$ swaps), with $O(n^2)$ comparisons.
3. **Insertion Sort (`insertionSort`)**:
   - Progressively constructs a sorted array from left to right.
   - For each element, shifts preceding elements that are greater to the right until the correct insertion slot is cleared.
   - Adaptive performance: runs in $O(n)$ time on nearly sorted trade logs; $O(n^2)$ worst case.
4. **Merge Sort (`mergeSort`)**:
   - Divide-and-conquer algorithm.
   - Recursively splits the array into two halves at `mid = Math.floor(len / 2)` until arrays of length 1 are reached.
   - Merges the two sorted halves using two pointers into a temporary buffer, preserving stability.
   - Guarantees $O(n \log n)$ time complexity on all inputs.
5. **Quick Sort (`quickSort`)**:
   - Divide-and-conquer algorithm using Hoare-style partitioning.
   - Selects a pivot element and partitions the array such that all elements smaller than the pivot appear to its left and larger elements appear to its right.
   - Recursively sorts the left and right partitions in-place.
   - Average time complexity: $O(n \log n)$; space complexity: $O(\log n)$ recursion stack.

---

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

## How P&L (Profit & Loss) and FIFO Lots Work

PriceTime tracks two kinds of profit and loss in real time with integer-paise precision:

1. **Realized FIFO P&L**:
   - When a trader sells crypto units, the backend consumes the trader's oldest unconsumed purchase lots (`mf_portfolio_lots` ordered by `opened_at, id`).
   - Units are deducted from the earliest lot (First-In, First-Out accounting).
   - $\text{Cost Basis} = \sum (\text{units consumed} \times \text{unit cost paise})$.
   - $\text{Proceeds} = \text{units sold} \times \text{execution price paise}$.
   - $\text{Realized P/L} = \text{proceeds} - \text{cost basis}$.
   - Persisted in `mf_realized_pnl` and immediately reflected in account summaries.
2. **Unrealized P&L**:
   - Calculated per position: $(\text{last trade price paise} \times \text{units held}) - \text{remaining cost basis paise}$.
   - Updates as simulated market prices shift and new trades execute.
3. **Live Visibility**:
   - **Trade Desk**: Displays the trader's all-time **Realized FIFO P/L**, the active crypto's **Unrealized P/L**, and current holding quantity directly in the top metric strip. When an order is placed and filled, account balances and P/L are immediately re-fetched and updated.
   - **Portfolio Desk**: Displays summary cards for **Available demo cash**, **Realized FIFO P/L**, **Unrealized P/L (Total)**, and **Net Total P/L** (Realized + Unrealized), plus a per-crypto table with owned units, average unit cost, last price, and position P/L.

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
npm run test:e2e -w @pricetime/api
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
apps/api/src/engine/orderBook.ts       BST, DLL queues, SLL trade history, CLL moving average, Stack audit
apps/api/src/engine/dataStructures.ts  CircularLinkedList (tail.next=head), Stack (LIFO), DoublyLinkedQueue
apps/api/src/engine/algorithms.ts      linearSearch, binarySearch, Bubble, Selection, Insertion, Merge, Quick
apps/api/src/engine/*.test.ts          26 tests covering engine, data structures, algorithms, and edge cases
apps/api/src/function.ts               Authenticated Neon Function API and settlement
apps/api/src/db/schema.ts              Typed Drizzle schema
apps/api/drizzle/                      Versioned SQL migrations
apps/web/src/main.tsx                  Full trading UI, auth, reports, replay
apps/web/src/algorithms/               Pure search and sorting modules used in Reports
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

## License

This project is licensed under the [MIT License](LICENSE).

