export type Path = readonly [unknown, ...(readonly unknown[])];
export type SubPath<TKeys extends readonly unknown[]> = TKeys extends readonly [
  ...infer THead,
  infer TTail,
]
  ? {readonly [i in keyof TKeys]: TKeys[i]} | SubPath<THead>
  : never;

export type KeyPrefix<TKey> = TKey extends readonly unknown[]
  ? SubPath<TKey> | string
  : string;
export interface CacheMapInput<TKey, TValue> {
  readonly size?: number;
  get: (key: TKey) => TValue | undefined;
  set: (key: TKey, value: TValue) => unknown;
  deletePrefix?: TKey extends readonly unknown[]
    ? ((prefix: string) => unknown) | ((prefix: SubPath<TKey>) => unknown)
    : (prefix: string) => unknown;
  delete: (...keys: TKey[]) => unknown;
  clear?: () => unknown;
  keys?: () => IterableIterator<TKey>;
}

export interface CacheMap<TKey, TValue> {
  readonly size?: number;
  get: (key: TKey) => TValue | undefined;
  set: (key: TKey, value: TValue) => void;
  deletePrefix: (prefix: KeyPrefix<TKey>) => void;
  delete: (...keys: TKey[]) => void;
  clear: () => void;
}

export interface AsyncCacheMap<TKey, TValue> {
  readonly size?: number;
  get: (key: TKey) => Promise<TValue> | undefined;
  set: (key: TKey, value: Promise<TValue> | TValue) => void;
  deletePrefix: (prefix: KeyPrefix<TKey>) => void;
  delete: (...keys: TKey[]) => void;
  clear: () => void;
}

// const x: CacheMapInput<string, number> = new Map<string, number>();
// const y: CacheMapInput<{}, number> = new WeakMap<{}, number>();
