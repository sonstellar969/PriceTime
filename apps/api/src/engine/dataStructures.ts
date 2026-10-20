/**
 * Core Data Structures for PriceTime exchange engine and coursework.
 */

/** Node in a circular linked list */
export class CircularListNode<T> {
  value: T;
  next: CircularListNode<T>;

  constructor(value: T, next?: CircularListNode<T>) {
    this.value = value;
    this.next = next ?? this;
  }
}

/**
 * Circular Linked List with fixed or maximum capacity.
 * The tail node's `next` pointer always points directly to the `head` node:
 *   tail.next === head
 * When the list reaches capacity, the oldest element (head) is overwritten in-place
 * and head/tail advance by one step, maintaining the circular invariant in O(1) time
 * with zero additional node allocation after reaching capacity.
 */
export class CircularLinkedList<T> {
  private headNode?: CircularListNode<T>;
  private tailNode?: CircularListNode<T>;
  private currentSize = 0;

  constructor(public readonly capacity: number = 20) {
    if (capacity <= 0) {
      throw new Error("CircularLinkedList capacity must be greater than zero");
    }
  }

  get head(): CircularListNode<T> | undefined {
    return this.headNode;
  }

  get tail(): CircularListNode<T> | undefined {
    return this.tailNode;
  }

  get size(): number {
    return this.currentSize;
  }

  get isEmpty(): boolean {
    return this.currentSize === 0;
  }

  append(value: T): void {
    if (!this.headNode || !this.tailNode) {
      const node = new CircularListNode<T>(value);
      node.next = node;
      this.headNode = node;
      this.tailNode = node;
      this.currentSize = 1;
      return;
    }

    if (this.currentSize < this.capacity) {
      // Append new node before wrapping back to head
      const node = new CircularListNode<T>(value, this.headNode);
      this.tailNode.next = node;
      this.tailNode = node;
      this.currentSize++;
    } else {
      // At capacity: overwrite the oldest node (current headNode),
      // then advance tailNode and headNode forward by 1.
      // Notice: tailNode.next remains headNode!
      this.headNode.value = value;
      this.tailNode = this.headNode;
      this.headNode = this.headNode.next;
    }
  }

  /**
   * Returns items in chronological insertion order (oldest to newest).
   */
  toArray(): T[] {
    if (!this.headNode || this.currentSize === 0) return [];
    const result: T[] = [];
    let current = this.headNode;
    for (let i = 0; i < this.currentSize; i++) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  /**
   * Calculates moving average for numeric circular lists.
   */
  average(this: CircularLinkedList<number>): number | undefined {
    if (this.currentSize === 0 || !this.headNode) return undefined;
    let sum = 0;
    let current = this.headNode;
    for (let i = 0; i < this.currentSize; i++) {
      sum += current.value;
      current = current.next;
    }
    return Math.round(sum / this.currentSize);
  }

  clear(): void {
    this.headNode = undefined;
    this.tailNode = undefined;
    this.currentSize = 0;
  }
}

/** Node in a singly linked stack */
export class StackNode<T> {
  constructor(public value: T, public next?: StackNode<T>) {}
}

/**
 * Singly linked Stack (LIFO: Last-In, First-Out).
 * Provides O(1) push, pop, and peek operations without relying on array resizing.
 */
export class Stack<T> {
  private topNode?: StackNode<T>;
  private count = 0;

  get top(): StackNode<T> | undefined {
    return this.topNode;
  }

  get size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  push(value: T): void {
    this.topNode = new StackNode(value, this.topNode);
    this.count++;
  }

  pop(): T | undefined {
    if (!this.topNode) return undefined;
    const val = this.topNode.value;
    this.topNode = this.topNode.next;
    this.count--;
    return val;
  }

  peek(): T | undefined {
    return this.topNode?.value;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.topNode;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  clear(): void {
    this.topNode = undefined;
    this.count = 0;
  }
}

/** Node in a doubly linked queue */
export class QueueNode<T> {
  prev?: QueueNode<T>;
  next?: QueueNode<T>;
  constructor(public value: T) {}
}

/**
 * Generic Doubly Linked Queue (FIFO: First-In, First-Out).
 * Supports O(1) enqueue at tail, O(1) dequeue at head,
 * and O(1) unlinking of arbitrary nodes for fast cancellation.
 */
export class DoublyLinkedQueue<T> {
  head?: QueueNode<T>;
  tail?: QueueNode<T>;
  private count = 0;

  get size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  enqueue(value: T): QueueNode<T> {
    const node = new QueueNode(value);
    node.prev = this.tail;
    node.next = undefined;
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
    this.count++;
    return node;
  }

  dequeue(): T | undefined {
    if (!this.head) return undefined;
    const node = this.head;
    this.unlink(node);
    return node.value;
  }

  peek(): T | undefined {
    return this.head?.value;
  }

  unlink(node: QueueNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = undefined;
    node.next = undefined;
    this.count--;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  clear(): void {
    this.head = undefined;
    this.tail = undefined;
    this.count = 0;
  }
}
