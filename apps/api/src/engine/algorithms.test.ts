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

test("linearSearch: correctly filters items and returns matches", () => {
  const items = [
    { id: 1, symbol: "DOGE", side: "BUY", pricePaise: 2000 },
    { id: 2, symbol: "XRP", side: "SELL", pricePaise: 22000 },
    { id: 3, symbol: "DOGE", side: "SELL", pricePaise: 2050 },
    { id: 4, symbol: "ADA", side: "BUY", pricePaise: 6000 }
  ];

  // Empty list
  assert.deepEqual(linearSearch([], () => true), []);

  // No match
  assert.deepEqual(linearSearch(items, x => x.symbol === "BTC"), []);

  // Single match
  const xrp = linearSearch(items, x => x.symbol === "XRP");
  assert.equal(xrp.length, 1);
  assert.equal(xrp[0].id, 2);

  // Multiple matches
  const doge = linearSearch(items, x => x.symbol === "DOGE");
  assert.deepEqual(doge.map(d => d.id), [1, 3]);

  // linearSearchFirst
  const firstSell = linearSearchFirst(items, x => x.side === "SELL");
  assert.deepEqual(firstSell, { item: items[1], index: 1 });

  const notFound = linearSearchFirst(items, x => x.symbol === "ETH");
  assert.equal(notFound, undefined);
});

test("binarySearch: finds elements in O(log n) time and returns undefined when not found", () => {
  const sorted = [
    { id: 10, name: "order-10" },
    { id: 25, name: "order-25" },
    { id: 40, name: "order-40" },
    { id: 55, name: "order-55" },
    { id: 70, name: "order-70" },
    { id: 90, name: "order-90" }
  ];

  // Empty array
  assert.equal(binarySearch([], 10, x => (x as any).id), undefined);

  // Found at first element
  const first = binarySearch(sorted, 10, x => x.id);
  assert.deepEqual(first, { item: sorted[0], index: 0 });

  // Found in middle
  const mid = binarySearch(sorted, 40, x => x.id);
  assert.deepEqual(mid, { item: sorted[2], index: 2 });

  // Found at last element
  const last = binarySearch(sorted, 90, x => x.id);
  assert.deepEqual(last, { item: sorted[5], index: 5 });

  // Target below minimum
  assert.equal(binarySearch(sorted, 5, x => x.id), undefined);

  // Target above maximum
  assert.equal(binarySearch(sorted, 100, x => x.id), undefined);

  // Target between elements (in gap)
  assert.equal(binarySearch(sorted, 30, x => x.id), undefined);
  assert.equal(binarySearch(sorted, 50, x => x.id), undefined);
});

const sortAlgorithms = [
  { name: "Bubble sort", fn: bubbleSort },
  { name: "Selection sort", fn: selectionSort },
  { name: "Insertion sort", fn: insertionSort },
  { name: "Merge sort", fn: mergeSort },
  { name: "Quick sort", fn: quickSort }
];

for (const { name, fn } of sortAlgorithms) {
  test(`${name}: correctly sorts empty, singleton, already sorted, reverse, and duplicate arrays`, () => {
    const numCmp = (a: number, b: number) => a - b;

    // Empty array
    assert.deepEqual(fn([], numCmp), []);

    // Singleton
    assert.deepEqual(fn([42], numCmp), [42]);

    // Already sorted
    assert.deepEqual(fn([1, 2, 3, 4, 5], numCmp), [1, 2, 3, 4, 5]);

    // Reverse sorted
    assert.deepEqual(fn([5, 4, 3, 2, 1], numCmp), [1, 2, 3, 4, 5]);

    // Duplicates and negative numbers
    assert.deepEqual(fn([3, -1, 4, 1, 5, -1, 9, 2, 6, 5, 3, 5], numCmp), [-1, -1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]);

    // Complex trade objects sorted by price
    const trades = [
      { id: 1, pricePaise: 25000, quantity: 2 },
      { id: 2, pricePaise: 12000, quantity: 5 },
      { id: 3, pricePaise: 18000, quantity: 1 },
      { id: 4, pricePaise: 12000, quantity: 10 }
    ];

    const sortedTrades = fn([...trades], (a, b) => a.pricePaise - b.pricePaise);
    assert.deepEqual(sortedTrades.map(t => t.pricePaise), [12000, 12000, 18000, 25000]);

    // Verify against 100 pseudo-random numbers
    const randomArray = Array.from({ length: 100 }, (_, i) => (i * 37 + 13) % 1000);
    const expected = [...randomArray].sort(numCmp);
    const actual = fn([...randomArray], numCmp);
    assert.deepEqual(actual, expected);
  });
}
