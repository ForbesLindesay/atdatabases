---
id: lock
title: @databases/lock
sidebar_label: lock
---

The `@databases/lock` package allows you to create efficient locks around async operations in TypeScript / JavaScript. This is used in @databases to ensure that only one operation is running on a connection at any given time.

## API

```typescript
export interface Lock {
  /**
   * Aquire a lock, then call the function, and then release the
   * lock. The lock is released if the function successfully returns
   * or if the function throws an error.
   */
  withLock<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult> | TResult,
    ...args: TArgs
  ): Promise<TResult>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `aquireLock`, otherwise the lock can end up
   * in an invalid state.
   */
  aquireLock(): Promise<void>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `aquireLock`, otherwise the lock can end up
   * in an invalid state.
   *
   * You can include the "Task" you wish to perform while the
   * lock is held, to avoid creating closures that can impact
   * performance.
   */
  aquireLock<T>(task: T): Promise<T>;
  /**
   * Release a lock. You MUST call this exactly once for each
   * successful response from aquireLock
   */
  releaseLock(): void;
  /**
   * Return this lock object to the pool of locks. Only call this
   * if you are not going to use this lock again. It is ok to
   * never call this, and allow the locks to simply be garbage
   * collected as normal.
   */
  pool(): Promise<void>;
}
export function getLock(timeoutMilliseconds?: number): Lock;

export interface LocksByKeyOptions<TKey = string> {
  store?: {
    get(key: TKey): undefined | Lock;
    set(key: TKey, lock: Lock): unknown;
    delete(key: TKey): unknown;
  };
  timeoutMilliseconds?: number;
}

export interface LocksByKey<TKey = string> {
  /**
   * Aquire a lock, then call the function, and then release the
   * lock. The lock is released if the function successfully returns
   * or if the function throws an error.
   */
  withLock<TArgs extends any[], TResult>(
    key: TKey,
    fn: (...args: TArgs) => Promise<TResult> | TResult,
    ...args: TArgs
  ): Promise<TResult>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `aquireLock`, otherwise the lock can end up
   * in an invalid state.
   */
  aquireLock(key: TKey): Promise<void>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `aquireLock`, otherwise the lock can end up
   * in an invalid state.
   *
   * You can include the "Task" you wish to perform while the
   * lock is held, to avoid creating closures that can impact
   * performance.
   */
  aquireLock<T>(key: TKey, task: T): Promise<T>;
  /**
   * Release a lock. You MUST call this exactly once for each
   * successful response from aquireLock
   */
  releaseLock(key: TKey): void;
}

export function getLocksByKey<TKey = string>(
  options?: LocksByKeyOptions<TKey>,
): LocksByKey<TKey>;
```
