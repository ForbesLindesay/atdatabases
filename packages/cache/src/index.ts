export interface ReplicationClearEvent {
  readonly kind: 'CLEAR';
  readonly name: string;
}

export interface ReplicationDeleteEvent {
  readonly kind: 'DELETE';
  readonly name: string;
  readonly key: unknown;
}

export type ReplicationEvent = ReplicationClearEvent | ReplicationDeleteEvent;

export interface CacheEvent {
  /**
   * The name specified when the cache was created.
   */
  readonly name: string;
}

export interface CacheKeyEvent extends CacheEvent {
  /**
   * The key of the entry. If the Cache specifies a `mapKey` function,
   * this will be the result of that function. Otherwise, it will be
   * the original key.
   */
  readonly key: unknown;
}

export interface CacheGetEvent extends CacheKeyEvent {
  /**
   * True if the entry was found in the cache.
   */
  readonly isCacheHit: boolean;
}

export interface EvictEvent {
  /**
   * The last time the entry was accessed as a unix timestamp in milliseconds.
   */
  readonly lastAccessed: number;
}

export interface CacheRealmOptions {
  /**
   * The maximum size that can be stored in the cache realm.
   *
   * If getSize is not used, this corresponds to the maximum
   * total number of entries in the cache realm.
   */
  readonly maximumSize: number;
  /**
   * Get the current unix timestamp in milliseconds. Defaults
   * to Date.now(). This is probably only useful for testing.
   */
  readonly getTime?: () => number;
  /**
   * Handler to be called with replication events when cache
   * entries are deleted or caches are cleared. If you have
   * multiple servers you should replicate these events to
   * other servers and call the writeReplicationEvent method
   * on the realms in other servers.
   */
  readonly onReplicationEvent?: (event: ReplicationEvent) => void;
  readonly onCacheCreate?: (event: CacheEvent) => void;
  readonly onClear?: (event: CacheEvent) => void;
  readonly onDelete?: (event: CacheKeyEvent) => void;
  readonly onGet?: (event: CacheGetEvent) => void;
  readonly onSet?: (event: CacheKeyEvent) => void;
  readonly onEvict?: (event: EvictEvent) => void;
}

export interface CacheOptions<TKey, TValue> {
  /**
   * The name of the cache. This is used to identify the cache
   * when it is replicated to other servers. It is also used
   * for logs.
   *
   * It must be unique within the CacheRealm.
   */
  readonly name: string;
  /**
   * Optional expiry for cache entries in milliseconds.
   */
  readonly expireAfterMilliseconds?: number;
  /**
   * Optional function to map the keys to a different value.
   * This is useful when your keys are objects but you want to
   * compare keys by value.
   */
  readonly mapKey?: (key: TKey) => unknown;
  /**
   * Optional function to get the size of a value. This is used
   * to determine when the cache is full and needs to evict.
   *
   * Defaults to always returning 1.
   */
  readonly getSize?: (value: TValue, key: TKey) => number;
}

/**
 * The cache realm is a collection of caches that share
 * the same capacity and eviction queue.
 *
 * Each cache within the realm has a unique name, allowing
 * for replication of cache deletes and clears between servers.
 */
export interface CacheRealm {
  /**
   * Creates a new cache within the realm. All caches within
   * a realm share the same capacity and eviction queue.
   */
  createCache<TKey, TValue>(
    options: CacheOptions<TKey, TValue>,
  ): Cache<TKey, TValue>;

  /**
   * Replicates a cache delete/clear from another server.
   */
  writeReplicationEvent(event: ReplicationEvent): void;
}

/**
 * The cache is a least recently used Map from keys to
 * values. It shares it's capacity with all other caches
 * in the same realm.
 */
export interface Cache<TKey, TValue> {
  /**
   * The name of the cache. This is used to identify the cache
   * when it is replicated to other servers. It is also used
   * for logs.
   */
  readonly name: string;
  /**
   * Get an entry from the cache and update it's
   * last accessed time. It will be moved to the
   * back of the eviction queue.
   *
   * Returns undefined if the entry is not in the cache.
   */
  get(key: TKey): TValue | undefined;

  /**
   * If the an item with this key is already in the cache,
   * it will be updated and moved to the back of the eviction
   * queue.
   *
   * Otherwise, a new item will be added to the cache and
   * put at the back of the eviction queue.
   *
   * If the cache realm is full, the least recently used item will
   * be evicted.
   */
  set(key: TKey, value: TValue): TValue;

