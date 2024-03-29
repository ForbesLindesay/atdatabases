import {createCacheMap} from './CacheMapImplementation';
import {CacheMap, CacheMapInput} from './types';

export interface DedupedSyncFunction<TKey, TResult> {
  (key: TKey): TResult;
  cache: CacheMap<TKey, TResult>;
}

export interface DedupeSyncOptionsWithMapKey<TKey, TResult, TMappedKey> {
  cache?: CacheMapInput<TMappedKey, TResult>;
  mapKey: (key: TKey) => TMappedKey;
  shouldCache?: (value: TResult, key: TKey) => boolean;
  onNewValue?: (value: TResult, key: TKey) => void;
}
export interface DedupeSyncOptionsWithoutMapKey<TKey, TResult> {
  cache?: CacheMapInput<TKey, TResult>;
  mapKey?: undefined;
  shouldCache?: (value: TResult, key: TKey) => boolean;
  onNewValue?: (value: TResult, key: TKey) => void;
}
export type DedupeSyncOptions<TKey, TResult, TMappedKey> =
  | DedupeSyncOptionsWithMapKey<TKey, TResult, TMappedKey>
  | DedupeSyncOptionsWithoutMapKey<TKey, TResult>;

export default function dedupeSync<TKey, TResult, TMappedKey = TKey>(
  fn: (key: TKey) => TResult,
  options?: DedupeSyncOptions<TKey, TResult, TMappedKey>,
): DedupedSyncFunction<TKey, TResult> {
  const {cache, mapKey, shouldCache, onNewValue} =
    normalizeDedupeSyncOptions(options);

  return Object.assign(
    (key: TKey): TResult => {
      const cacheKey = mapKey(key);
      const cached = cache.get(cacheKey);
      if (cached !== undefined) return cached;
      const fresh = fn(key);
      if (fresh !== undefined && shouldCache(fresh, key)) {
        cache.set(cacheKey, fresh);
        onNewValue(fresh, key, cacheKey, cache);
      }
      return fresh;
    },
    {
      cache: createCacheMap(cache, mapKey),
    },
  );
}

interface NormalizedDedupeSyncOptions<TKey, TResult, TMappedKey> {
  cache: CacheMapInput<TMappedKey, TResult>;
  mapKey: (key: TKey) => TMappedKey;
  shouldCache: (value: TResult, key: TKey) => boolean;
  onNewValue: (
    value: TResult,
    key: TKey,
    cacheKey: TMappedKey,
    cache: CacheMapInput<TMappedKey, TResult>,
  ) => void;
}
const identityFn = <T>(arg: T): T => arg;
const trueFn = (): true => true;
const noop = () => {
  // noop
};
function normalizeDedupeSyncOptions<TKey, TResult, TMappedKey>(
  options?: DedupeSyncOptions<TKey, TResult, TMappedKey>,
): NormalizedDedupeSyncOptions<TKey, TResult, TMappedKey> {
  return {
    // @ts-expect-error If not using mapKey, then TMappedKey is TKey
    cache: options?.cache ?? new Map(),
    // @ts-expect-error If not using mapKey, then TMappedKey is TKey
    mapKey: options?.mapKey ?? identityFn,
    shouldCache: options?.shouldCache ?? trueFn,
    onNewValue: options?.onNewValue
      ? addErrorHandler(options.onNewValue)
      : noop,
  };
}
function addErrorHandler<TKey, TResult, TMappedKey>(
  onNewValue: (value: TResult, key: TKey) => void,
): NormalizedDedupeSyncOptions<TKey, TResult, TMappedKey>['onNewValue'] {
  return (value, key, cacheKey, cache) => {
    try {
      onNewValue(value, key);
    } catch (error) {
      cache.delete(cacheKey);
      throw error;
    }
  };
}
