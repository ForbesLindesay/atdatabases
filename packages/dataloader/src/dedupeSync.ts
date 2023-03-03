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
  options: DedupeSyncOptions<TKey, TResult, TMappedKey> = {},
): DedupedSyncFunction<TKey, TResult> {
  // @ts-expect-error If not using mapKey, then TMappedKey is TKey
  const cache: CacheMapInput<TMappedKey, TResult> = options.cache ?? new Map();
  // @ts-expect-error If not using mapKey, then TMappedKey is TKey
  const mapKey: (key: TKey) => TMappedKey =
    options.mapKey ?? ((key: TKey) => key);

  const onNewValue = (
    key: TKey,
    value: TResult,
    mappedKey: TMappedKey,
  ): void => {
    if (!options.onNewValue) return;
    try {
      options.onNewValue(value, key);
    } catch (error) {
      cache.delete(mappedKey);
      throw error;
    }
  };
  return Object.assign(
    (key: TKey): TResult => {
      const cacheKey = mapKey(key);
      const cached = cache.get(cacheKey);
      if (cached !== undefined) return cached;
      const fresh = fn(key);
      cache.set(cacheKey, fresh);
      if (fresh !== undefined) {
        onNewValue(key, fresh, cacheKey);
        if (options.shouldCache && !options.shouldCache(fresh, key)) {
          cache.delete(cacheKey);
        }
      }
      return fresh;
    },
    {
      cache: {
        get size() {
          return cache.size;
        },
        get: (key: TKey): TResult | undefined => {
          const cacheKey = mapKey(key);
          return cache.get(cacheKey);
        },
        set: (key: TKey, value: TResult): void => {
          const cacheKey = mapKey(key);
          cache.set(cacheKey, value);
        },
        delete: (key: TKey): void => {
          const cacheKey = mapKey(key);
          cache.delete(cacheKey);
        },
        clear: (): void => {
          if (!cache.clear) {
            throw new Error(`This cache does not support clearing`);
          }
          cache.clear();
        },
      },
    },
  );
}
