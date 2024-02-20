import {CacheMapInput, Path, SubPath} from './types';

export interface MultiKeyMap<TKeys extends Path, TValue> {
  readonly size: number;
  get: (key: TKeys) => TValue | undefined;
  set: (key: TKeys, value: TValue) => void;
  deletePrefix: (key: SubPath<TKeys>) => void;
  delete: (key: TKeys | SubPath<TKeys>) => void;
  clear: () => void;
}

export interface MultiKeyMapOptionWithMapKey<
  TKeys extends Path,
  TValue,
  TDepth extends keyof TKeys,
  TMappedKeys extends Record<keyof TKeys, unknown>,
> {
  getCache?: () => CacheMapInput<TMappedKeys[TDepth], unknown>;
  mapKey: (key: TKeys[TDepth]) => TMappedKeys[TDepth];
}

export interface MultiKeyMapOptionWithoutMapKey<
  TKeys extends Path,
  TValue,
  TDepth extends keyof TKeys,
> {
  getCache?: () => CacheMapInput<TKeys[TDepth], unknown>;
  mapKey?: undefined;
}

export type MultiKeyMapOption<
  TKeys extends Path,
  TValue,
  TDepth extends keyof TKeys,
  TMappedKeys extends Record<keyof TKeys, unknown> = TKeys,
> =
  | MultiKeyMapOptionWithMapKey<TKeys, TValue, TDepth, TMappedKeys>
  | MultiKeyMapOptionWithoutMapKey<TKeys, TValue, TDepth>;

export type MultiKeyMapOptions<
  TKeys extends Path,
  TValue,
  TMappedKeys extends Record<keyof TKeys, unknown> = TKeys,
> = {
  [TDepth in keyof TKeys]: MultiKeyMapOption<
    TKeys,
    TValue,
    TDepth,
    TMappedKeys
  >;
};

interface NormalizedMultiKeyMapOptions<TKeys extends Path, TValue, TMappedKey> {
  getCache: (
    depth: number,
  ) => CacheMapInput<TMappedKey, MultiKeyMapNode<TKeys, TValue>>;
  getKeyMap: (depth: number) => (key: TKeys[number]) => TMappedKey;
}
const identityFn = <T>(arg: T): T => arg;
const DEFAULT_OPTIONS: NormalizedMultiKeyMapOptions<any, any, any> = {
  getCache: (_depth) => new Map(),
  getKeyMap: (_depth) => identityFn,
};

function normalizeOptions<
  TKeys extends Path,
  TValue,
  TMappedKeys extends Record<keyof TKeys, unknown> = TKeys,
>(
  options?: MultiKeyMapOptions<TKeys, TValue, TMappedKeys>,
): NormalizedMultiKeyMapOptions<TKeys, TValue, TMappedKeys[keyof TKeys]> {
  if (!options) return DEFAULT_OPTIONS;

  return {
    getCache: (depth) => {
      const option = options[depth];
      return option?.getCache
        ? (option.getCache() as CacheMapInput<
            any,
            MultiKeyMapNode<TKeys, TValue>
          >)
        : new Map();
    },
    getKeyMap: (depth) => {
      const option = options[depth];
      return option?.mapKey
        ? (option.mapKey as (
            key: TKeys[keyof TKeys],
          ) => TMappedKeys[keyof TKeys])
        : (identityFn as (key: TKeys[keyof TKeys]) => TMappedKeys[keyof TKeys]);
    },
  };
}

export default function createMultiKeyMap<
  TKeys extends Path,
  TValue,
  TMappedKeys extends Record<keyof TKeys, unknown> = TKeys,
>(
  options?: MultiKeyMapOptions<TKeys, TValue, TMappedKeys>,
): MultiKeyMap<TKeys, TValue> {
  return new MultiKeyMapImplementation<TKeys, TValue, TMappedKeys[keyof TKeys]>(
    normalizeOptions<TKeys, TValue, TMappedKeys>(options),
  );
}

