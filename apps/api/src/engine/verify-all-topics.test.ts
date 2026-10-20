import test from "node:test";
import assert from "node:assert/strict";
import {
  linearSearch,
  linearSearchFirst,
  binarySearch,
  bubbleSort,
  selectionSort,
  insertionSort,
  mergeSort,
  quickSort
} from "./algorithms.js";
import {
  CircularLinkedList,
  Stack,
  DoublyLinkedQueue
} from "./dataStructures.js";
import { OrderBook, PriceTree, PriceLevel } from "./orderBook.js";

// ============================================================================
// TOPIC 1: LINEAR SEARCH
// ============================================================================
test("Topic 1: Linear Search — sequentially scans and filters items", () => {
  const trades = [
    { id: 101, symbol: "DOGE", pricePaise: 2000, traderId: "trader-A" },
    { id: 102, symbol: "XRP",  pricePaise: 22000, traderId: "trader-B" },
    { id: 103, symbol: "DOGE", pricePaise: 2050, traderId: "trader-A" },
    { id: 104, symbol: "ADA",  pricePaise: 6000, traderId: "trader-C" },
    { id: 105, symbol: "DOGE", pricePaise: 2100, traderId: "trader-B" }
  ];

  // 1. Filter all matches
  const dogeTrades = linearSearch(trades, t => t.symbol === "DOGE");
  assert.equal(dogeTrades.length, 3);
  assert.deepEqual(dogeTrades.map(t => t.id), [101, 103, 105]);

  // 2. Filter with compound predicate
  const traderADoge = linearSearch(trades, t => t.traderId === "trader-A" && t.symbol === "DOGE");
  assert.equal(traderADoge.length, 2);
  assert.deepEqual(traderADoge.map(t => t.id), [101, 103]);

  // 3. Non-existent filter returns empty array
  const solTrades = linearSearch(trades, t => t.symbol === "SOL");
  assert.deepEqual(solTrades, []);

  // 4. linearSearchFirst locates the first occurrence and index
  const firstTraderB = linearSearchFirst(trades, t => t.traderId === "trader-B");
  assert.notEqual(firstTraderB, undefined);
  assert.equal(firstTraderB?.index, 1);
  assert.equal(firstTraderB?.item.id, 102);

  const notFound = linearSearchFirst(trades, t => t.symbol === "BTC");
  assert.equal(notFound, undefined);
});

// ============================================================================
// TOPIC 2: BINARY SEARCH
// ============================================================================
test("Topic 2: Binary Search — locates keys in O(log n) time on sorted data", () => {
  const monotonicOrders = [
    { id: 10, symbol: "DOGE", pricePaise: 2000 },
    { id: 25, symbol: "DOGE", pricePaise: 2010 },
    { id: 40, symbol: "DOGE", pricePaise: 2020 },
    { id: 55, symbol: "DOGE", pricePaise: 2030 },
    { id: 70, symbol: "DOGE", pricePaise: 2040 },
    { id: 95, symbol: "DOGE", pricePaise: 2050 }
  ];

  // 1. First element
  const first = binarySearch(monotonicOrders, 10, o => o.id);
  assert.equal(first?.index, 0);
  assert.equal(first?.item.id, 10);

  // 2. Middle element
  const mid = binarySearch(monotonicOrders, 40, o => o.id);
  assert.equal(mid?.index, 2);
  assert.equal(mid?.item.id, 40);

  // 3. Last element
  const last = binarySearch(monotonicOrders, 95, o => o.id);
  assert.equal(last?.index, 5);
  assert.equal(last?.item.id, 95);

  // 4. Missing keys (below min, above max, in-between gap)
  assert.equal(binarySearch(monotonicOrders, 5, o => o.id), undefined);
  assert.equal(binarySearch(monotonicOrders, 120, o => o.id), undefined);
  assert.equal(binarySearch(monotonicOrders, 30, o => o.id), undefined);

  // 5. Integration in OrderBook.findOrder()
  const book = new OrderBook("DOGE");
  const sub1 = book.submit({ traderId: "t1", symbol: "DOGE", side: "SELL", type: "LIMIT", quantity: 5, pricePaise: 2000 });
  const sub2 = book.submit({ traderId: "t2", symbol: "DOGE", side: "SELL", type: "LIMIT", quantity: 5, pricePaise: 2010 });
  
  assert.equal(book.findOrder(sub1.order.id)?.id, sub1.order.id);
  assert.equal(book.findOrder(sub2.order.id)?.id, sub2.order.id);
  assert.equal(book.findOrder(99999), undefined);
});

