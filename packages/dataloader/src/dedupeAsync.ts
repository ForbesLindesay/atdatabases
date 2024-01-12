import {AsyncCacheMap, CacheMapInput} from './types';

export interface DedupedAsyncFunction<TKey, TResult> {
  (key: TKey): Promise<TResult>;
  cache: AsyncCacheMap<TKey, TResult>;
}

export interface DedupeAsyncOptionsWithMapKey<TKey, TResult, TMappedKey> {
  cache?: CacheMapInput<TMappedKey, Promise<TResult>>;
  mapKey: (key: TKey) => TMappedKey;
  shouldCache?: (value: TResult, key: TKey) => boolean;
}

export interface DedupeAsyncOptionsWithoutMapKey<TKey, TResult> {
  cache?: CacheMapInput<TKey, Promise<TResult>>;
  mapKey?: undefined;
  shouldCache?: (value: TResult, key: TKey) => boolean;
}

export interface DedupeAsyncOptionsWithCache<TKey, TResult> {
  cache: CacheMapInput<TKey, Promise<TResult>>;
  mapKey?: undefined;
  shouldCache?: (value: TResult, key: TKey) => boolean;
}

export type DedupeAsyncOptions<TKey, TResult, TMappedKey> =
  | DedupeAsyncOptionsWithMapKey<TKey, TResult, TMappedKey>
  | DedupeAsyncOptionsWithoutMapKey<TKey, TResult>;

/**
 * dedupeAsync wraps a function that returns a Promise and deduplicates
 * calls to the function with the same key.
 */
export default function dedupeAsync<TKey, TResult, TMappedKey = TKey>(
  fn: (key: TKey) => Promise<TResult>,
  options?: DedupeAsyncOptions<TKey, TResult, TMappedKey>,
): DedupedAsyncFunction<TKey, TResult> {
  const {cache, mapKey, shouldCache} = normalizeDedupeAsyncOptions(options);
  return Object.assign(
    (key: TKey): Promise<TResult> => {
      const cacheKey = mapKey(key);
      const cached = cache.get(cacheKey);
      if (cached !== undefined) return cached;
      const fresh = fn(key).then(
        (result) => {
          if (!shouldCache(result, key)) {
            cache.delete(cacheKey);
          }
          return result;
        },
        (ex) => {
          cache.delete(cacheKey);
          throw ex;
        },
      );
      cache.set(cacheKey, fresh);
      return fresh;
    },
    {cache: new AsyncCacheMapImplementation(cache, mapKey)},
  );
}

interface NormalizedDedupeAsyncOptions<TKey, TResult, TMappedKey> {
  cache: CacheMapInput<TMappedKey, Promise<TResult>>;
  mapKey: (key: TKey) => TMappedKey;
  shouldCache: (value: TResult, key: TKey) => boolean;
}
const identityFn = <T>(arg: T): T => arg;
const trueFn = (): true => true;
function normalizeDedupeAsyncOptions<TKey, TResult, TMappedKey>(
  options?: DedupeAsyncOptions<TKey, TResult, TMappedKey>,
): NormalizedDedupeAsyncOptions<TKey, TResult, TMappedKey> {
  return {
    // @ts-expect-error If not using mapKey, then TMappedKey is TKey
    cache: options?.cache ?? new Map(),
    // @ts-expect-error If not using mapKey, then TMappedKey is TKey
    mapKey: options?.mapKey ?? identityFn,
    shouldCache: options?.shouldCache ?? trueFn,
  };
}

class AsyncCacheMapImplementation<TKey, TResult, TMappedKey>
  implements AsyncCacheMap<TKey, TResult>
{
  private readonly _map: CacheMapInput<TMappedKey, Promise<TResult>>;
  private readonly _mapKey: (key: TKey) => TMappedKey;
  constructor(
    map: CacheMapInput<TMappedKey, Promise<TResult>>,
    mapKey: (key: TKey) => TMappedKey,
  ) {
    this._map = map;
    this._mapKey = mapKey;
  }

  get size() {
    return this._map.size;
  }
  get(key: TKey): Promise<TResult> | undefined {
    const cacheKey = this._mapKey(key);
    return this._map.get(cacheKey);
  }
  set(key: TKey, value: TResult | Promise<TResult>): void {
    const cacheKey = this._mapKey(key);
    this._map.set(cacheKey, Promise.resolve(value));
  }
  delete(key: TKey): void {
    const cacheKey = this._mapKey(key);
    this._map.delete(cacheKey);
  }
  clear(): void {
    if (!this._map.clear) {
      throw new Error(`This cache does not support clearing`);
    }
    this._map.clear();
  }
}
