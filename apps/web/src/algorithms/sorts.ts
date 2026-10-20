/**
 * Sorting algorithms for PriceTime web reports.
 * Pure implementations without relying on Array.prototype.sort().
 */

export type Comparator<T> = (a: T, b: T) => number;

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
  items.splice(0, items.length, ...sorted);
  return items;
}

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
