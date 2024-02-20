---
id: dataloader
title: '@databases/dataloader'
sidebar_label: Data Loader
---

The `@databases/dataloader` package contains utilities for batching and deduplicating (aka caching) requests to load data from a database (or anywhere else you get data from). You can use `@databases/dataloader` with or without the rest of `@databases`.

## Usage Examples

### Batch

Batching is a great way to avoid "the n+1 problem" which is common in GraphQL where you end up needing to make 101 queries to the database when loading a list of 100 items due to having 1 query to get the list of items, and another per item to get some sub-item for each item. By default it does not cache/deduplicate requests, but does optimize resource usage on the database by combining related queries.

#### Batch primary keys

This example creates a function to get users by ID from a database. It allows you to fetch multiple different users in parallel while automatically combining the requests into a single query.

```typescript
import {batch} from '@databases/dataloader';
import database, {anyOf, tables, DbUser} from './database';

// (id: DbUser['id']) => Promise<DbUser | undefined>
const getUser = batch<DbUser['id'], DbUser | undefined>(async (userIds) => {
  const users = await tables
    .users(database)
    .find({id: anyOf(userIds)})
    .all();
  return new Map(users.map((u) => [u.id, u]));
});
```

If you were to call this async function three times in parallel:

```typescript
async function getThreeUsers() {
  return await Promise.all([getUser(1), getUser(2), getUser(3)]);
}
```

We would only run a single SQL query:

```sql
SELECT * FROM users WHERE id=ANY(${[1, 2, 3]})
```

This is much more efficient than running the queries separately.

<collapse-heading/>

You can also add a cache by wrapping the batched function in `dedupeAsync`.

<collapse-body/>

```typescript
import {batch, dedupeAsync} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

// (id: DbUser['id']) => Promise<DbUser | undefined>
const getUser = dedupeAsync<DbUser['id'], DbUser | undefined>(
  batch<DbUser['id'], DbUser | undefined>(async (userIds) => {
    const users = await tables
      .users(database)
      .find({id: anyOf(userIds)})
      .all();
    return new Map(users.map((u) => [u.id, u]));
  }),
  {
    cache: createCache({name: 'Users'}),
    // We can use shouldCache to avoid caching missing users
    shouldCache: (value) => value != null,
  },
);

function onUserChanged(id: DbUser['id']) {
  getUser.cache.delete(id);
}
```

If you want a suitable LRU cache to use here, check out [`@databases/cache`](cache.md).

<collapse-end/>

<collapse-heading/>

If you want to throw errors, rather than returning undefined on missing records, you can return a function instead of a Map.

<collapse-body/>

```typescript
import {batch} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

// (id: DbUser['id']) => Promise<DbUser>
const getUser = batch<DbUser['id'], DbUser>(async (userIds) => {
  const users = await tables
    .users(database)
    .find({id: anyOf(userIds)})
    .all();
  const results = new Map(users.map((u) => [u.id, u]));
  return (userId) => {
    const result = results.get(userId);
    if (!result) throw new Error(`Unable to find user with id ${userId}`);
    return result;
  };
});

function onUserChanged(id: DbUser['id']) {
  getUser.cache.delete(id);
}
```

<collapse-end/>

#### Batch foreign keys

This example creates a function to get blog posts by their author ID from a database. It allows you to fetch posts by multiple different authors in parallel while automatically combining the requests into a single query and separating the results back out in `O(n)` time where `n` is the total number of posts retrieved.

```typescript
import {batch, groupBy} from '@databases/dataloader';
import database, {anyOf, tables, DbBlogPost} from './database';

// (authorId: DbBlogPost['author_id']) => Promise<DbBlogPost[]>
const getBlogPostsByAuthor = batch<DbBlogPost['author_id'], DbBlogPost[]>(
  async (authorIds) => {
    const posts = await tables
      .blog_posts(database)
      .find({author_id: anyOf(authorIds)})
      .all();

    return groupBy(posts, (p) => p.author_id);
  },
);
```

<collapse-heading/>

Just like with the primary key, you can also use `dedupeAsync` to cache these requests.

<collapse-body/>

