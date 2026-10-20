import test from "node:test";
import assert from "node:assert/strict";
import { OrderBook, type OrderInput } from "./orderBook.js";
import { arrayReplay } from "../function.js";

test("OrderBook: integrates CircularLinkedList and verifies tail.next === head pointer invariant", () => {
  const book = new OrderBook("DOGE");
  const cll = book.recentPricesList;

  assert.equal(cll.size, 0);
  assert.equal(book.movingAverage(), undefined);

  // Submit 5 trades
  for (let i = 1; i <= 5; i++) {
    book.submit({ traderId: "seller", symbol: "DOGE", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 2000 + i * 10 });
    book.submit({ traderId: "buyer", symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 2000 + i * 10 });
  }

  assert.equal(cll.size, 5);
  assert.equal(cll.tail?.next, cll.head);
  assert.equal(cll.head?.value, 2010);
  assert.equal(cll.tail?.value, 2050);
  assert.equal(book.movingAverage(), 2030); // (2010+2020+2030+2040+2050)/5 = 2030

  // Fill beyond capacity 20 to test wraparound
  for (let i = 6; i <= 25; i++) {
    book.submit({ traderId: "seller", symbol: "DOGE", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 2000 + i * 10 });
    book.submit({ traderId: "buyer", symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 2000 + i * 10 });
  }

  assert.equal(cll.size, 20);
  assert.equal(cll.tail?.next, cll.head);
  // Oldest remaining is i=6 (2060) and newest is i=25 (2250)
  assert.equal(cll.head?.value, 2060);
  assert.equal(cll.tail?.value, 2250);
});

test("OrderBook: tracks action history with a linked Stack (LIFO)", () => {
  const book = new OrderBook("XRP");
  assert.equal(book.auditStack.isEmpty(), true);

  const res1 = book.submit({ traderId: "trader-1", symbol: "XRP", side: "SELL", type: "LIMIT", quantity: 10, pricePaise: 22000 });
  const res2 = book.submit({ traderId: "trader-2", symbol: "XRP", side: "BUY", type: "LIMIT", quantity: 5, pricePaise: 21900 });

  assert.equal(book.auditStack.size, 2);
  assert.equal(book.peekLastAction()?.orderId, res2.order.id);
  assert.equal(book.peekLastAction()?.kind, "SUBMIT");

  // Cancel first order
  book.cancel(res1.order.id);
  assert.equal(book.auditStack.size, 3);
  const actions = book.getActionHistory();
  assert.equal(actions.length, 3);
  assert.equal(actions[0].kind, "CANCEL");
  assert.equal(actions[0].orderId, res1.order.id);
  assert.equal(actions[1].kind, "SUBMIT");
  assert.equal(actions[1].orderId, res2.order.id);
  assert.equal(actions[2].kind, "SUBMIT");
  assert.equal(actions[2].orderId, res1.order.id);
});

test("OrderBook: binarySearch findOrder locates order IDs in O(log n)", () => {
  const book = new OrderBook("ADA");
  const orders = [];
  for (let i = 0; i < 10; i++) {
    const res = book.submit({ traderId: `t-${i}`, symbol: "ADA", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 6000 + i * 10 });
    orders.push(res.order);
  }

  // Find first, middle, last
  assert.equal(book.findOrder(orders[0].id)?.id, orders[0].id);
  assert.equal(book.findOrder(orders[5].id)?.id, orders[5].id);
  assert.equal(book.findOrder(orders[9].id)?.id, orders[9].id);

  // Non-existent orders
  assert.equal(book.findOrder(0), undefined);
  assert.equal(book.findOrder(9999), undefined);
  assert.equal(book.findOrder(-5), undefined);
});

