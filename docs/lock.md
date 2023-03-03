---
id: lock
title: '@databases/lock'
sidebar_label: Lock
---

The `@databases/lock` package allows you to create efficient locks around async operations in TypeScript / JavaScript. This is used in @databases to ensure that only one operation is running on a connection at any given time.

## API

### createLock(timeoutMilliseconds)

Create a lock, optionally specifying a timeout for **acquiring** a lock.

```typescript
import {createLock} from '@databases/lock';

const lock = createLock(30_000);
```

### Lock.withLock(fn, ...args)

Acquire a lock, then call the function, and then release the lock. The lock is released if the function successfully returns or if the function throws an error.

In the following example, you can call `atomicSlowAdd` multiple times in parallel and trust that all of the calls will be counted, because they each queue up and run one at a time.

```typescript
import {createLock} from '@databases/lock';

const lock = createLock(30_000);

let value = 0;
export async function atomicSlowAdd() {
  return await lock.withLock(async () => {
    const oldValue = value;
    await new Promise((r) => setTimeout(r, 1000));
    value = oldValue + 1;
    return value;
  });
}
```

```javascript
const {createLock} = require('@databases/lock');

const lock = createLock(30_000);

let value = 0;
exports.atomicSlowAdd = async function atomicSlowAdd() {
  return await lock.withLock(async () => {
    const oldValue = value;
    await new Promise((r) => setTimeout(r, 1000));
    value = oldValue + 1;
    return value;
  });
};
```

### createLocksByKey

Create a namespace of locks by some key/id. This lets you ensure that only one process interacts with a given object/record at a time. Similar to `createLock`, you can optionally specify a timeout.

```typescript
import {createLocksByKey} from '@databases/lock';

const locks = createLocksByKey({timeoutMilliseconds: 30_000});
```

Once no lock is held for a given key, that lock is destroyed. If no lock exists for a given key, it is created on demand.

### LocksByKey.withLock(key, fn)

```typescript
import {createLocksByKey} from '@databases/lock';

const locks = createLocksByKey();

export async function atomicSlowAdd(obj: {value: number}) {
  return await locks.withLock(obj, async () => {
    const oldValue = obj.value;
    await new Promise((r) => setTimeout(r, 1000));
    obj.value = oldValue + 1;
  });
}
```

```javascript
const {createLocksByKey} = require('@databases/lock');

const locks = createLocksByKey();

let value = 0;
exports.atomicSlowAdd = async function atomicSlowAdd(obj) {
  return await locks.withLock(obj, async () => {
    const oldValue = obj.value;
    await new Promise((r) => setTimeout(r, 1000));
    obj.value = oldValue + 1;
  });
};
```

## Advanced APIs

You should only use these if you notice performance issues with the standard approaches above.

### Lock.acquireLock()

Request a lock. You must call `releaseLock` exactly once after calling `acquireLock`, otherwise the lock can end up in an invalid state.

You can also include the "Task" you wish to perform while the lock is held, to avoid creating closures that can impact performance.

### Lock.releaseLock()

Release a lock. You MUST call this exactly once for each successful response from acquireLock.

### Lock.pool()

Return this lock object to the pool of locks. Only call this if you are not going to use this lock again. It is ok to never call this, and allow the locks to simply be garbage collected as normal.

### LocksByKey.acquireLock(key)

Request a lock. You must call `releaseLock` exactly once after calling `acquireLock`, otherwise the lock can end up in an invalid state.

You can also include the "Task" you wish to perform while the lock is held, to avoid creating closures that can impact performance.

### LocksByKey.releaseLock(key)

Release a lock. You MUST call this exactly once for each successful response from acquireLock.