// ============================================================================
// TOPIC 3: SINGLY LINKED LIST (SLL)
// ============================================================================
test("Topic 3: Singly Linked List — chronological trade tape and stack nodes", () => {
  const book = new OrderBook("XRP");

  // Place resting asks
  book.submit({ traderId: "seller1", symbol: "XRP", side: "SELL", type: "LIMIT", quantity: 2, pricePaise: 22000 });
  book.submit({ traderId: "seller2", symbol: "XRP", side: "SELL", type: "LIMIT", quantity: 3, pricePaise: 22000 });

  // Place matching buy: generates 2 executions
  book.submit({ traderId: "buyer", symbol: "XRP", side: "BUY", type: "LIMIT", quantity: 5, pricePaise: 22000 });

  // Verify the SLL trade tape
  const head = book.tradeHeadNode;
  assert.notEqual(head, null);
  assert.equal(head?.sellerId, "seller1");
  assert.equal(head?.quantity, 2);

  // Next pointer moves to second trade
  const second = head?.next;
  assert.notEqual(second, null);
  assert.equal(second?.sellerId, "seller2");
  assert.equal(second?.quantity, 3);

  // End of trade tape
  assert.equal(second?.next, undefined);
  assert.equal(book.tradeTailNode, second);
});

// ============================================================================
// TOPIC 4: CIRCULAR LINKED LIST (CLL)
// ============================================================================
test("Topic 4: Circular Linked List — ring buffer invariant tail.next === head & moving average", () => {
  const capacity = 5;
  const cll = new CircularLinkedList<number>(capacity);

  // 1. Single element: head === tail, tail.next === head
  cll.append(100);
  assert.equal(cll.size, 1);
  assert.equal(cll.head, cll.tail);
  assert.equal(cll.tail?.next, cll.head);

  // 2. Multiple elements up to capacity maintain tail.next === head
  cll.append(200);
  cll.append(300);
  assert.equal(cll.size, 3);
  assert.equal(cll.head?.value, 100);
  assert.equal(cll.tail?.value, 300);
  assert.equal(cll.tail?.next, cll.head);

  cll.append(400);
  cll.append(500);
  assert.equal(cll.size, 5);
  assert.equal(cll.tail?.next, cll.head);
  assert.equal(cll.average(), 300); // (100+200+300+400+500)/5 = 300

  // 3. Overwriting at capacity: 600 overwrites 100
  cll.append(600);
  assert.equal(cll.size, 5);
  assert.equal(cll.head?.value, 200); // 100 was evicted
  assert.equal(cll.tail?.value, 600);
  assert.equal(cll.tail?.next, cll.head);
  assert.deepEqual(cll.toArray(), [200, 300, 400, 500, 600]);
  assert.equal(cll.average(), 400); // (200+300+400+500+600)/5 = 400
});

// ============================================================================
// TOPIC 5: DOUBLY LINKED LIST (DLL)
// ============================================================================
test("Topic 5: Doubly Linked List — bidirectional pointers and O(1) arbitrary node unlinking", () => {
  const queue = new DoublyLinkedQueue<string>();
  const n1 = queue.enqueue("Order-1");
  const n2 = queue.enqueue("Order-2");
  const n3 = queue.enqueue("Order-3");

  assert.equal(queue.size, 3);
  assert.equal(n1.prev, undefined);
  assert.equal(n1.next, n2);
  assert.equal(n2.prev, n1);
  assert.equal(n2.next, n3);
  assert.equal(n3.prev, n2);
  assert.equal(n3.next, undefined);

  // O(1) unlink of middle node n2
  queue.unlink(n2);
  assert.equal(queue.size, 2);
  assert.equal(n1.next, n3);
  assert.equal(n3.prev, n1);
  assert.equal(n2.prev, undefined);
  assert.equal(n2.next, undefined);

  // FIFO order of remaining nodes preserved
  assert.equal(queue.dequeue(), "Order-1");
  assert.equal(queue.dequeue(), "Order-3");
  assert.equal(queue.isEmpty(), true);
});

