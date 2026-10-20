import test from "node:test";
import assert from "node:assert/strict";
import { CircularLinkedList, Stack, DoublyLinkedQueue } from "./dataStructures.js";

test("CircularLinkedList: empty list properties and edge cases", () => {
  const cll = new CircularLinkedList<number>(5);
  assert.equal(cll.isEmpty, true);
  assert.equal(cll.size, 0);
  assert.equal(cll.head, undefined);
  assert.equal(cll.tail, undefined);
  assert.deepEqual(cll.toArray(), []);
  assert.equal(cll.average(), undefined);

  assert.throws(() => new CircularLinkedList<number>(0), /capacity must be greater than zero/i);
});

test("CircularLinkedList: single item has head === tail and tail.next === head", () => {
  const cll = new CircularLinkedList<number>(5);
  cll.append(100);
  assert.equal(cll.isEmpty, false);
  assert.equal(cll.size, 1);
  assert.equal(cll.head?.value, 100);
  assert.equal(cll.tail?.value, 100);
  assert.equal(cll.head, cll.tail);
  assert.equal(cll.tail?.next, cll.head);
  assert.deepEqual(cll.toArray(), [100]);
  assert.equal(cll.average(), 100);
});

test("CircularLinkedList: multiple items maintain circular invariant tail.next === head", () => {
  const cll = new CircularLinkedList<number>(5);
  cll.append(10);
  cll.append(20);
  cll.append(30);

  assert.equal(cll.size, 3);
  assert.equal(cll.head?.value, 10);
  assert.equal(cll.tail?.value, 30);
  assert.equal(cll.tail?.next, cll.head);

  // Traverse through cycle
  const node0 = cll.head!;
  const node1 = node0.next;
  const node2 = node1.next;
  const backToHead = node2.next;

  assert.equal(node0.value, 10);
  assert.equal(node1.value, 20);
  assert.equal(node2.value, 30);
  assert.equal(backToHead, cll.head);

  assert.deepEqual(cll.toArray(), [10, 20, 30]);
  assert.equal(cll.average(), 20); // (10 + 20 + 30) / 3 = 20
});

test("CircularLinkedList: wraparound at capacity overwrites oldest element and preserves circular invariant", () => {
  const capacity = 3;
  const cll = new CircularLinkedList<number>(capacity);

  cll.append(1);
  cll.append(2);
  cll.append(3);
  assert.equal(cll.size, 3);
  assert.deepEqual(cll.toArray(), [1, 2, 3]);
  assert.equal(cll.tail?.next, cll.head);

  // Appending 4 overwrites 1
  cll.append(4);
  assert.equal(cll.size, 3);
  assert.deepEqual(cll.toArray(), [2, 3, 4]);
  assert.equal(cll.head?.value, 2);
  assert.equal(cll.tail?.value, 4);
  assert.equal(cll.tail?.next, cll.head);

  // Appending 5 overwrites 2
  cll.append(5);
  assert.equal(cll.size, 3);
  assert.deepEqual(cll.toArray(), [3, 4, 5]);
  assert.equal(cll.head?.value, 3);
  assert.equal(cll.tail?.value, 5);
  assert.equal(cll.tail?.next, cll.head);

  // Verify moving average calculation
  assert.equal(cll.average(), 4); // (3 + 4 + 5) / 3 = 4

  // Verify clear resets everything
  cll.clear();
  assert.equal(cll.size, 0);
  assert.equal(cll.head, undefined);
  assert.equal(cll.tail, undefined);
  assert.deepEqual(cll.toArray(), []);
});

test("Stack: LIFO linked stack operations (empty, single, multiple)", () => {
  const stack = new Stack<string>();
  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.size, 0);
  assert.equal(stack.peek(), undefined);
  assert.equal(stack.pop(), undefined);
  assert.deepEqual(stack.toArray(), []);

  // Single item
  stack.push("alpha");
  assert.equal(stack.isEmpty(), false);
  assert.equal(stack.size, 1);
  assert.equal(stack.peek(), "alpha");
  assert.deepEqual(stack.toArray(), ["alpha"]);

  // Multiple items
  stack.push("beta");
  stack.push("gamma");
  assert.equal(stack.size, 3);
  assert.equal(stack.peek(), "gamma");
  assert.deepEqual(stack.toArray(), ["gamma", "beta", "alpha"]);

  // LIFO pop order
  assert.equal(stack.pop(), "gamma");
  assert.equal(stack.size, 2);
  assert.equal(stack.peek(), "beta");

  assert.equal(stack.pop(), "beta");
  assert.equal(stack.pop(), "alpha");
  assert.equal(stack.pop(), undefined);
  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.size, 0);

  // Clear test
  stack.push("x");
  stack.push("y");
  stack.clear();
  assert.equal(stack.size, 0);
  assert.equal(stack.peek(), undefined);
});

test("DoublyLinkedQueue: FIFO queue operations and O(1) unlinking", () => {
  const queue = new DoublyLinkedQueue<number>();
  assert.equal(queue.isEmpty(), true);
  assert.equal(queue.size, 0);
  assert.equal(queue.peek(), undefined);
  assert.equal(queue.dequeue(), undefined);

  const n1 = queue.enqueue(10);
  const n2 = queue.enqueue(20);
  const n3 = queue.enqueue(30);

  assert.equal(queue.size, 3);
  assert.equal(queue.peek(), 10);
  assert.deepEqual(queue.toArray(), [10, 20, 30]);

  // Unlink middle node (20)
  queue.unlink(n2);
  assert.equal(queue.size, 2);
  assert.deepEqual(queue.toArray(), [10, 30]);

  // Dequeue head (10)
  assert.equal(queue.dequeue(), 10);
  assert.equal(queue.size, 1);
  assert.equal(queue.peek(), 30);

  // Unlink remaining tail (30)
  queue.unlink(n3);
  assert.equal(queue.isEmpty(), true);
  assert.equal(queue.size, 0);
  assert.deepEqual(queue.toArray(), []);
});
