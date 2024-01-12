/**
 * Implementation of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/groupToMap
 * This may be removed (in a major version) once node.js supports Array.groupToMap
 */
function groupToMap<TValue, TKey>(
  list: readonly TValue[],
  keyGetter: (item: TValue, index: number, list: readonly TValue[]) => TKey,
): Map<TKey, TValue[]> {
  const map = new Map<TKey, TValue[]>();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const key = keyGetter(item, i, list);
    const collection = map.get(key);
    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  }
  return map;
}

const EMPTY_ARRAY: readonly [] = [];
export function groupBy<TValue, TKey>(
  list: readonly TValue[],
  keyGetter: (item: TValue, index: number, list: readonly TValue[]) => TKey,
): (key: TKey) => readonly TValue[] {
  const map = groupToMap(list, keyGetter);
  return (key): readonly TValue[] => map.get(key) ?? EMPTY_ARRAY;
}

export function parametersSpreadToArray<TParameters extends unknown[], TResult>(
  fn: (args: TParameters) => TResult,
): (...args: TParameters) => TResult {
  return (...args) => fn(args);
}

export function parametersArrayToSpread<TParameters extends unknown[], TResult>(
  fn: (...args: TParameters) => TResult,
): (args: TParameters) => TResult {
  return (args) => fn(...args);
}
