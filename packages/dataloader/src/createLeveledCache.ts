import {CacheMapInput} from './types';

type SubPath<TKeys extends readonly unknown[]> = TKeys extends readonly [
  ...infer THead,
  infer TTail,
]
  ? {readonly [i in keyof TKeys]: TKeys[i]} | SubPath<THead>
  : never;

export interface LeveledCache<TKeys extends readonly unknown[], TValue> {
  readonly size: number | undefined;
  get(key: TKeys): TValue | undefined;
  set(key: TKeys, value: TValue): void;
  delete(key: TKeys | SubPath<TKeys>): void;
  clear(): void;
}

export interface LevelOptionsWithMapKey<TKey, TMappedKey> {
  getCache?: <TValue>() => CacheMapInput<TMappedKey, TValue>;
  mapKey: (key: TKey) => TMappedKey;
}

export interface LevelOptionsWithoutMapKey<TKey> {
  getCache?: <TValue>() => CacheMapInput<TKey, TValue>;
  mapKey?: undefined;
}

export type LevelOptions<TKey, TMappedKey> =
  | LevelOptionsWithMapKey<TKey, TMappedKey>
  | LevelOptionsWithoutMapKey<TKey>;

interface NormalizedLevelOptions<TKey, TMappedKey> {
  getCache: <TValue>() => CacheMapInput<TMappedKey, TValue>;
  mapKey: (key: TKey) => TMappedKey;
}

function normalizeLevelOptions<TKey, TMappedKey = TKey>(
  options?: LevelOptions<TKey, TMappedKey>,
): NormalizedLevelOptions<TKey, TMappedKey> {
  // @ts-expect-error if not using mapKey, then TMappedKey is TKey
  const getCache: <TValue>() => CacheMapInput<TMappedKey, TValue> =
    options?.getCache ?? (() => new Map());
  // @ts-expect-error if not using mapKey, then TMappedKey is TKey
  const mapKey: (key: TKey) => TMappedKey =
    options?.mapKey ?? ((key: TKey) => key);
  return {getCache, mapKey};
}

function createBranchCache<
  TKey,
  TMappedKey,
  TSubKeys extends readonly unknown[],
  TValue,
>([{getCache, mapKey}, ...subOptions]: readonly [
  NormalizedLevelOptions<TKey, TMappedKey>,
  ...{
    readonly [i in keyof TSubKeys]: NormalizedLevelOptions<
      TSubKeys[i],
      unknown
    >;
  },
]): LeveledCache<[TKey, ...TSubKeys], TValue> {
  if (subOptions.length === 0) {
    const cache = getCache<TValue>();
    return {
      get size() {
        return cache.size;
      },
      get(key: [TKey, ...TSubKeys]) {
        return cache.get(mapKey(key[0]));
      },
      set(key: [TKey, ...TSubKeys], value: TValue) {
        cache.set(mapKey(key[0]), value);
      },
      delete(key: [TKey, ...TSubKeys]) {
        cache.delete(mapKey(key[0]));
      },
      clear() {
        if (!cache.clear) {
          throw new Error(`This cache does not support clearing`);
        }
        cache.clear();
      },
    };
  } else {
    const cache = getCache<LeveledCache<TSubKeys, TValue>>();
    return {
      get size() {
        return cache.size;
      },
      get([key, ...subKeys]: [TKey, ...TSubKeys]) {
        const subCache = cache.get(mapKey(key));
        if (!subCache) return undefined;
        return subCache.get(subKeys);
      },
      set([key, ...subKeys]: [TKey, ...TSubKeys], value: TValue) {
        const k = mapKey(key);
        let subCache = cache.get(k);
        if (!subCache) {
          // @ts-expect-error
          const newSubCache: LeveledCache<TSubKeys, TValue> =
            // @ts-expect-error
            createBranchCache(subOptions);
          subCache = newSubCache;
          cache.set(k, subCache);
        }
        subCache.set(subKeys, value);
      },
      delete([key, ...subKeys]: [TKey, ...TSubKeys]) {
        const k = mapKey(key);
        if (subKeys.length) {
          const subCache = cache.get(k);
          if (subCache) {
            subCache.delete(subKeys);
            if (subCache.size === 0) {
              cache.delete(k);
            }
          }
        } else {
          cache.delete(k);
        }
      },
      clear() {
        if (!cache.clear) {
          throw new Error(`This cache does not support clearing`);
        }
        cache.clear();
      },
    };
  }
}

export interface LeveledCacheBuilder<TKeys extends readonly unknown[]> {
  addLevel<TKey, TMappedKey = TKey>(
    options?: LevelOptions<TKey, TMappedKey>,
  ): LeveledCacheBuilder<readonly [...TKeys, TKey]>;
  build<TValue>(): LeveledCache<TKeys, TValue>;
}

function createLeveledCacheInternal<TKey, TSubKeys extends unknown[]>(
  levels: readonly [
    NormalizedLevelOptions<TKey, unknown>,
    ...{
      readonly [i in keyof TSubKeys]: NormalizedLevelOptions<
        TSubKeys[i],
        unknown
      >;
    },
  ],
): LeveledCacheBuilder<readonly [TKey, ...TSubKeys]> {
  return {
    // Remove the "any" forces TypeScript to try and check an infinitely recursive structure
    addLevel<TSubKey, TMappedSubKey = TSubKey>(
      subOptions?: LevelOptions<TSubKey, TMappedSubKey>,
    ): any {
      return createLeveledCacheInternal([
        ...levels,
        normalizeLevelOptions(subOptions),
      ]);
    },
    build(): any {
      return createBranchCache(levels);
    },
  };
}

export default function createLeveledCache<TKey, TMappedKey = TKey>(
  options?: LevelOptions<TKey, TMappedKey>,
): LeveledCacheBuilder<[TKey]> {
  return createLeveledCacheInternal([normalizeLevelOptions(options)]);
}