test("OrderBook: market order with NO liquidity is rejected", () => {
  const book = new OrderBook("TRX");

  // Market BUY when there are no asks
  const buyRes = book.submit({ traderId: "buyer", symbol: "TRX", side: "BUY", type: "MARKET", quantity: 10 });
  assert.equal(buyRes.trades.length, 0);
  assert.equal(buyRes.order.status, "REJECTED");
  assert.equal(buyRes.order.remaining, 10);

  // Market SELL when there are no bids
  const sellRes = book.submit({ traderId: "seller", symbol: "TRX", side: "SELL", type: "MARKET", quantity: 5 });
  assert.equal(sellRes.trades.length, 0);
  assert.equal(sellRes.order.status, "REJECTED");
  assert.equal(sellRes.order.remaining, 5);
});

test("OrderBook: market order with partial liquidity fills available and leaves remainder unfilled", () => {
  const book = new OrderBook("TRX");

  // Resting ask of 4 units
  book.submit({ traderId: "seller", symbol: "TRX", side: "SELL", type: "LIMIT", quantity: 4, pricePaise: 2800 });

  // Market BUY requesting 10 units
  const buyRes = book.submit({ traderId: "buyer", symbol: "TRX", side: "BUY", type: "MARKET", quantity: 10 });
  assert.equal(buyRes.trades.length, 1);
  assert.equal(buyRes.trades[0].quantity, 4);
  assert.equal(buyRes.trades[0].pricePaise, 2800);
  assert.equal(buyRes.order.status, "PARTIALLY_FILLED");
  assert.equal(buyRes.order.remaining, 6);
  assert.equal(book.snapshot().asks.length, 0);

  // Resting bid of 3 units
  book.submit({ traderId: "buyer2", symbol: "TRX", side: "BUY", type: "LIMIT", quantity: 3, pricePaise: 2750 });

  // Market SELL requesting 10 units
  const sellRes = book.submit({ traderId: "seller2", symbol: "TRX", side: "SELL", type: "MARKET", quantity: 10 });
  assert.equal(sellRes.trades.length, 1);
  assert.equal(sellRes.trades[0].quantity, 3);
  assert.equal(sellRes.trades[0].pricePaise, 2750);
  assert.equal(sellRes.order.status, "PARTIALLY_FILLED");
  assert.equal(sellRes.order.remaining, 7);
  assert.equal(book.snapshot().bids.length, 0);
});

test("OrderBook: multi-price level sweep with strict price-time priority", () => {
  const book = new OrderBook("AVAX");

  // 3 sellers at different price levels
  book.submit({ traderId: "s1", symbol: "AVAX", side: "SELL", type: "LIMIT", quantity: 3, pricePaise: 250000 });
  book.submit({ traderId: "s2", symbol: "AVAX", side: "SELL", type: "LIMIT", quantity: 5, pricePaise: 250100 });
  book.submit({ traderId: "s3", symbol: "AVAX", side: "SELL", type: "LIMIT", quantity: 4, pricePaise: 250200 });

  // Buyer submits order crossing all three levels
  const res = book.submit({ traderId: "b1", symbol: "AVAX", side: "BUY", type: "LIMIT", quantity: 10, pricePaise: 250200 });

  assert.equal(res.trades.length, 3);
  assert.deepEqual(
    res.trades.map(t => [t.sellerId, t.quantity, t.pricePaise]),
    [
      ["s1", 3, 250000],
      ["s2", 5, 250100],
      ["s3", 2, 250200]
    ]
  );
  assert.equal(res.order.remaining, 0);
  assert.equal(res.order.status, "FILLED");

  // Remaining level 250200 should have 2 units left
  const snap = book.snapshot();
  assert.equal(snap.bestAsk, 250200);
  assert.equal(snap.asks[0].quantity, 2);
  assert.equal(snap.asks[0].orderCount, 1);
});