  /**
   * Delete an item from the cache and remove it from the
   * eviction queue.
   */
  delete(key: TKey): void;

  /**
   * Clear all items from the cache and remove them from the
   * eviction queue.
   */
  clear(): void;

  /**
   * Dispose of the cache and remove it from the realm.
   */
  dispose(): void;
}

type SerializedKey = {__type: 'SerializedKey'};

interface InternalCacheKeyEvent extends CacheEvent {
  readonly key: SerializedKey;
}

interface InternalCacheRealmOptions {
  readonly maximumSize: number;
  readonly getTime?: () => number;
  readonly onReplicationEvent?: (
    event:
      | {kind: 'CLEAR'; name: string}
      | {kind: 'DELETE'; name: string; key: SerializedKey},
  ) => void;
  readonly onCacheCreate?: (event: CacheEvent) => void;
  readonly onClear?: (event: CacheEvent) => void;
  readonly onDelete?: (event: InternalCacheKeyEvent) => void;
  readonly onGet?: (event: CacheGetEvent) => void;
  readonly onSet?: (event: InternalCacheKeyEvent) => void;
  readonly onEvict?: (event: EvictEvent) => void;
}

/**
 * All cache items are stored in a single, doubly linked list
 * to maintain the order in which they should be evicted. The
 * doubly linked list allows for an item to be efficiently removed
 * from anywhere in the list, and then appended to the end.
 */
class Item<TValue = unknown> {
  readonly key: SerializedKey;
  readonly store: Map<SerializedKey, Item<TValue>>;

  /**
   * Once this item is removed/evicted from the cache,
   * which item is next.
   */
  next: Item | null;
  /**
   * Which item will be removed/evicted from the cache
   * immediately before this one.
   */
  previous: Item | null;
  expiry: number | null;
  lastAccessed: number;
  size: number;
  value: TValue;

  constructor(
    key: SerializedKey,
    store: Map<SerializedKey, Item<TValue>>,
    value: TValue,
    size: number,
    expiry: number | null,
    lastAccessed: number,
  ) {
    this.key = key;
    this.store = store;
    this.value = value;
    this.size = size;
    this.expiry = expiry;
    this.lastAccessed = lastAccessed;
    this.next = null;
    this.previous = null;
  }
}

/**
 * Creates a new cache realm. All caches within a realm share
 * the same capacity and eviction queue.
 */
