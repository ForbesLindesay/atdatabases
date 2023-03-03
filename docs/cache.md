---
id: cache
title: '@databases/cache'
sidebar_label: Cache
---

The `@databases/cache` package is an in-memory, least recently used (LRU) cache for JavaScript/TypeScript. It allows you to store data retrieved from your database in memory and automatically evict/discard the least recently used keys from the cache once there is not enough memory to store more items.

## Features

The `@databases/cache` library improves on most LRU cache libraries by offering capabilities that I've found are necessary for usage in a complex real world application:

- Group multiple caches into a single "Cache Realm" to share a single capacity and eviction queue. This frees you from having to micromanage the capacities of separate caches.
- Replicate `delete` and `clear` calls between servers using replication events.
- Use event handlers to log and monitor the performance of your caches.

## Usage

Using `@databases/cache` comes in two parts:

1. Create a "Cache Realm" to group caches that share a single capacity and eviction queue.
2. Create "Caches" within the realm to store the actual cached items.

### Cache Realms

First you will need to create a cache realm, you normally want one of these per application.

The Cache Realm is where you configure the capacity, and optionally any replication and monitoring.

#### Basic Realm

```typescript
// ./utils/cache.ts

import createCacheRealm from '@databases/cache';

const {createCache} = createCacheRealm({maximumSize: 10_000});

export default createCache;
```

#### Replication

Assuming a Pub/Sub service with `publishEvent` and `subscribe` methods, you can replicate `cache.delete(key)` calls and `cache.clear()` calls between multiple servers using the following example.

```typescript
// ./utils/cache.ts

import createCacheRealm from '@databases/cache';

const {createCache, writeReplicationEvent} = createCacheRealm({
  maximumSize: 10_000,
  onReplicationEvent(event) {
    publishEvent(`replication-topic`, event).catch((ex) => {
      console.error(`Failed to publish replication event: ${ex.stack}`);
    });
  },
});

subscribe(`replication-topic`, (event) => {
  writeReplicationEvent(event);
});

export default createCache;
```

#### Monitoring Cache Performance

The following example will track the cache hit rate of each named cache and log the hit rate as a percentage every 100 times that `cache.get()` is called.

```typescript
// ./utils/cache.ts

import createCacheRealm from '@databases/cache';

const metrics = new Map<string, {hits: number; total: number}>();

const {createCache} = createCacheRealm({
  maximumSize: 10_000,
  onCacheCreate({name}) {
    metrics.set(name);
  },
  onGet({name, isCacheHit}) {
    const m = metrics.get(name)!;
    if (isCacheHit) m.hits++;
    m.total++;
    if (m.total === 100) {
      console.log(`Cache hit rate for ${name} is ${m.hits}%`);
      m.hits = 0;
      m.total = 0;
    }
  },
});

export default createCache;
```

### Caches

Within your cache realm you create the actual "caches" themselves. Typically you'll have at least 1 per type of record you want to cache, but you can have multiple for the same type of record if there are a range of different ways that you query the same records.

The individual caches are where you configure the types, as well as how keys are serialized, how value sizes are measured, and whether entries expire.

#### Database Record Cache

This example caches calls to `getUser` and removes the cache entries when the user is updated. It assumes you've already created a Cache Realm using one of the examples for `createCacheRealm`.

```typescript
// ./users.ts

import createCache from './utils/cache';

const UsersCache = createCache<DbUser['id'], Promise<DbUser | null>>({
  name: 'Users',
});

export async function getUser(id: DbUser['id']) {
  const cached = UsersCache.get(id);
  if (cached) return await cached;

  const resultPromise = users(db).findOne({id});
  UsersCache.set(id, resultPromise);
  try {
    return await resultPromise;
  } catch (ex) {
    UserCache.delete(id);
    throw ex;
  }
}

export async function updateUser(id: DbUser['id'], updates: Partial<DbUser>) {
  await users(db).update({id}, updates);
  UsersCache.delete(id);
}
```

#### Composite Keys

If the key for your cache is an object with multiple properties, you may need to "map" the key to a string or number so that the key can be correctly looked up. You can do this using teh `mapKey` option.

```typescript
// ./user-roles.ts

import createCache from './utils/cache';

type Key = Pick<DbUserRole, 'user_id' | 'organization_id'>;
const UserRolesCache = createCache<Key, Promise<DbUserRole[]>>({
  name: 'UserRoles',
  mapKey: (key) => `${key.user_id}:${key.organization_id}`,
});

export async function getUserRoles(key: Key) {
  const cached = UserRolesCache.get(key);
  if (cached) return await cached;

  const resultPromise = user_roles(db)
    .find({
      user_id: key.user_id,
      organization_id: key.organization_id,
    })
    .all();
  UserRolesCache.set(key, resultPromise);
  try {
    return await resultPromise;
  } catch (ex) {
    UserRolesCache.delete(key);
    throw ex;
  }
}

export async function updateUserRoles(key: Key, roles: string[]) {
  await users(db).delete({
    user_id: key.user_id,
    organization_id: key.organization_id,
  });
  await users(db).insert(
    roles.map((role_name) => ({
      user_id: key.user_id,
      organization_id: key.organization_id,
      role_name,
    })),
  );

  UserRolesCache.delete(key);
}
```

#### Expiry Timeouts

Sometimes it's not possibly to reliably tell when something has changed. In this situation you can use an expiry duration to request fresh data after a short time. The following example caches requests to load JSON from a URL for up to 60 seconds. When reading from the cache, `@databases/cache` will check to see if the entry has expired before returning it.

