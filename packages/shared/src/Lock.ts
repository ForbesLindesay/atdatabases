import Queue from '@databases/queue';

class QueueRecord {
  public isTimedOut = false;
  public readonly resolve: (record: QueueRecord) => void;
  public readonly createdAt: number;
  constructor(resolve: (record: QueueRecord) => void) {
    this.resolve = resolve;
    this.createdAt = Date.now();
  }
}

interface PoolLock {
  setTimeout(timeoutMilliseconds: number): Lock;
}
const lockPool: PoolLock[] = [];

export interface Lock {
  pool(): Promise<void>;
  aquireLock(): Promise<void>;
  releaseLock(): void;
}
class LockImpl implements Lock {
  private readonly _queue = new Queue<QueueRecord>();
  private _active = true;
  private _executing = false;
  private _timeout: NodeJS.Timeout | undefined;
  private _timeoutMilliseconds: number;
  constructor(timeoutMilliseconds: number) {
    this._timeoutMilliseconds = timeoutMilliseconds;
  }
  public setTimeout(timeoutMilliseconds: number): Lock {
    this._timeoutMilliseconds = timeoutMilliseconds;
    this._active = true;
    return this;
  }
  public async pool(): Promise<void> {
    await this.aquireLock();
    if (this._queue.getLength() !== 0) {
      throw new Error('Cannot pool the lock if it has tasks in the queue.');
    }
    this._active = false;
    this._executing = false;
    lockPool.push(this);
  }
  public async aquireLock(): Promise<void> {
    if (!this._active) {
      throw new Error(
        'Cannot call Lock after returning the object to the pool.',
      );
    }
    if (this._executing) {
      if (this._timeout === undefined) {
        this._timeout = setTimeout(this._onTimeout, this._timeoutMilliseconds);
      }
      return new Promise<QueueRecord>((resolve) => {
        this._queue.push(new QueueRecord(resolve));
      }).then(this._runDelayed);
    }
  }

  public releaseLock(): void {
    const next = this._queue.shift();
    if (next) {
      next.resolve(next);
    } else {
      this._executing = false;
    }
  }

  private readonly _onTimeout = () => {
    this._timeout = undefined;
    const record = this._queue.shift();
    if (record) {
      record.isTimedOut = true;
      record.resolve(record);
    }
  };
  private readonly _runDelayed = (d: QueueRecord): void => {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }
    const nextRecord = this._queue.peek();
    if (nextRecord) {
      this._timeout = setTimeout(
        this._onTimeout,
        this._timeoutMilliseconds + nextRecord.createdAt - Date.now(),
      );
    }
    if (d.isTimedOut) {
      throw new Error(
        `Timed out waiting for lock after ${this._timeoutMilliseconds}ms`,
      );
    }
  };
}

export function getLock(timeoutMilliseconds: number): Lock {
  if (lockPool.length) {
    const record = lockPool.pop()!;
    return record.setTimeout(timeoutMilliseconds);
  } else {
    return new LockImpl(timeoutMilliseconds);
  }
}
