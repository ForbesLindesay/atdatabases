// Implementation of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/groupToMap
// This may be removed (in a major version) once node.js supports Array.groupToMap

export default function groupToMap<TValue, TKey>(
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
