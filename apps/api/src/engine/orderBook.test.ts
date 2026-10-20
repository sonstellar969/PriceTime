import test from "node:test";
import assert from "node:assert/strict";
import { OrderBook } from "./orderBook.js";

test("matches best price first, then FIFO, with partial fills", () => {
  const book = new OrderBook("ACME");
  book.submit({ traderId: "bob", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 5, pricePaise: 10100 });
  book.submit({ traderId: "chen", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 3, pricePaise: 10100 });
  const third = book.submit({ traderId: "divya", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 10, pricePaise: 10200 });
  const result = book.submit({ traderId: "alice", symbol: "ACME", side: "BUY", type: "LIMIT", quantity: 12, pricePaise: 10200 });
  assert.deepEqual(result.trades.map(t => [t.quantity, t.pricePaise]), [[5, 10100], [3, 10100], [4, 10200]]);
  assert.equal(third.order.remaining, 6);
});

test("cancels from the middle of a DLL price queue without breaking FIFO", () => {
  const book = new OrderBook("ACME");
  book.submit({ traderId: "first", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 2, pricePaise: 10100 });
  const middle = book.submit({ traderId: "middle", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 3, pricePaise: 10100 });
  book.submit({ traderId: "last", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 4, pricePaise: 10100 });
  assert.equal(book.cancel(middle.order.id), true);
  const result = book.submit({ traderId: "buyer", symbol: "ACME", side: "BUY", type: "LIMIT", quantity: 6, pricePaise: 10100 });
  assert.deepEqual(result.trades.map(trade => [trade.sellerId, trade.quantity]), [["first", 2], ["last", 4]]);
  assert.deepEqual(book.snapshot().asks, []);
});

test("deletes a BST price level with two children and preserves best prices", () => {
  const book = new OrderBook("ACME");
  const root = book.submit({ traderId: "root", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 10100 });
  book.submit({ traderId: "left", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 10000 });
  book.submit({ traderId: "right", symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 10200 });
  assert.equal(book.cancel(root.order.id), true);
  assert.deepEqual(book.snapshot().asks.map(level => level.pricePaise), [10000, 10200]);
  assert.equal(book.snapshot().bestAsk, 10000);
});

test("circular moving average keeps only the 20 newest execution prices", () => {
  const book = new OrderBook("ACME");
  for (let i = 0; i < 21; i++) {
    book.submit({ traderId: `seller-${i}`, symbol: "ACME", side: "SELL", type: "LIMIT", quantity: 1, pricePaise: 10000 + i });
    book.submit({ traderId: `buyer-${i}`, symbol: "ACME", side: "BUY", type: "LIMIT", quantity: 1, pricePaise: 10000 + i });
  }
  assert.equal(book.snapshot().movingAveragePaise, 10011);
});
