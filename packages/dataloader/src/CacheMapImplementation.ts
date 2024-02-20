import {AsyncCacheMap, CacheMap, CacheMapInput, KeyPrefix} from './types';

const supportsDeleteSpreadCache = new WeakMap<Function, boolean>();

function supportsDeleteSpreadUncached<TKey, TValue>(
  cacheMap: CacheMapInput<TKey, TValue>,
): boolean {
  return /^[^={]*\.\.\./.test(cacheMap.delete.toString());
}

function supportsDeleteSpread<TKey, TValue>(
  cacheMap: CacheMapInput<TKey, TValue>,
): boolean {
  if (cacheMap.constructor === Map || cacheMap.constructor === WeakMap) {
    return false;
  }
  if (cacheMap.constructor === Object || cacheMap.constructor === Function) {
    return supportsDeleteSpreadUncached(cacheMap);
  }

  const cached = supportsDeleteSpreadCache.get(cacheMap.constructor);
  if (cached !== undefined) return cached;

  const freshValue = supportsDeleteSpreadUncached(cacheMap);
  supportsDeleteSpreadCache.set(cacheMap.constructor, freshValue);
  return freshValue;
}

class CacheMapImplementation<TKey, TResult, TMappedKey>
  implements CacheMap<TKey, TResult>
{
  private readonly _map: CacheMapInput<TMappedKey, TResult>;
  private readonly _mapKey: (key: TKey) => TMappedKey;
  private readonly _supportsDeleteSpread: boolean;
  constructor(
    map: CacheMapInput<TMappedKey, TResult>,
    mapKey: (key: TKey) => TMappedKey,
  ) {
    this._map = map;
    this._mapKey = mapKey;
    this._supportsDeleteSpread = supportsDeleteSpread(map);
  }

  get size() {
    return this._map.size;
  }
  get(key: TKey): TResult | undefined {
    const cacheKey = this._mapKey(key);
    return this._map.get(cacheKey);
  }
  set(key: TKey, value: TResult): void {
    const cacheKey = this._mapKey(key);
    this._map.set(cacheKey, value);
  }
  deletePrefix(prefix: KeyPrefix<TKey>): void {
    if (this._map.deletePrefix) {
      this._map.deletePrefix(prefix as any);
    } else if (this._map.keys && typeof prefix === 'string') {
      for (const key of this._map.keys()) {
        const k: unknown = key;
        if (typeof k !== 'string') {
          throw new Error(
            `This cache contains non-string keys so you cannot use deletePrefix.`,
          );
        }
        if (k.startsWith(prefix)) {
          this._map.delete(key);
        }
      }
    } else {
      throw new Error(`This cache does not support deletePrefix.`);
    }
  }
  delete(...keys: TKey[]): void {
    if (!this._supportsDeleteSpread || keys.length < 2) {
      for (const key of keys) {
        const cacheKey = this._mapKey(key);
        this._map.delete(cacheKey);
      }
    } else {
      const cacheKeys = keys.map(this._mapKey);
      this._map.delete(...cacheKeys);
    }
  }
  clear(): void {
    if (!this._map.clear) {
      throw new Error(`This cache does not support clearing`);
    }
    this._map.clear();
  }
}
export function createCacheMap<TKey, TValue, TMappedKey = TKey>(
  map: CacheMapInput<TMappedKey, TValue>,
  mapKey: (key: TKey) => TMappedKey,
): CacheMap<TKey, TValue> {
  return new CacheMapImplementation(map, mapKey);
}

class AsyncCacheMapImplementation<TKey, TResult, TMappedKey>
  extends CacheMapImplementation<TKey, Promise<TResult>, TMappedKey>
  implements AsyncCacheMap<TKey, TResult>
{
  set(key: TKey, value: TResult | Promise<TResult>): void {
    super.set(key, Promise.resolve(value));
  }
}
export function createAsyncCacheMap<TKey, TValue, TMappedKey = TKey>(
  map: CacheMapInput<TMappedKey, Promise<TValue>>,
  mapKey: (key: TKey) => TMappedKey,
): AsyncCacheMap<TKey, TValue> {
  return new AsyncCacheMapImplementation(map, mapKey);
}
