/**
 * Core Search and Sorting Algorithms for PriceTime coursework and exchange operations.
 * Pure implementations without relying on Array.prototype.sort().
 */

export type Comparator<T> = (a: T, b: T) => number;

/**
 * Linear Search:
 * Scans an array sequentially from index 0 to length - 1.
 * Time complexity: O(n) worst/average case, O(1) best case.
 * Space complexity: O(1) auxiliary (excluding matched results array).
 */
export function linearSearch<T>(items: readonly T[], predicate: (item: T, index: number) => boolean): T[] {
  const matches: T[] = [];
  for (let i = 0; i < items.length; i++) {
    if (predicate(items[i], i)) {
      matches.push(items[i]);
    }
  }
  return matches;
}

/**
 * Linear search returning the first matching element and its index, or undefined if not found.
 */
export function linearSearchFirst<T>(
  items: readonly T[],
  predicate: (item: T, index: number) => boolean
): { item: T; index: number } | undefined {
  for (let i = 0; i < items.length; i++) {
    if (predicate(items[i], i)) {
      return { item: items[i], index: i };
    }
  }
  return undefined;
}

/**
 * Binary Search:
 * Searches a sorted array for an element matching `target` using a monotonic numeric key selector.
 * Time complexity: O(log n) worst/average case, O(1) best case.
 * Space complexity: O(1) auxiliary.
 */
export function binarySearch<T>(
  sortedItems: readonly T[],
  target: number,
  keySelector: (item: T) => number
): { item: T; index: number } | undefined {
  let low = 0;
  let high = sortedItems.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = sortedItems[mid];
    const candidateKey = keySelector(candidate);

    if (candidateKey === target) {
      return { item: candidate, index: mid };
    }
    if (candidateKey < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return undefined;
}

/**
 * Bubble Sort:
 * Repeatedly steps through the list, compares adjacent elements, and swaps them if in wrong order.
 * Includes early-exit optimization when no swaps occur.
 * Time complexity: O(n^2) worst/average case, O(n) best case (already sorted).
 * Space complexity: O(1) in-place auxiliary (returns mutated or cloned array).
 */
export function bubbleSort<T>(items: T[], cmp: Comparator<T>): T[] {
  const n = items.length;
  for (let end = n - 1; end > 0; end--) {
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (cmp(items[i], items[i + 1]) > 0) {
        const temp = items[i];
        items[i] = items[i + 1];
        items[i + 1] = temp;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return items;
}

/**
 * Selection Sort:
 * In-place comparison sort that divides input into sorted and unsorted regions,
 * repeatedly selecting the minimum unsorted element and swapping to the front.
 * Time complexity: O(n^2) all cases.
 * Space complexity: O(1) auxiliary.
 */
export function selectionSort<T>(items: T[], cmp: Comparator<T>): T[] {
  const n = items.length;
  for (let i = 0; i < n - 1; i++) {
    let minIndex = i;
    for (let j = i + 1; j < n; j++) {
      if (cmp(items[j], items[minIndex]) < 0) {
        minIndex = j;
      }
    }
    if (minIndex !== i) {
      const temp = items[i];
      items[i] = items[minIndex];
      items[minIndex] = temp;
    }
  }
  return items;
}

/**
 * Insertion Sort:
 * Builds the final sorted array one item at a time by inserting each into its proper position.
 * Efficient for small datasets and partially sorted data.
 * Time complexity: O(n^2) worst/average case, O(n) best case.
 * Space complexity: O(1) auxiliary.
 */
export function insertionSort<T>(items: T[], cmp: Comparator<T>): T[] {
  for (let i = 1; i < items.length; i++) {
    const current = items[i];
    let j = i - 1;
    while (j >= 0 && cmp(items[j], current) > 0) {
      items[j + 1] = items[j];
      j--;
    }
    items[j + 1] = current;
  }
  return items;
}

/**
 * Merge Sort:
 * Divide-and-conquer algorithm that recursively divides array into two halves,
 * sorts each half, and merges the sorted halves.
 * Time complexity: O(n log n) all cases.
 * Space complexity: O(n) auxiliary.
 */
export function mergeSort<T>(items: T[], cmp: Comparator<T>): T[] {
  if (items.length < 2) return items;

  function merge(left: T[], right: T[]): T[] {
    const result: T[] = [];
    let l = 0;
    let r = 0;

    while (l < left.length && r < right.length) {
      if (cmp(left[l], right[r]) <= 0) {
        result.push(left[l]);
        l++;
      } else {
        result.push(right[r]);
        r++;
      }
    }

    while (l < left.length) {
      result.push(left[l]);
      l++;
    }
    while (r < right.length) {
      result.push(right[r]);
      r++;
    }

    return result;
  }

  function sort(arr: T[]): T[] {
    if (arr.length < 2) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = sort(arr.slice(0, mid));
    const right = sort(arr.slice(mid));
    return merge(left, right);
  }

  const sorted = sort(items);
  // Mutate original array to match in-place signature while preserving returned reference
  items.splice(0, items.length, ...sorted);
  return items;
}

/**
 * Quick Sort:
 * Divide-and-conquer algorithm partitioning around a pivot with Hoare partition scheme.
 * Time complexity: O(n log n) average case, O(n^2) worst case.
 * Space complexity: O(log n) call stack.
 */
export function quickSort<T>(items: T[], cmp: Comparator<T>): T[] {
  function partition(low: number, high: number): void {
    if (low >= high) return;

    const pivot = items[Math.floor((low + high) / 2)];
    let i = low;
    let j = high;

    while (i <= j) {
      while (cmp(items[i], pivot) < 0) i++;
      while (cmp(items[j], pivot) > 0) j--;
      if (i <= j) {
        const temp = items[i];
        items[i] = items[j];
        items[j] = temp;
        i++;
        j--;
      }
    }

    if (low < j) partition(low, j);
    if (i < high) partition(i, high);
  }

  if (items.length > 1) {
    partition(0, items.length - 1);
  }
  return items;
}