// ============================================================================
// TOPIC 6: QUEUE USING LINKED LISTS
// ============================================================================
test("Topic 6: Queue using Linked Lists — strict FIFO time priority", () => {
  const level = new PriceLevel(2000);
  assert.equal(level.orderCount, 0);

  const order1: any = { id: 1, side: "BUY", remaining: 10 };
  const order2: any = { id: 2, side: "BUY", remaining: 5 };
  const order3: any = { id: 3, side: "BUY", remaining: 15 };

  level.enqueue(order1);
  level.enqueue(order2);
  level.enqueue(order3);

  assert.equal(level.orderCount, 3);
  assert.equal(level.quantity, 30);
  assert.equal(level.head?.id, 1);
  assert.equal(level.tail?.id, 3);

  // Dequeue in arrival sequence
  const firstOut = level.head!;
  level.unlink(firstOut);
  assert.equal(firstOut.id, 1);
  assert.equal(level.head?.id, 2);

  const secondOut = level.head!;
  level.unlink(secondOut);
  assert.equal(secondOut.id, 2);
  assert.equal(level.head?.id, 3);
});

// ============================================================================
// TOPIC 7: STACK USING LINKED LISTS
// ============================================================================
test("Topic 7: Stack using Linked Lists — LIFO order and engine audit history", () => {
  const stack = new Stack<{ action: string; orderId: number }>();
  assert.equal(stack.isEmpty(), true);

  stack.push({ action: "SUBMIT", orderId: 101 });
  stack.push({ action: "SUBMIT", orderId: 102 });
  stack.push({ action: "CANCEL", orderId: 101 });

  assert.equal(stack.size, 3);
  assert.equal(stack.peek()?.action, "CANCEL");
  assert.equal(stack.peek()?.orderId, 101);

  // Pop in reverse order (LIFO)
  const a1 = stack.pop();
  assert.equal(a1?.action, "CANCEL");
  assert.equal(a1?.orderId, 101);

  const a2 = stack.pop();
  assert.equal(a2?.action, "SUBMIT");
  assert.equal(a2?.orderId, 102);

  const a3 = stack.pop();
  assert.equal(a3?.action, "SUBMIT");
  assert.equal(a3?.orderId, 101);

  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.pop(), undefined);
});

// ============================================================================
// TOPIC 8: BINARY SEARCH TREE (BST)
// ============================================================================
test("Topic 8: Binary Search Tree — price level organization, min/max & node deletion", () => {
  const tree = new PriceTree();
  assert.equal(tree.minimum(), undefined);
  assert.equal(tree.maximum(), undefined);

  // Insert price levels: 50, 30, 70, 20, 40, 60, 80
  const prices = [50, 30, 70, 20, 40, 60, 80];
  const levels = new Map<number, PriceLevel>();
  for (const p of prices) {
    const lvl = tree.insert(p);
    lvl.enqueue({ id: p, side: "BUY", remaining: 1 } as any);
    levels.set(p, lvl);
  }

  // Minimum is lowest ask, Maximum is highest bid
  assert.equal(tree.minimum()?.pricePaise, 20);
  assert.equal(tree.maximum()?.pricePaise, 80);

  // 1. Delete leaf node (20)
  tree.delete(levels.get(20)!);
  assert.equal(tree.find(20), undefined);
  assert.equal(tree.minimum()?.pricePaise, 30);

  // 2. Delete single-child node: add 10 under 30 (left of 30) then delete 30
  const lvl10 = tree.insert(10);
  lvl10.enqueue({ id: 10, side: "BUY", remaining: 1 } as any);
  tree.delete(levels.get(30)!);
  assert.equal(tree.find(30), undefined);
  assert.equal(tree.find(10)?.pricePaise, 10);
  assert.equal(tree.minimum()?.pricePaise, 10);

  // 3. Delete two-child node: root 50 has children
  tree.delete(levels.get(50)!);
  assert.equal(tree.find(50), undefined);
  assert.equal(tree.minimum()?.pricePaise, 10);
  assert.equal(tree.maximum()?.pricePaise, 80);
});

// ============================================================================
// TOPICS 9-13: FIVE SORTING ALGORITHMS
// ============================================================================
const sorts = [
  { name: "Bubble Sort", fn: bubbleSort },
  { name: "Selection Sort", fn: selectionSort },
  { name: "Insertion Sort", fn: insertionSort },
  { name: "Merge Sort", fn: mergeSort },
  { name: "Quick Sort", fn: quickSort }
];

