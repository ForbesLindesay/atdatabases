import Queue from '@databases/queue';
import defer from './utils/defer';
import {
  doubleReleaseError,
  openTimeout,
  queueTimeoutError,
} from './utils/errors';
import {isTimeout, Timeout} from './utils/timeout';
import Waiter from './utils/Waiter';
import IPoolRecord, {
  getPoolRecord,
  IActivePoolRecord,
  IDisposedPoolRecord,
  IIdlePoolRecord,
  isActivePoolRecord,
  isDisposedPoolRecord,
  isIdlePoolRecord,
  PoolRecordState,
  setRecordState,
} from './IPoolRecord';
import PoolOptions, {PoolOptionsObject} from './PoolOptions';
import PoolConnection from './PoolConnection';
import ConnectionPool from './ConnectionPool';

export type {PoolOptions, PoolConnection, ConnectionPool};

const RESOLVED_PROMISE = Promise.resolve();

class PoolConnectionImpl<T> implements PoolConnection<T> {
  public readonly connection: T;
  private readonly _record: IActivePoolRecord<T>;
  private _released = false;
  private readonly _pool: ConnectionPoolState<T>;
  private readonly _timeout: NodeJS.Timeout | undefined;
  private _timedOut = false;
  constructor(
    record: IActivePoolRecord<T>,
    pool: ConnectionPoolState<T>,
    onReleaseTimeout: (record: IActivePoolRecord<T>) => void,
    releaseTimeoutMilliseconds: number,
  ) {
    this.connection = record.connection!;
    this._record = record;
    this._pool = pool;
    if (releaseTimeoutMilliseconds !== Infinity) {
      this._timeout = setTimeout(() => {
        this._timedOut = true;
        onReleaseTimeout(record);
      }, releaseTimeoutMilliseconds);
    }
  }
  release() {
    if (this._timedOut) {
      return;
    }
    if (this._timeout !== undefined) {
      clearTimeout(this._timeout);
    }
    if (this._released) {
      throw doubleReleaseError();
    }
    this._released = true;
    this._pool._releaseConnection(this._record);
  }
  dispose() {
    if (this._timedOut) {
      return;
    }
    if (this._timeout !== undefined) {
      clearTimeout(this._timeout);
    }
    if (this._released) {
      throw doubleReleaseError();
    }
    this._released = true;
    this._pool._closeConnection(this._record);
  }
}

class ConnectionPoolState<T> implements ConnectionPool<T> {
  private readonly _options: PoolOptionsObject<T>;

  private _isDraining = false;
  private _totalConnectionsCount = 0;

  private readonly _idleConnections = new Queue<
    IIdlePoolRecord<T> | IDisposedPoolRecord<T>
  >();
  private readonly _waiters = new Queue<
    Waiter<IActivePoolRecord<T> | IIdlePoolRecord<T>>
  >();

  private readonly _drained: Promise<void>;
  private readonly _onDrained: () => void;

  constructor(options: PoolOptionsObject<T>) {
    this._options = options;
    const [drained, onDrained] = defer<void>();
    this._drained = drained;
    this._onDrained = onDrained;
  }

  private _increaseTotalConnectionsCount() {
    this._totalConnectionsCount++;
  }
  private _decreaseTotalConnectionsCount() {
    this._totalConnectionsCount--;
    const nextWaiter = this._getNextWaiter();
    if (nextWaiter) {
      nextWaiter.resolve(this._openConnection());
    }
    if (this._isDraining && this._totalConnectionsCount === 0) {
      this._onDrained();
    }
  }
  private readonly _onIdleTimeout = (record: IIdlePoolRecord<T>) => {
    this._closeConnection(record);
  };
  private readonly _onReleaseTimeout = (record: IActivePoolRecord<T>) => {
    const connection = record.connection;
    setRecordState(record, PoolRecordState.Disposed);
    this._decreaseTotalConnectionsCount();
    this._options.onReleaseTimeout(connection);
  };