class MultiKeyMapImplementation<TKeys extends Path, TValue, TMappedKey>
  implements MultiKeyMap<TKeys, TValue>
{
  private _root: BranchNode<TKeys, TValue, TMappedKey>;
  private readonly _options: NormalizedMultiKeyMapOptions<
    TKeys,
    TValue,
    TMappedKey
  >;
  constructor(
    options: NormalizedMultiKeyMapOptions<TKeys, TValue, TMappedKey>,
  ) {
    this._root = new BranchNode(0, options);
    this._options = options;
  }
  get size() {
    return this._root.size;
  }
  get(key: TKeys): TValue | undefined {
    return this._root.get(key);
  }
  set(key: TKeys, value: TValue): void {
    this._root.set(key, value);
  }
  deletePrefix(key: SubPath<TKeys>): void {
    this._root.delete(key);
  }
  delete(key: TKeys | SubPath<TKeys>): void {
    this._root.delete(key);
  }
  clear(): void {
    if (!this._root.clear()) {
      this._root = new BranchNode(0, this._options);
    }
  }
}

class DeleteResult {
  public readonly deletedCount: number;
  public readonly isCleared: boolean;
  constructor(deletedCount: number, isCleared: boolean) {
    this.deletedCount = deletedCount;
    this.isCleared = isCleared;
  }
}
const DELETE_RESULT_ONE = new DeleteResult(1, true);
const DELETE_NOOP = new DeleteResult(0, false);

interface MultiKeyMapNode<TKeys extends Path, TValue> {
  get size(): number;
  get: (keys: TKeys) => TValue | undefined;
  set: (keys: TKeys, value: TValue) => boolean;
  delete: (keys: TKeys | SubPath<TKeys>) => DeleteResult;
}

class BranchNode<TKeys extends Path, TValue, TMappedKey>
  implements MultiKeyMapNode<TKeys, TValue>
{
  private readonly _keyIndex: number;
  private readonly _children: CacheMapInput<
    TMappedKey,
    MultiKeyMapNode<TKeys, TValue>
  >;
  private readonly _mapKey: (key: TKeys[number]) => TMappedKey;
  private readonly _options: NormalizedMultiKeyMapOptions<
    TKeys,
    TValue,
    TMappedKey
  >;
  private _size: number = 0;
  constructor(
    keyIndex: number,
    options: NormalizedMultiKeyMapOptions<TKeys, TValue, TMappedKey>,
  ) {
    this._keyIndex = keyIndex;
    this._children = options.getCache(keyIndex);
    this._mapKey = options.getKeyMap(keyIndex);
    this._options = options;
  }

  get size() {
    return this._size;
  }
  get(keys: TKeys): TValue | undefined {
    const child = this._children.get(this._mapKey(keys[this._keyIndex]));
    if (child) return child.get(keys);
    return undefined;
  }
  set(keys: TKeys, value: TValue): boolean {
    const key = this._mapKey(keys[this._keyIndex]);
    let child = this._children.get(key);
    if (!child) {
      if (this._keyIndex < keys.length - 1) {
        child = new BranchNode<TKeys, TValue, TMappedKey>(
          this._keyIndex + 1,
          this._options,
        );
        this._children.set(key, child);
      } else {
        child = new LeafNode(value);
        this._children.set(key, child);
        this._size++;
        return true;
      }
    }

    const isNew = child.set(keys, value);
    if (isNew) this._size++;
    return isNew;
  }
  delete(keys: TKeys | SubPath<TKeys>): DeleteResult {
    if (this._keyIndex >= keys.length) {
      return new DeleteResult(this._size, true);
    }
    const key = this._mapKey(keys[this._keyIndex]);
    const child = this._children.get(key);
    if (!child) return DELETE_NOOP;

    const childResult = child.delete(keys);
    this._size -= childResult.deletedCount;

    if (!childResult.isCleared) return childResult;

    this._children.delete(key);
    return new DeleteResult(childResult.deletedCount, this._size === 0);
  }
  clear(): boolean {
    if (!this._children.clear) {
      return false;
    } else {
      this._children.clear();
      this._size = 0;
      return true;
    }
  }
}

class LeafNode<TKeys extends Path, TValue>
  implements MultiKeyMapNode<TKeys, TValue>
{
  private _value: TValue;
  constructor(value: any) {
    this._value = value;
  }
  get size() {
    return 1;
  }
  get(_keys: TKeys): TValue {
    return this._value;
  }
  set(_keys: TKeys, value: TValue): boolean {
    this._value = value;
    return false;
  }
  delete(_keys: TKeys | SubPath<TKeys>): DeleteResult {
    return DELETE_RESULT_ONE;
  }
}
