import Queue from '@databases/queue';

class FunctionCallTask<TArgs extends any[], TResult> {
  public readonly fn: (...args: TArgs) => Promise<TResult> | TResult;
  public readonly args: TArgs;
  constructor(fn: (...args: TArgs) => Promise<TResult> | TResult, args: TArgs) {
    this.fn = fn;
    this.args = args;
  }
}
class QueueRecord {
  public isTimedOut = false;
  public readonly resolve: (record: QueueRecord) => void;
  public readonly task: unknown;
  public readonly createdAt: number;
  constructor(resolve: (record: QueueRecord) => void, task: unknown) {
    this.resolve = resolve;
    this.task = task;
    this.createdAt = Date.now();
  }
}

interface PoolLock {
  unpool(
    timeoutMilliseconds: number | undefined,
    onEmpty: undefined | ((lock: Lock, context: any) => void),
    context: any,
  ): Lock;
}
const lockPool: PoolLock[] = [];

export interface Lock {
  /**
   * Acquire a lock, then call the function, and then release the
   * lock. The lock is released if the function successfully returns
   * or if the function throws an error.
   */
  withLock<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult> | TResult,
    ...args: TArgs
  ): Promise<TResult>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `acquireLock`, otherwise the lock can end up
   * in an invalid state.
   */
  acquireLock(): Promise<void>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `acquireLock`, otherwise the lock can end up
   * in an invalid state.
   *
   * You can include the "Task" you wish to perform while the
   * lock is held, to avoid creating closures that can impact
   * performance.
   */
  acquireLock<T>(task: T): Promise<T>;
  /**
   * Release a lock. You MUST call this exactly once for each
   * successful response from acquireLock
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
class LockImpl implements Lock {
  private readonly _queue = new Queue<QueueRecord>();
  private _active = true;
  private _executing = false;
  private _timeout: any;
  private _timeoutMilliseconds: number | undefined;
  private _onEmpty: undefined | ((lock: Lock, context: any) => void);
  private _context: any;
  constructor(
    timeoutMilliseconds: number | undefined,
    onEmpty: undefined | ((lock: Lock, context: any) => void),
    context: any,
  ) {
    this._timeoutMilliseconds =
      timeoutMilliseconds === Infinity ? undefined : timeoutMilliseconds;
    this._onEmpty = onEmpty;
    this._context = context;
  }
  public unpool(
    timeoutMilliseconds: number | undefined,
    onEmpty: undefined | ((lock: Lock, context: any) => void),
    context: any,
  ): Lock {
    this._timeoutMilliseconds =
      timeoutMilliseconds === Infinity ? undefined : timeoutMilliseconds;
    this._onEmpty = onEmpty;
    this._context = context;
    this._active = true;
    return this;
  }
  public async pool(): Promise<void> {
    await this.acquireLock();
    if (this._queue.getLength() !== 0) {
      throw new Error('Cannot pool the lock if it has tasks in the queue.');
    }
    this._onEmpty = undefined;
    this._context = undefined;
    this._active = false;
    this._executing = false;
    lockPool.push(this);
  }
  public async acquireLock(): Promise<void>;
  public async acquireLock<T>(task: T): Promise<T>;
  public async acquireLock<T>(task?: T): Promise<T | void> {
    if (!this._active) {
      throw new Error(
        'Cannot call Lock after returning the object to the pool.',
      );
    }
    if (this._executing) {
      if (
        this._timeout === undefined &&
        this._timeoutMilliseconds !== undefined
      ) {
        this._timeout = setTimeout(this._onTimeout, this._timeoutMilliseconds);
      }
      return new Promise<QueueRecord>((resolve) => {
        this._queue.push(new QueueRecord(resolve, task));
      }).then(this._runDelayed);
    } else {
      this._executing = true;
      return task;
    }
  }

  public releaseLock(): void {
    const next = this._queue.shift();
    if (next) {
      next.resolve(next);
    } else {
      this._executing = false;
      if (this._onEmpty) this._onEmpty(this, this._context);
    }
  }

  public async withLock<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult> | TResult,
    ...args: TArgs
  ): Promise<TResult> {
    return await this.acquireLock(new FunctionCallTask(fn, args)).then(
      this._onFunctionCallTaskLock,
    );
  }

  private readonly _onFunctionCallTaskLock = async <
    TArgs extends any[],
    TResult
  >(
    task: FunctionCallTask<TArgs, TResult>,
  ): Promise<TResult> => {
    try {
      return await task.fn(...task.args);
    } finally {
      this.releaseLock();
    }
  };
  private readonly _onTimeout = () => {
    this._timeout = undefined;
    const record = this._queue.shift();
    if (record) {
      record.isTimedOut = true;
      record.resolve(record);
    }
  };
  private readonly _runDelayed = (d: QueueRecord): any => {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }
    const nextRecord = this._queue.peek();
    if (nextRecord && this._timeoutMilliseconds !== undefined) {
      this._timeout = setTimeout(
        this._onTimeout,
        this._timeoutMilliseconds + nextRecord.createdAt - Date.now(),
      );
    }
    if (d.isTimedOut) {
      this.releaseLock();
      throw new Error(
        `Timed out waiting for lock after ${this._timeoutMilliseconds}ms`,
      );
    }
    return d.task;
  };
}

export function createLock(timeoutMilliseconds?: number): Lock {
  if (lockPool.length) {
    const record = lockPool.pop()!;
    return record.unpool(timeoutMilliseconds, undefined, undefined);
  } else {
    return new LockImpl(timeoutMilliseconds, undefined, undefined);
  }
}
/**
 * @deprecated use createLock
 */