```typescript
import {dedupeAsync, batch, groupBy} from '@databases/dataloader';
import database, {tables, DbBlogPost} from './database';

// (authorId: DbBlogPost['author_id']) => Promise<DbBlogPost[]>
const getBlogPostsByAuthor = dedupeAsync<DbBlogPost['author_id'], DbBlogPost[]>(
  batch<DbBlogPost['author_id'], DbBlogPost[]>(async (authorIds) => {
    const posts = await tables
      .blog_posts(database)
      .find({author_id: anyOf(authorIds)})
      .all();

    return groupBy(posts, (p) => p.author_id);
  }),
  {
    cache: createCache({name: 'BlogPostsByAuthor'}),
  },
);

function onBlogPostChanged(before: DbBlogPost, after: DbBlogPost) {
  getBlogPostsByAuthor.cache.delete(before.author_id);
  getBlogPostsByAuthor.cache.delete(after.author_id);
}
```

<collapse-end/>

#### Batch for a longer time period

This example batches any requests that come within 100ms of each other, up to 100 requests. We use a function that returns `void` as the return value to indicate that these requests do not need a response.

```typescript
import {setTimeout} from 'timers/promises';
import {batch} from '@databases/dataloader';

async function sendAnalyticsEvents(event: AnalyticsEvent[]) {
  // ...
}

// (event: AnalyticsEvent) => Promise<void>
const sendAnalyticsEvent = batch<AnalyticsEvent, void>(
  async (events) => {
    await sendAnalyticsEvents(events);
    return () => {
      // Nothing to return
    };
  },
  {
    maxBatchSize: 100,
    batchScheduleFn: () => setTimeout(100),
  },
);
```

This will add a 100ms delay even if the `sendAnalyticsEvents` function is very fast, but it may help to reduce load if it's common to have many separate requests each send 1 event.

#### Batching queries in a database connection

It can be tempting to add batching logic to all the queries to our database, given how much it can improve performance. One time where this may not be safe to do is when you sometimes query the database within a transaction, and sometimes outside of the transaction. You can use `batchGroups` to only batch requests that share the same database connection.

```typescript
import {batchGroups} from '@databases/dataloader';
import {anyOf, tables, DbUser, Queryable} from './database';

// (database: Queryable, id: DbUser['id']) => Promise<DbUser | undefined>
const getUser = batchGroups<Queryable, DbUser['id'], DbUser | undefined>(
  async (database: Queryable, userIds) => {
    const users = await tables
      .users(database)
      .find({id: anyOf(userIds)})
      .all();
    return new Map(users.map((u) => [u.id, u]));
  },
);
```

#### Batching queries with a common filter

If you have complex filters that are typically the same between all the requests you want to batch, it can simplify things to only batch requests that have the same filter. You can do this using `batchGroups`.

```typescript
import {batchGroups, groupBy} from '@databases/dataloader';
import database, {tables, DbBlogPost} from './database';

// (filter: Partial<DbBlogPost>, authorId: DbBlogPost['author_id']) => Promise<DbBlogPost[]>
const getBlogPostsByAuthor = batchGroups<
  Partial<DbBlogPost>,
  DbBlogPost['author_id'],
  DbBlogPost[]
>(
  async (filter, authorIds) => {
    const posts = await tables
      .blog_posts(database)
      .find({...filter, author_id: anyOf(authorIds)})
      .all();

    return groupBy(posts, (p) => p.author_id);
  },
  {mapGroupKey: (filter) => JSON.stringify(filter)},
);
```

Now if you call:

```typescript
async function getSomeBlogPosts() {
  return await Promise.all([
    getBlogPostsByAuthor({is_published: true}, 1),
    getBlogPostsByAuthor({is_published: true}, 2),
    getBlogPostsByAuthor({is_published: true}, 3),
    getBlogPostsByAuthor({is_published: false}, 4),
  ]);
}
```

There will be two queries sent to the database (in parallel):

```sql
SELECT * FROM blog_posts WHERE is_published=TRUE AND author_id=ANY(${[1, 2, 3]});
SELECT * FROM blog_posts WHERE id_published=FALSE AND author_id=4;
```

#### Batching Random ID Generation

Because `batch` does not make any attempt to deduplicate, you can use it to batch calls that do not take any parameters by simply using `undefined` as the request type.