test("OrderBook: cancellation edge cases (head, middle, tail, already cancelled, non-existent)", () => {
  const book = new OrderBook("DOGE");

  const o1 = book.submit({ traderId: "t1", symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 2000 });
  const o2 = book.submit({ traderId: "t2", symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 2, pricePaise: 2000 });
  const o3 = book.submit({ traderId: "t3", symbol: "DOGE", side: "BUY", type: "LIMIT", quantity: 3, pricePaise: 2000 });

  // Cancel head (o1)
  assert.equal(book.cancel(o1.order.id), true);
  assert.equal(book.findOrder(o1.order.id)?.status, "CANCELLED");
  assert.equal(book.snapshot().bids[0].quantity, 5);

  // Cancel tail (o3)
  assert.equal(book.cancel(o3.order.id), true);
  assert.equal(book.findOrder(o3.order.id)?.status, "CANCELLED");
  assert.equal(book.snapshot().bids[0].quantity, 2);

  // Cancel sole remaining node (o2) -> removes price level entirely from BST
  assert.equal(book.cancel(o2.order.id), true);
  assert.equal(book.snapshot().bids.length, 0);
  assert.equal(book.snapshot().bestBid, undefined);

  // Cancelling an already cancelled order returns false
  assert.equal(book.cancel(o1.order.id), false);
  assert.equal(book.cancel(o2.order.id), false);

  // Cancelling a non-existent order returns false
  assert.equal(book.cancel(99999), false);
});

test("OrderBook vs arrayReplay: benchmark equivalence test on random order sequence", () => {
  const symbol = "DOGE";
  const inputs: OrderInput[] = [];

  // Generate 60 deterministic test orders
  for (let i = 0; i < 60; i++) {
    const side = i % 2 === 0 ? "BUY" : "SELL";
    const type = i % 5 === 0 ? "MARKET" : "LIMIT";
    const pricePaise = type === "LIMIT" ? 2000 + ((i * 17) % 7) * 10 : undefined;
    const quantity = 1 + (i % 4);
    inputs.push({ traderId: `user-${i}`, symbol, side, type, quantity, pricePaise });
  }

  const book = new OrderBook(symbol);
  for (const o of inputs) book.submit(o);
  const treeTrades = book.trades();

  const arrayTrades = arrayReplay(inputs);

  assert.equal(treeTrades.length, arrayTrades.length, "Trade counts must match");
  for (let i = 0; i < treeTrades.length; i++) {
    assert.equal(treeTrades[i].pricePaise, arrayTrades[i].pricePaise, `Trade ${i} price must match`);
    assert.equal(treeTrades[i].quantity, arrayTrades[i].quantity, `Trade ${i} quantity must match`);
  }
});

test("FIFO lots accounting logic: consumption and realized P/L calculation", () => {
  interface Lot { id: number; quantity: number; unitCostPaise: number }
  const lots: Lot[] = [
    { id: 1, quantity: 10, unitCostPaise: 1000 },
    { id: 2, quantity: 10, unitCostPaise: 1500 }
  ];

  function consumeFifoLots(fillQty: number, fillPricePaise: number) {
    let toSell = fillQty;
    let basis = 0;
    for (let i = 0; i < lots.length && toSell > 0; i++) {
      const lot = lots[i];
      const consumed = Math.min(toSell, lot.quantity);
      basis += consumed * lot.unitCostPaise;
      toSell -= consumed;
      lot.quantity -= consumed;
    }
    // Filter out emptied lots
    const activeLots = lots.filter(l => l.quantity > 0);
    const proceeds = fillQty * fillPricePaise;
    const realized = proceeds - basis;
    return { basis, proceeds, realized, activeLots };
  }

  // Sell 5 @ 2000 paise -> consumes 5 from Lot 1 (basis 5*1000 = 5000)
  const sell1 = consumeFifoLots(5, 2000);
  assert.equal(sell1.basis, 5000);
  assert.equal(sell1.proceeds, 10000);
  assert.equal(sell1.realized, 5000);
  assert.equal(lots[0].quantity, 5); // 5 left in lot 1
  assert.equal(lots[1].quantity, 10);

  // Sell 10 @ 1800 paise -> consumes remaining 5 from Lot 1 (5000) + 5 from Lot 2 (5*1500 = 7500)
  const sell2 = consumeFifoLots(10, 1800);
  assert.equal(sell2.basis, 12500); // 5000 + 7500
  assert.equal(sell2.proceeds, 18000);
  assert.equal(sell2.realized, 5500);
  assert.equal(lots[0].quantity, 0); // lot 1 exhausted
  assert.equal(lots[1].quantity, 5); // 5 left in lot 2 @ 1500
});