  private _canOpenConnection() {
    if (!this._options.maxSize) return true;
    return this._totalConnectionsCount < this._options.maxSize;
  }
  private async _openConnection(): Promise<IIdlePoolRecord<T>> {
    const [destroyed, destroy] = defer<void>();
    this._increaseTotalConnectionsCount();
    return RESOLVED_PROMISE.then(() => this._options.openConnection(destroy))
      .then((connection) => {
        if (isTimeout(connection)) {
          throw openTimeout();
        }
        const record = getPoolRecord(connection);
        const r: IPoolRecord<T> = record;
        void destroyed.then(() => {
          if (isActivePoolRecord(r)) {
            r.shouldDestroy = true;
          } else if (isIdlePoolRecord(r)) {
            this._closeConnection(r);
          }
        });
        return record;
      })
      .catch((err) => {
        this._decreaseTotalConnectionsCount();
        throw err;
      });
  }
  _releaseConnection(record: IActivePoolRecord<T>): void {
    if (!isActivePoolRecord(record)) {
      throw new Error(
        'Cannot call releaseConnection when record that is not active',
      );
    }
    if (record.shouldDestroy || record.activateCount >= this._options.maxUses) {
      this._closeConnection(record);
      return;
    }
    const waiter = this._getNextWaiter();
    if (waiter) {
      waiter.resolve(record);
    } else if (this._isDraining) {
      this._closeConnection(record);
    } else {
      const err = this._options.onIdle(record.connection);
      if (err) {
        this._decreaseTotalConnectionsCount();
        throw err;
      }
      this._idleConnections.push(
        setRecordState(
          record,
          PoolRecordState.Idle,
          this._onIdleTimeout,
          this._options.idleTimeoutMilliseconds,
        ),
      );
    }
  }
  _closeConnection(record: IActivePoolRecord<T> | IIdlePoolRecord<T>): void {
    const connection = record.connection;
    if (isDisposedPoolRecord(record)) {
      throw new Error(
        'Cannot call closeConnection when record is already disposed',
      );
    }
    setRecordState(record, PoolRecordState.Disposed);
    this._options.closeConnection(connection).then(
      () => {
        this._decreaseTotalConnectionsCount();
      },
      () => {
        this._decreaseTotalConnectionsCount();
      },
    );
  }

  private _getNextIdleRecord(): IIdlePoolRecord<T> | undefined {
    while (true) {
      const record = this._idleConnections.shift();
      if (record === undefined || isIdlePoolRecord(record)) {
        return record;
      }
    }
  }

  private _getNextWaiter():
    | Waiter<IActivePoolRecord<T> | IIdlePoolRecord<T>>
    | undefined {
    while (true) {
      const record = this._waiters.shift();
      if (record === undefined || !record.isTimedOut()) {
        return record;
      }
    }
  }

  /**
   * Retrieve a connection from the connection pool.
   *
   * N.B. you must call either `release` or `dispose`
   * otherwise your connection pool will eventually
   * be stuck and your app will stall.
   */
  public async getConnection(): Promise<PoolConnection<T>> {
    const record =
      this._getNextIdleRecord() ??
      (this._canOpenConnection()
        ? await this._openConnection()
        : await new Promise<
            IActivePoolRecord<T> | IIdlePoolRecord<T> | Timeout
          >((resolve) => {
            this._waiters.push(
              new Waiter(resolve, this._options.queueTimeoutMilliseconds),
            );
          }));

    if (isTimeout(record)) {
      throw queueTimeoutError();
    }

    if (isIdlePoolRecord(record)) {
      const err = this._options.onActive(record.connection);
      if (err) {
        this._decreaseTotalConnectionsCount();
        throw err;
      }
    }
    const activeRecord = setRecordState(record, PoolRecordState.Active);
    return new PoolConnectionImpl(
      activeRecord,
      this,
      this._onReleaseTimeout,
      this._options.releaseTimeoutMilliseconds,
    );
  }

  /**
   * How many connections are currently active, both
   * idle connections in the pool, and connections that
   * are in use.
   */
  public getConnectionsCount() {
    return this._totalConnectionsCount;
  }

  /**
   * How many connections are active, but not currently
   * in use.
   *
   * TODO: this may not be accurate
   */
  public getIdleConnectionsCount() {
    return this._idleConnections.getLength();
  }

  /**
   * How many processes are in the queue waiting for
   * a connection.
   */
  public getQueueLength() {
    return this._waiters.getLength();
  }

  public async drain() {
    this._isDraining = true;
    for (const connection of this._idleConnections.clear()) {
      if (isIdlePoolRecord(connection)) {
        this._closeConnection(connection);
      }
    }
    if (this._totalConnectionsCount === 0) {
      this._onDrained();
    }

    await this._drained;
  }
}

/**
 * Create a new ConnectionPool to manage connections
 */
export default function createConnectionPool<T>(
  options: PoolOptions<T>,
): ConnectionPool<T> {
  return new ConnectionPoolState(new PoolOptionsObject(options));
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
});