```typescript
import {SQLQuery} from '@database/sql';
import {batch} from '@databases/dataloader';
import database from './database';

// Assumes columnName is an INT column in tableName.
// Does not detect conflicts if two Ids are generated at the same time by separate processes
function getIdGenerator(tableName: SQLQuery, columnName: SQLQuery) {
  // For a proposed set of IDs, get a set of the IDs that are already in use
  const getConflictingIds = async (ids: number[]): Promise<Set<number>> => {
    return new Set<number>(
      await database
        .query(
          sql`SELECT ${columName} AS id FROM ${tableName} WHERE ${columnName} = ANY(${ids})`,
        )
        .map((r: any) => r.id),
    );
  };

  // Get the requested number of positive INT32s
  const getRandomIntegers = (count: number): number[] => {
    const result = crypto.getRandomValues(new Int32Array(count)).map(Math.abs);
    if (new Set(result).size !== count) {
      // In the unlikely case that multiple IDs in the same batch conflict, just try again from scratch
      return getRandomIntegers(count);
    }
    return Array.from(result);
  };

  const generateId = batch<undefined, number>(async (requests) => {
    // Generate a random ID for each request
    let ids = getRandomIntegers(requests.length);

    // Check for conflicts with existing IDs
    let existingIds = await getConflictingIds(ids);

    while (existingIds.size) {
      // Generate new IDs for any records that conflict with existing records
      const newRandomIds = getRandomIntegers(existingIds.size);
      let i = 0;
      ids = ids.map((id) =>
        existingIds.has(id) ? newRandomIntegers[i++] : id,
      );

      existingIds = await getConflictingIds(ids);
    }

    // Return the generated random IDs, which are guaranteed not to conflict with existing records
    return ids;
  });

  return async (): Promise<number> => await generateId(undefined);
}

export const generateUserId = getIdGenerator(sql`users`, sql`id`);
```

### Dedupe

Deduplicating can help when you have some data that is requested frequently. You can deduplicate within a single request, meaning you would probably not need to worry about clearing your caches at all. You can also deduplicate across requests using a [Least Recently Used Cache](cache.md).

#### Caching database lookups

The following example caches requests to get users by their IDs.

```typescript
import {dedupeAsync} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

// (userId: DbUser['id']) => Promise<DbUser>
const getUser = dedupeAsync<DbUser['id'], DbUser>(
  async (userId) => {
    return await tables.users(database).findOneRequired({id: userId});
  },
  {
    cache: createCache({name: 'Users'}),
  },
);

function onUserChanged(id: DbUser['id']) {
  getUser.cache.delete(id);
}
```

One downside of this approach is that you can only use this outside of a transaction. The simplest way to resolve this is to separate the implementation from the caching:

```typescript
import {dedupeAsync} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

async function getUserBase(
  database: Queryable,
  userId: DbUser['id'],
): Promise<DbUser> {
  return await tables.users(database).findOneRequired({id: userId});
}

// (userId: DbUser['id']) => Promise<DbUser>
const getUserCached = dedupeAsync<DbUser['id'], DbUser>(
  async (userId) => await getUserBase(userId, database),
  {cache: createCache({name: 'Users'})},
);

export async function getUser(
  db: Queryable,
  userId: DbUser['id'],
): Promise<DbUser> {
  if (db === database) {
    // If we're using the default connection,
    // it's safe to read from the cache
    return await getUserCached(userId);
  } else {
    // If we're inside a transaction, we may
    // need to bypass the cache
    return await getUserBase(db, userId);
  }
}

function onUserChanged(id: DbUser['id']) {
  getUserCached.cache.delete(id);
}
```

#### Caching fetch requests

The following example caches requests to load a user from some imaginary API.

```typescript
import {dedupeAsync} from '@databases/dataloader';

// (userId: number) => Promise<User>
const getUser = dedupeAsync<number, User>(
  async (userId) => {
    const res = await fetch(`https://example.com/api/users/${userId}`);
    if (!res.ok) {
      throw new Error(
        `Failed to get user. Server responded with: ${await res.text()}`,
      );
    }
    return await res.json();
  },
  {
    cache: createCache({name: 'Users', expireAfterMilliseconds: 60_000}),
  },
);
```

#### Caching expensive computation

The following example caches the result of a multiplication. This is a contrived example, since it's always faster to just re-compute this sum.

```typescript
import {dedupeSync} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

// (values: [number, number]) => number
const getUser = dedupeSync<[number, number], number>(
  ([a, b]: [number, number]) => {
    return a * b;
  },
  {
    mapKey: ([a, b]) => `${a}:${b}`,
  },
);
```

#### Caching within a request

One of the challenges of caches is knowing how/when to reset them. A GraphQL call can often request the same data many times. This means that if you can't deal with the complexities of clearing caches when data is updated, you can still potentially benefit from deduplicating calls within a single request.

```typescript
import {dedupeAsync, createMultiKeyMap} from '@databases/dataloader';
import database, {tables, DbUser} from './database';