export const getLock = createLock;

function createLockForKey<TKey>(
  timeoutMilliseconds: number | undefined,
  onEmpty: (lock: Lock, key: TKey) => void,
  key: TKey,
): Lock {
  if (lockPool.length) {
    const record = lockPool.pop()!;
    return record.unpool(timeoutMilliseconds, onEmpty, key);
  } else {
    return new LockImpl(timeoutMilliseconds, onEmpty, key);
  }
}

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
   * Acquire a lock, then call the function, and then release the
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
   * after calling `acquireLock`, otherwise the lock can end up
   * in an invalid state.
   */
  acquireLock(key: TKey): Promise<void>;
  /**
   * Request a lock. You must call `releaseLock` exaclty once
   * after calling `acquireLock`, otherwise the lock can end up
   * in an invalid state.
   *
   * You can include the "Task" you wish to perform while the
   * lock is held, to avoid creating closures that can impact
   * performance.
   */
  acquireLock<T>(key: TKey, task: T): Promise<T>;
  /**
   * Release a lock. You MUST call this exactly once for each
   * successful response from acquireLock
   */
  releaseLock(key: TKey): void;
}
class LocksByKeyImpl<TKey = string> {
  private readonly _store: {
    get(key: TKey): undefined | Lock;
    set(key: TKey, lock: Lock): unknown;
    delete(key: TKey): unknown;
  };
  private readonly _timeoutMilliseconds: number | undefined;
  constructor(options: LocksByKeyOptions<TKey>) {
    this._store = options.store ?? new Map<TKey, Lock>();
    this._timeoutMilliseconds = options.timeoutMilliseconds;
  }
  acquireLock(key: TKey): Promise<void>;
  acquireLock<T>(key: TKey, task: T): Promise<T>;
  async acquireLock<T>(key: TKey, task?: T): Promise<T | void> {
    const existingLock = this._store.get(key);
    if (existingLock) {
      return await existingLock.acquireLock(task);
    }
    const newLock = createLockForKey(
      this._timeoutMilliseconds,
      this._onEmpty,
      key,
    );
    this._store.set(key, newLock);
    return await newLock.acquireLock(task);
  }

  async withLock<TArgs extends any[], TResult>(
    key: TKey,
    fn: (...args: TArgs) => Promise<TResult> | TResult,
    ...args: TArgs
  ): Promise<TResult> {
    const existingLock = this._store.get(key);
    if (existingLock) {
      return await existingLock.withLock(fn, ...args);
    }
    const newLock = createLockForKey(
      this._timeoutMilliseconds,
      this._onEmpty,
      key,
    );
    this._store.set(key, newLock);
    return await newLock.withLock(fn, ...args);
  }
  releaseLock(key: TKey) {
    const existingLock = this._store.get(key);
    if (existingLock) {
      existingLock.releaseLock();
    }
  }
  private readonly _onEmpty = (lock: Lock, key: TKey) => {
    this._store.delete(key);
    void lock.pool();
  };
}
export function createLocksByKey<TKey = string>(
  options: LocksByKeyOptions<TKey> = {},
): LocksByKey<TKey> {
  return new LocksByKeyImpl<TKey>(options);
}

/**
 * @deprecated use createLocksByKey
 */
export const getLocksByKey = createLocksByKey;
