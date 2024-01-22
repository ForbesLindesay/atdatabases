export interface CacheMapInput<TKey, TValue> {
  readonly size?: number;
  get(key: TKey): TValue | undefined;
  set(key: TKey, value: TValue): unknown;
  delete(key: TKey): unknown;
  clear?(): unknown;
}

export interface CacheMap<TKey, TValue> {
  readonly size?: number;
  get(key: TKey): TValue | undefined;
  set(key: TKey, value: TValue): void;
  delete(key: TKey): void;
  clear(): void;
}

export interface AsyncCacheMap<TKey, TValue> {
  readonly size?: number;
  get(key: TKey): Promise<TValue> | undefined;
  set(key: TKey, value: Promise<TValue> | TValue): void;
  delete(key: TKey): void;
  clear(): void;
}