// ([resolverContext, userId]: [ResolverContext, DbUser['id']]) => Promise<DbUser>
const getUser = dedupeAsync<[ResolverContext, DbUser['id']], DbUser>(
  async ([_resolverContext, userId]) => {
    return await tables.users(database).findOneRequired({id: userId});
  },
  {
    cache: createMultiKeyMap<[ResolverContext, DbUser['id']], Promise<DbUser>>([
      {getCache: () => new WeakMap()},
      {},
    ]),
  },
);
```

The first level of our cache uses a `WeakMap` with the `ResolverContext` as the key. Assuming each new GraphQL request gets a fresh resolver context, our cache will be discarded at the end of each request.

## API

### batch(fn, options)

The batch function is used to batch requests to a load function. The load function is called with an array of keys and must return a promise that resolves to a `BatchResponse`. The result is a function like `(key: TKey) => Promise<TResponse>`, that takes a single request and returns a promise for the single response to that request.

```typescript
function batch<TKey, TResponse>(
  load: (keys: TKey[]) => Promise<BatchResponse<TKey, TResponse>>,
  options?: BatchOptions,
): (key: TKey) => Promise<TResponse>;
```

#### BatchResponse

The `BatchResponse` can be either:

- a function that takes a key and index and returns a result
- an object with a `get` method that takes a key and returns a result (such as a Map).
- an array of the same length and in the same order as the keys passed into the function.

```typescript
type BatchResponseFunction<TKey, TResult> = (
  key: TKey,
  index: number,
  keys: TKey[],
) => Promise<TResult> | TResult;

type BatchResponseMap<TKey, TResult> = {
  get(key: TKey): Promise<TResult> | TResult;
};

type BatchResponseArray<TResult> = readonly (Promise<TResult> | TResult)[];

type BatchResponse<TKey, TResult> =
  | BatchResponseFunction<TKey, TResult>
  | BatchResponseMap<TKey, TResult>
  | BatchResponseArray<TResult>;
```

#### BatchOptions

- `maxBatchSize` - The maximum number of keys to include in a single batch. If this number of keys is reached, the function is called immediately and subsequent requests will result in a new batch.
- `batchScheduleFn` - A function to be called before each batch is executed (unless `maxBatchSize` is reached). `batch` will wait for the promise returned by `batchScheduleFn` to be resolved before it sends the request. By default, this waits until any currently resolved promises have been processed, which works well for batching calls that are run as part of a GraphQL request or in `Promise.all`. If you want to batch requests from a wider time range, you can return a function that is delayed for some time.

### batchGroups(fn, options)

The batchGroups function is used to batch requests to a load function. The load function is called with an array of keys and must return a promise that resolves to a "BatchResponse".

Unlike the batch function, batchGroups takes a "Group Key" as well as the key. Only calls that share the same group key will be batched together.

The function passed in is called with the batch key, and an array of the keys within that batch.

#### BatchGroupsOptions

- `maxBatchSize` - The maximum number of keys to include in a single batch. If this number of keys is reached, the function is called immediately and subsequent requests sill result in a new batch.
- `batchScheduleFn` - A function to be called before each batch is executed (unless `maxBatchSize` is reached). `batch` will wait for the promise returned by `batchScheduleFn` to be resolved before it sends the request. By default, this waits until any currently resolved promises have been processed, which works well for batching calls that are run as part of a GraphQL request or in `Promise.all`. If you want to batch requests from a wider time range, you can return a function that is delayed for some time.
- `mapGroupKey` - If your group keys are objects, you can use `mapGroupKey` to convert them to a primitive value such as a `string` or `number`.
- `groupMap` - Override the `Map` object used to store batches that are in-flight.

### createMultiKeyMap(options)

Creates a Map to use as a cache that can handle an array of keys. This can be used to cache composite keys, or to have caches tied to a given context.

```typescript
function createMultiKeyMap<
  TKeys extends Path,
  TValue,
  TMappedKeys extends Record<keyof TKeys, unknown> = TKeys,
>(
  options?: MultiKeyMapOptions<TKeys, TValue, TMappedKeys>,
): MultiKeyMap<TKeys, TValue>;
```

#### MultiKeyMapOptions

The MultiKeyMapOptions lets you customize the handling of each key. If provided, it should be an array with one object per section in the path. Each of these objects can specify:

- `getCache` - defaults to a function returning `new Map()`. You can use this to override the default Map used to store keys at this level.
- `mapKey` - you can use this to automatically map the key at this level

For example:

```typescript
const postsByUserAndFilterMap = createMultiKeyMap<
  [Queryable, DbUser, PostFilter], // Keys
  DbPost[], // Value stored at each key
  [Queryable, DbUser['id'], string] // Mapped Keys
