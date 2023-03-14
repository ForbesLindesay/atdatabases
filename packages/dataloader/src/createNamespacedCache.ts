import {CacheMapInput} from './types';

type SubPath<TKeys extends readonly unknown[]> = TKeys extends readonly [
  ...infer THead,
  infer TTail,
]
  ? {readonly [i in keyof TKeys]: TKeys[i]} | SubPath<THead>
  : never;

export interface NamespacedCache<TKeys extends readonly unknown[], TValue> {
  readonly size: number | undefined;
  get(key: TKeys): TValue | undefined;
  set(key: TKeys, value: TValue): void;
  delete(key: TKeys | SubPath<TKeys>): void;
  clear(): void;
}

export interface NamespaceOptionsWithMapKey<TKey, TMappedKey> {
  getCache?: <TValue>() => CacheMapInput<TMappedKey, TValue>;
  mapKey: (key: TKey) => TMappedKey;
}

export interface NamespaceOptionsWithoutMapKey<TKey> {
  getCache?: <TValue>() => CacheMapInput<TKey, TValue>;
  mapKey?: undefined;
}

export type NamespaceOptions<TKey, TMappedKey> =
  | NamespaceOptionsWithMapKey<TKey, TMappedKey>
  | NamespaceOptionsWithoutMapKey<TKey>;

function createBranchCache<
  TKey,
  TMappedKey,
  TSubKeys extends readonly unknown[],
  TValue,
>([{getCache, mapKey}, ...subOptions]: readonly [
  NormalizedNamespaceOptions<TKey, TMappedKey>,
  ...{
    readonly [i in keyof TSubKeys]: NormalizedNamespaceOptions<
      TSubKeys[i],
      unknown
    >;
  },
]): NamespacedCache<[TKey, ...TSubKeys], TValue> {
  if (subOptions.length === 0) {
    let cache = getCache<TValue>();
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
        if (cache.clear) {
          cache.clear();
        } else {
          cache = getCache<TValue>();
        }
      },
    };
  } else {
    let cache = getCache<NamespacedCache<TSubKeys, TValue>>();
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
          const newSubCache: NamespacedCache<TSubKeys, TValue> =
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
        if (cache.clear) {
          cache.clear();
        } else {
          cache = getCache<NamespacedCache<TSubKeys, TValue>>();
        }
      },
    };
  }
}

export interface NamespacedCacheBuilder<TKeys extends readonly unknown[]> {
  addNamespace<TKey, TMappedKey = TKey>(
    options?: NamespaceOptions<TKey, TMappedKey>,
  ): NamespacedCacheBuilder<readonly [...TKeys, TKey]>;
  build<TValue>(): NamespacedCache<TKeys, TValue>;
}

function createNamespacedCacheInternal<TKey, TSubKeys extends unknown[]>(
  namespaces: readonly [
    NormalizedNamespaceOptions<TKey, unknown>,
    ...{
      readonly [i in keyof TSubKeys]: NormalizedNamespaceOptions<
        TSubKeys[i],
        unknown
      >;
    },
  ],
): NamespacedCacheBuilder<readonly [TKey, ...TSubKeys]> {
  return {
    // Remove the "any" forces TypeScript to try and check an infinitely recursive structure
    addNamespace<TSubKey, TMappedSubKey = TSubKey>(
      subOptions?: NamespaceOptions<TSubKey, TMappedSubKey>,
    ): any {
      return createNamespacedCacheInternal([
        ...namespaces,
        normalizeNamespaceOptions(subOptions),
      ]);
    },
    build(): any {
      return createBranchCache(namespaces);
    },
  };
}

export default function createNamespacedCache<TKey, TMappedKey = TKey>(
  options?: NamespaceOptions<TKey, TMappedKey>,
): NamespacedCacheBuilder<[TKey]> {
  return createNamespacedCacheInternal([normalizeNamespaceOptions(options)]);
}

interface NormalizedNamespaceOptions<TKey, TMappedKey> {
  getCache: <TValue>() => CacheMapInput<TMappedKey, TValue>;
  mapKey: (key: TKey) => TMappedKey;
}

function normalizeNamespaceOptions<TKey, TMappedKey = TKey>(
  options?: NamespaceOptions<TKey, TMappedKey>,
): NormalizedNamespaceOptions<TKey, TMappedKey> {
  // @ts-expect-error if not using mapKey, then TMappedKey is TKey
  const getCache: <TValue>() => CacheMapInput<TMappedKey, TValue> =
    options?.getCache ?? (() => new Map());
  // @ts-expect-error if not using mapKey, then TMappedKey is TKey
  const mapKey: (key: TKey) => TMappedKey =
    options?.mapKey ?? ((key: TKey) => key);
  return {getCache, mapKey};
}