export default function createCacheRealm(
  realmOptions: CacheRealmOptions,
): CacheRealm {
  const internalRealmOptions: InternalCacheRealmOptions = realmOptions;
  const {
    maximumSize,
    getTime = () => Date.now(),
    onReplicationEvent,
    onCacheCreate,
    onClear,
    onDelete,
    onGet,
    onSet,
    onEvict,
  } = internalRealmOptions;

  let first: Item | null = null;
  let last: Item | null = null;
  let usedSize = 0;

  function removeItemFromEvictionQueue(item: Item) {
    const {previous, next} = item;
    if (first === item) {
      first = next;
    }
    if (last === item) {
      last = previous;
    }
    if (previous) {
      previous.next = next;
    }
    if (next) {
      next.previous = previous;
    }
  }

  function addItemToBackOfEvictionQueue(item: Item) {
    item.next = null;

    if (!first) {
      first = item;
    }

    if (last) {
      last.next = item;
      item.previous = last;
    } else {
      item.previous = null;
    }

    last = item;
  }

  function moveItemToBackOfEvictionQueue(item: Item) {
    if (item !== last) {
      removeItemFromEvictionQueue(item);
      addItemToBackOfEvictionQueue(item);
    }
  }

  const caches = new Map<
    string,
    Pick<CacheImplementation<unknown, unknown>, '_delete' | '_clear'>
  >();

  class CacheImplementation<TKey, TValue> implements Cache<TKey, TValue> {
    private _disposed = false;
    private readonly _items = new Map<SerializedKey, Item<TValue>>();

    public readonly name: string;
    private readonly _serializeKey: (key: TKey) => SerializedKey;
    private readonly _getSize: (value: TValue, key: TKey) => number;
    private readonly _expireAfterMilliseconds: number | undefined;

    constructor(options: CacheOptions<TKey, TValue>) {
      this.name = options.name;
      this._serializeKey = (options.mapKey ?? ((key: TKey) => key)) as any;
      this._getSize = options.getSize ?? (() => 1);
      this._expireAfterMilliseconds = options.expireAfterMilliseconds;
    }

    private _assertNotDisposed() {
      if (this._disposed) {
        throw new Error(`Cache "${this.name}" has been disposed`);
      }
    }

    _clear() {
      const items = [...this._items.values()];
      for (const item of items) {
        removeItemFromEvictionQueue(item);
        usedSize -= item.size;
      }
      this._items.clear();
    }
    clear(): void {
      this._assertNotDisposed();
      if (onClear) {
        onClear({name: this.name});
      }
      if (onReplicationEvent) {
        onReplicationEvent({kind: 'CLEAR', name: this.name});
      }
      this._clear();
    }

    _delete(k: SerializedKey): void {
      const item = this._items.get(k);

      if (item) {
        removeItemFromEvictionQueue(item);
        this._items.delete(k);
        usedSize -= item.size;
      }
    }
    delete(key: TKey): void {
      this._assertNotDisposed();
      const k = this._serializeKey(key);
      if (onDelete) {
        onDelete({name: this.name, key: k});
      }
      if (onReplicationEvent) {
        onReplicationEvent({kind: 'DELETE', name: this.name, key: k});
      }
      this._delete(k);
    }

    get(key: TKey): TValue | undefined {
      this._assertNotDisposed();
      const k = this._serializeKey(key);
      const item = this._items.get(k);
      const now = getTime();

      if (!item) {
        if (onGet) {
          onGet({name: this.name, key: k, isCacheHit: false});
        }
        return undefined;
      }

      if (item?.expiry != null && item.expiry <= now) {
        removeItemFromEvictionQueue(item);
        this._items.delete(k);
        usedSize -= item.size;

        if (onGet) {
          onGet({name: this.name, key: k, isCacheHit: false});
        }
        return undefined;
      }

      if (last !== item) {
        removeItemFromEvictionQueue(item);
        addItemToBackOfEvictionQueue(item);
      }

      if (onGet) {
        onGet({name: this.name, key: k, isCacheHit: true});
      }
      item.lastAccessed = now;
      return item.value;
    }

    set(key: TKey, value: TValue): TValue {
      this._assertNotDisposed();
      const k = this._serializeKey(key);
      let item = this._items.get(k);

      if (onSet) {
        onSet({name: this.name, key: k});
      }

      const now = getTime();

      if (item) {
        // Update the value
        item.value = value;

        // Update the size
        const newSize = this._getSize(value, key);
        usedSize += newSize - item.size;
        item.size = newSize;

        // Update the last accessed time
        item.lastAccessed = now;

        // update expiry on set
        item.expiry = this._expireAfterMilliseconds
          ? now + this._expireAfterMilliseconds
          : null;

        // Move the item to the back of the eviction queue
        moveItemToBackOfEvictionQueue(item);
      } else {
        item = new Item(
          k,
          this._items,
          value,
          this._getSize(value, key),
          this._expireAfterMilliseconds
            ? now + this._expireAfterMilliseconds
            : null,
          now,
        );

        this._items.set(k, item);
        usedSize += item.size;
        addItemToBackOfEvictionQueue(item);
      }

      while (usedSize > maximumSize && first) {
        // evict the first entry
        const {key, store, lastAccessed, size} = first;
        removeItemFromEvictionQueue(first);
        store.delete(key);
        usedSize -= size;
        if (onEvict) {
          onEvict({lastAccessed});
        }
      }

      return value;
    }

    dispose() {
      this._assertNotDisposed();
      this._disposed = true;
      caches.delete(this.name);
      this._clear();
    }
  }

  function createCache<TKey, TValue>(
    options: CacheOptions<TKey, TValue>,
  ): Cache<TKey, TValue> {
    if (caches.has(options.name)) {
      throw new Error(`Cache with name ${options.name} already exists`);
    }
    const cache = new CacheImplementation<TKey, TValue>(options);
    caches.set(options.name, cache);
    if (onCacheCreate) {
      onCacheCreate({name: options.name});
    }
    return cache;
  }

  function writeReplicationEvent(event: ReplicationEvent) {
    const cache = caches.get(event.name);
    if (cache) {
      switch (event.kind) {
        case 'CLEAR':
          cache._clear();
          break;
        case 'DELETE':
          cache._delete(event.key as SerializedKey);
          break;
      }
    }
  }

  return {createCache, writeReplicationEvent};
}

module.exports = Object.assign(createCacheRealm, {
  default: createCacheRealm,
});