>([
  {getCache: () => new WeakMap()},
  {mapKey: (user) => user.id},
  {mapKey: (filter) => JSON.stringify(filter)},
]);
```

#### MultiKeyMap.get(keys)

Takes an array representing the key and returns the value, or `undefined` if the value is not in the cache.

#### MultiKeyMap.set(keys, value)

Takes an array representing the key, and a value. The value will be stored at the path specified by the keys.

#### MultiKeyMap.delete(keys)

If you pass an array representing a full key. The value at that key will be removed from the MultiKeyMap.

If you pass a shorter array, all keys under that prefix will be removed.

#### MultiKeyMap.clear()

Removes all keys from the cache.

### dedupeAsync(fn, options)

`dedupeAsync` wraps a function that returns a Promise and deduplicates calls to the function with the same key. The promise for the result is added to the cache immediately, meaning that even concurrent request are deduplicated. If the function throws an error/the returned promise is rejected, it is removed from the cache.

The returned function also has a `fn.cache` property that can be used to access the underlying `Map`. For example, you can use this to delete cached entries after they change.

#### DedupeAsyncOptions

- `cache?: CacheMapInput<TKey, Promise<TResult>>` is the map used to store the cached results.
- `mapKey?: (key: TKey) => TMappedKey` is an optional function used to map keys before passing them to the cache. This can be useful if your keys are complex objects and you want to serialize them to a string for use as cache keys.
- `shouldCache?: (value: TResult, key: TKey) => boolean` an optional function that is called after each response to determine whether the item should remain in the cache. This can be used to prevent `dedupeAsync` from caching results that are not considered errors, but should still be immediately revalidated.

### dedupeSync(fn, options)

`dedupeSync` wraps a function and deduplicates calls to the function with the same key.

The returned function also has a `fn.cache` property that can be used to access the underlying `Map`. For example, you can use this to delete cached entries after they change.

> N.B. If `dedupeSync` returns `undefined`, the result will not be cached.

#### DedupeSyncOptions

- `cache?: CacheMapInput<TKey, TResult>` is the map used to store the cached results.
- `mapKey?: (key: TKey) => TMappedKey` is an optional function used to map keys before passing them to the cache. This can be useful if your keys are complex objects and you want to serialize them to a string for use as cache keys.
- `shouldCache?: (value: TResult, key: TKey) => boolean` an optional function that is called after each response to determine whether the item should remain in the cache. This can be used to prevent `dedupeSync` from caching results that are not considered errors, but should still be immediately revalidated.
- `onNewValue?: (value: TResult, key: TKey) => void` an optional function to be called for each fresh value added to the cache. This can be helpful when working with recursive data structures that may contain cycles. If `onNewValue` throws an error, the value is removed from the cache.

### Utils

#### groupBy(array, getKey)

Inspired by [Array.groupToMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/groupToMap).

The `groupBy` function groups the elements of the `array` using the values returned by a provided `getKey` function. It then returns a function to get an array of the results that match the given key. If no results match the key, it will return the empty array.

For example:

```typescript
import {groupBy} from '@databases/dataloader';

const blogPosts = [
  {author: 1, title: 'Hello'},
  {author: 1, title: 'World'},
  {author: 2, title: 'Awesome'},
];
const blogPostsByAuthor = groupBy(blogPosts, (p) => p.author);
const authorOne = blogPostsByAuthor(1).map((p) => p.title);
// => ['Hello', 'World']
const authorTwo = blogPostsByAuthor(2).map((p) => p.title);
// => ['Awesome']
const authorThree = blogPostsByAuthor(3).map((p) => p.title);
// => []
```

#### parametersSpreadToArray(fn)

Convert a function that takes a single array into a function that accepts multiple parameters.

```typescript
function parametersSpreadToArray<TParameters extends unknown[], TResult>(
  fn: (args: TParameters) => TResult,
): (...args: TParameters) => TResult {
  return (...args) => fn(args);
}
```

#### parametersArrayToSpread(fn)

Convert a function that takes multiple parameters into a function that accepts a single array.

```typescript
function parametersArrayToSpread<TParameters extends unknown[], TResult>(
  fn: (...args: TParameters) => TResult,
): (args: TParameters) => TResult {
  return (args) => fn(...args);
}
```