for (const { name, fn } of sorts) {
  test(`Topic: ${name} — sorts empty, singleton, reverse, duplicate and trade records`, () => {
    const numCmp = (a: number, b: number) => a - b;

    // Empty
    assert.deepEqual(fn([], numCmp), []);

    // Singleton
    assert.deepEqual(fn([99], numCmp), [99]);

    // Already sorted
    assert.deepEqual(fn([1, 2, 3, 4, 5], numCmp), [1, 2, 3, 4, 5]);

    // Reverse sorted
    assert.deepEqual(fn([50, 40, 30, 20, 10], numCmp), [10, 20, 30, 40, 50]);

    // Duplicates
    assert.deepEqual(fn([4, 2, 4, 1, 3, 2], numCmp), [1, 2, 2, 3, 4, 4]);

    // Real trade record objects sorted by price
    const trades = [
      { id: 1, pricePaise: 2050 },
      { id: 2, pricePaise: 2000 },
      { id: 3, pricePaise: 2100 },
      { id: 4, pricePaise: 2020 }
    ];
    const sortedTrades = fn(trades, (a, b) => a.pricePaise - b.pricePaise);
    assert.deepEqual(sortedTrades.map(t => t.id), [2, 4, 1, 3]);
  });
}

// ============================================================================
// TOPIC 14: FIFO LOTS & PROFIT AND LOSS (P&L) ACCOUNTING LOGIC
// ============================================================================
test("Topic 14: FIFO Lots & P&L Calculation — multi-lot consumption and realized P/L", () => {
  // Simulate buying 2 lots:
  // Lot 1: 10 units @ ₹100.00 (10000 paise) = ₹1,000.00
  // Lot 2: 10 units @ ₹120.00 (12000 paise) = ₹1,200.00
  const lots = [
    { id: 1, units: 10, unitCostPaise: 10000, openedAt: 1000 },
    { id: 2, units: 10, unitCostPaise: 12000, openedAt: 2000 }
  ];

  // Function to simulate FIFO sell settlement
  function simulateFifoSell(sellUnits: number, fillPricePaise: number) {
    let remainingToSell = sellUnits;
    let totalCostBasisPaise = 0;

    for (const lot of lots) {
      if (remainingToSell <= 0) break;
      if (lot.units <= 0) continue;

      const take = Math.min(lot.units, remainingToSell);
      lot.units -= take;
      remainingToSell -= take;
      totalCostBasisPaise += take * lot.unitCostPaise;
    }

    const proceedsPaise = sellUnits * fillPricePaise;
    const realizedPaise = proceedsPaise - totalCostBasisPaise;
    return { proceedsPaise, totalCostBasisPaise, realizedPaise };
  }

  // 1. Sell 5 units @ ₹150.00 (15000 paise): consumes 5 from Lot 1
  const sell1 = simulateFifoSell(5, 15000);
  assert.equal(sell1.totalCostBasisPaise, 5 * 10000); // 50,000 paise (₹500.00)
  assert.equal(sell1.proceedsPaise, 5 * 15000);       // 75,000 paise (₹750.00)
  assert.equal(sell1.realizedPaise, 25000);           // ₹250.00 realized profit
  assert.equal(lots[0].units, 5);                     // Lot 1 has 5 units left
  assert.equal(lots[1].units, 10);                    // Lot 2 untouched

  // 2. Sell 8 units @ ₹140.00 (14000 paise): consumes remaining 5 from Lot 1 + 3 from Lot 2
  const sell2 = simulateFifoSell(8, 14000);
  // Cost basis: (5 * 10,000) + (3 * 12,000) = 50,000 + 36,000 = 86,000 paise (₹860.00)
  assert.equal(sell2.totalCostBasisPaise, 86000);
  // Proceeds: 8 * 14,000 = 112,000 paise (₹1,120.00)
  assert.equal(sell2.proceedsPaise, 112000);
  // Realized profit: 112,000 - 86,000 = 26,000 paise (₹260.00)
  assert.equal(sell2.realizedPaise, 26000);
  assert.equal(lots[0].units, 0);                     // Lot 1 exhausted
  assert.equal(lots[1].units, 7);                     // Lot 2 has 7 units left

  // 3. Unrealized P&L on remaining 7 units if current market price is ₹130.00 (13000 paise)
  const remainingUnits = lots.reduce((acc, l) => acc + l.units, 0);
  const remainingCostBasis = lots.reduce((acc, l) => acc + l.units * l.unitCostPaise, 0);
  const currentMarketValue = remainingUnits * 13000;
  const unrealizedPaise = currentMarketValue - remainingCostBasis;

  assert.equal(remainingUnits, 7);
  assert.equal(remainingCostBasis, 7 * 12000); // 84,000 paise (₹840.00)
  assert.equal(currentMarketValue, 7 * 13000); // 91,000 paise (₹910.00)
  assert.equal(unrealizedPaise, 7000);         // ₹70.00 unrealized profit
});
