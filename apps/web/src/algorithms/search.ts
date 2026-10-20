/**
 * Search algorithms for PriceTime web reports and UI filtering.
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