```typescript
// ./json-request-cache.ts

import createCache from './utils/cache';

const JsonResponseCache = createCache<string, Promise<unknown>>({
  name: 'CachedJson',
  expireAfterMilliseconds: 60_000,
});

export async function getJsonWithCache(url: string) {
  const cached = JsonResponseCache.get(url);
  if (cached) return await cached;

  const resultPromise = fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error(`Server responded with: ${await res.text()}`);
    }
    return await res.json();
  });
  JsonResponseCache.set(url, resultPromise);
  try {
    return await resultPromise;
  } catch (ex) {
    JsonResponseCache.delete(url);
    throw ex;
  }
}
```

#### Variable size values

It's often good enough to just treat every entry in your cache as having a size of `1`. This can break down though if your cache entries vary wildly in size. If this is the case, you can use the `getSize` option to provide a different size for each object in your cache. This will allow a smaller number of large entries to still fill up your cache completely.

```typescript
// ./blog-posts.ts

import createCache from './utils/cache';

const BlogPostsByAuthorCache = createCache<
  DbBlogPost['author_id'],
  Promise<DbBlogPost[]>
>({
  name: 'BlogPostsByAuthor',
  getSize: (results) => results.length,
});

export async function getBlogPostsByAuthor(id: DbBlogPost['author_id']) {
  const cached = BlogPostsByAuthorCache.get(id);
  if (cached) return await cached;

  const resultPromise = blog_posts(db).find({author_id: id}).all();
  BlogPostsByAuthorCache.set(id, resultPromise);
  try {
    return await resultPromise;
  } catch (ex) {
    BlogPostsByAuthorCache.delete(id);
    throw ex;
  }
}
```

## API

### createCacheRealm(CacheRealmOptions)

Creates a new cache realm. All caches within a realm share the same capacity and eviction queue.

#### CacheRealmOptions

Options:

- `maximumSize` (required) - The maximum size that can be stored in the cache realm. If getSize is not used, this corresponds to the maximum total number of entries in the cache realm.
- `getTime` - Override the current time by providing a function that returns a unix timestamp in milliseconds. Useful for tests.
- `onReplicationEvent` - Handler to be called with replication events when cache entries are deleted or caches are cleared. If you have multiple servers you should replicate these events to other servers and call the writeReplicationEvent method on the realms in other servers.

Events:

- `onCacheCreate` - Called when a new cache is created
- `onClear` - Called when `cache.clear()` is called.
- `onDelete` - Called when `cache.delete()` is called.
- `onGet` - Called when `cache.get()` is called. Use `event.isCacheHit` to determine if the entry was found in the cache or not.
- `onSet` - Called when `cache.set()` is called.
- `onEvict` - Called when a cache entry is evicted due to hitting the capacity.

```typescript
interface CacheRealmOptions {
  maximumSize: number;
  getTime?: () => number;
  onReplicationEvent?: (event: ReplicationEvent) => void;
  onCacheCreate?: (event: CacheEvent) => void;
  onClear?: (event: CacheEvent) => void;
  onDelete?: (event: CacheKeyEvent) => void;
  onCacheMiss?: (event: CacheKeyEvent) => void;
  onCacheHit?: (event: CacheKeyEvent) => void;
  onSet?: (event: CacheKeyEvent) => void;
  onEvict?: (event: EvictEvent) => void;
}
```

All event handlers pass the serialized key. That is to say, if `mapKey` is specified, the keys in event handlers will be the result of `mapKey`. This is done to simplify logging and replication as the result of `mapKey` is usually a value that can be passed to `JSON.serialize` and `JSON.parse` without changing.

### createCache(CacheOptions)

Creates a new cache within the realm. This lets you specify the type of the key and value if you're using TypeScript, as well as a few other options.

#### CacheOptions

- `name` (required) - A unique name for this cache within the realm. This is used to identify the cache when it is replicated to other servers. It is also used for logs.
- `expireAfterMilliseconds` - Optional timeout in milliseconds after which cache entries will be considered stale and will not be returned when you call `cache.get()`.
- `mapKey` - Optional function to map the keys to a different value. This is useful when your keys are objects but you want to compare keys by value.
- `getSize` - Optional function to get the size of a value. This is used to determine when the cache is full and needs to evict. Defaults to always returning 1.

```typescript
interface CacheOptions<TKey, TValue> {
  name: string;
  expireAfterMilliseconds?: number;
  mapKey?: (key: TKey) => unknown;
  getSize?: (value: TValue, key: TKey) => number;
}
```

### Cache

The cache is a least recently used Map from keys to values. It shares it's capacity with all other caches in the same realm.

```typescript
interface Cache<TKey, TValue> {
  name: string;
  get(key: TKey): TValue | undefined;
  set(key: TKey, value: TValue): TValue;
  delete(key: TKey): void;
  clear(): void;
  dispose(): void;
}
```

#### Cache.name

The name of the cache. This is used to identify the cache when it is replicated to other servers. It is also used for logs.

#### Cache.get(key)

Get an entry from the cache and update it's last accessed time. It will be moved to the back of the eviction queue.

Returns undefined if the entry is not in the cache.

#### Cache.set(key, value)

If the an item with this key is already in the cache, it will be updated and moved to the back of the eviction queue.

Otherwise, a new item will be added to the cache and put at the back of the eviction queue.

If the cache realm is full, the least recently used item will be evicted.

#### Cache.delete(key)

Delete an item from the cache and remove it from the eviction queue.

#### Cache.clear()

Clear all items from the cache and remove them from the eviction queue.

#### Cache.dispose()

Dispose of the cache and remove it from the realm. All other methods will throw an error after you call this.
