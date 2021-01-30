import Queue from './Queue';

/**
 * A connetion in the pool.
 */
class PoolConnectionRecord<T> {
  public readonly connection: T;
  private readonly _release: (record: this) => void;
  private readonly _dispose: (record: this) => void;
  private readonly _onReleaseTimeout: (record: this) => void;
  private readonly _onIdleTimeout: (record: this) => void;
  private readonly _releaseTimeoutMilliseconds: number | undefined;
  private readonly _idleTimeoutMilliseconds: number | undefined;
  private _idleTimeout: number | undefined;
  private _releaseTimeout: number | undefined;
  private _usageCount = 0;
  private _disposed = false;

  constructor(
    connection: T,
    release: (record: PoolConnectionRecord<T>) => void,
    dispose: (record: PoolConnectionRecord<T>) => void,
    onReleaseTimeout: (record: PoolConnectionRecord<T>) => void,
    onIdleTimeout: (record: PoolConnectionRecord<T>) => void,
    releaseTimeoutMilliseconds: number | undefined,
    idleTimeoutMilliseconds: number | undefined,
  ) {
    this.connection = connection;
    this._release = release;
    this._dispose = dispose;
    this._onReleaseTimeout = onReleaseTimeout;
    this._onIdleTimeout = onIdleTimeout;
    this._releaseTimeoutMilliseconds = releaseTimeoutMilliseconds;
    this._idleTimeoutMilliseconds = idleTimeoutMilliseconds;
  }

  public getUsageCount() {
    return this._usageCount;
  }
  public markAsActive() {
    this._usageCount++;
    if (this._releaseTimeoutMilliseconds) {
      this._releaseTimeout = setTimeout(
        this._onReleaseTimeout,
        this._releaseTimeoutMilliseconds,
        this,
      );
    }
    clearTimeout(this._idleTimeout);
    return this;
  }
  public release() {
    if (this._disposed) {
      return;
    }
    clearTimeout(this._releaseTimeout);
    this._release(this);
    if (this._idleTimeoutMilliseconds) {
      this._idleTimeout = setTimeout(
        this._onIdleTimeout,
        this._idleTimeoutMilliseconds,
        this,
      );
    }
  }
  public dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    clearTimeout(this._releaseTimeout);
    this._dispose(this);
  }
  public isDisposed() {
    return this._disposed;
  }
  public markAsDisposed() {
    this._disposed = true;
  }
}

/**
 * A task in the queue that is waiting for a connection
 * to become available.
 */
class Waiter<T> {
  static waiterTimeout<T>(waiter: Waiter<T>) {
    waiter._timedOut = true;
    waiter._reject(queueTimeoutError());
    (waiter as any)._resolve = null;
    (waiter as any)._reject = null;
  }
  private readonly _resolve: (connection: PoolConnectionRecord<T>) => unknown;
  private readonly _reject: (err: Error) => unknown;
  private _timedOut = false;
  private readonly _timeout: number | undefined;
  constructor(
    resolve: (connection: PoolConnectionRecord<T>) => unknown,
    reject: (err: Error) => unknown,
    timeout: number | undefined,
  ) {
    this._resolve = resolve;
    this._reject = reject;
    if (timeout) {
      // tslint:disable-next-line: no-unbound-method
      this._timeout = setTimeout(Waiter.waiterTimeout, timeout, this);
    }
  }
  public isTimedOut() {
    return this._timedOut;
  }
  public resolve(connection: PoolConnectionRecord<T>) {
    clearTimeout(this._timeout);
    this._resolve(connection);
  }
  public reject(err: Error) {
    clearTimeout(this._timeout);
    this._reject(err);
  }
}

/**
 * A connection returned from a pool. When it is no longer
 * needed, you must call `release` or `dispose` exactly
 * once, in order to return it to the pool.
 */
export interface PoolConnection<T> {
  /**
   * The underlying connection obect
   */
  readonly connection: T;
  /**
   * Release the connection back into the pool
   * so it can be re-used.
   */
  release(): void;
  /**
   * Close a connection and inform the pool that
   * it has been destroyed, so that the pool can
   * create a new connection for the next request.
   */
  dispose(): void;
}

class PoolConnectionImpl<T> implements PoolConnection<T> {
  public readonly connection: T;
  private readonly _record: PoolConnectionRecord<T>;
  private _released = false;
  constructor(record: PoolConnectionRecord<T>) {
    this.connection = record.connection;
    this._record = record.markAsActive();
  }
  release() {
    if (this._released) {
      throw doubleReleaseError();
    }
    this._released = true;
    this._record.release();
  }
  dispose() {
    if (this._released) {
      throw doubleReleaseError();
    }
    this._released = true;
    this._record.dispose();
  }
}

/**
 * Options for configuring a connection pool
 */
export interface PoolOptions<T> {
  /**
   * `getConnection` is used to create a new connection. If it
   * throws an error, no connection is added to the pool.
   */
  getConnection: () => Promise<T>;
  /**
   * `closeConnection` is called in any of the following cases:
   *
   * 1. The connection is unused for `idleTimeoutMilliseconds`
   * 2. The connection has been used more than `maxUses`
   * 3. `.dispose()` is called after aquiring a connection
   * 4. `.drain()` has been called on the connection pool
   *
   * N.B. If `closeConnection` throws an error, your app will
   * crash. It is up to you to handle any errors that may happen
   * while closing a connection.
   */
  closeConnection: (connection: T) => Promise<void>;
  /**
   * Handler for when neither `release` nor `dispose` is
   * called within `releaseTimeoutMilliseconds`. This is
   * called instead of `closeConnection`, so it should
   * ensure the connection is properly closed. If you set
   * `releaseTimeoutMilliseconds` and do not provide an
   * implementation of `onReleaseTimeout`, your app will
   * crash with an error when a task times out.
   */
  onReleaseTimeout?: (connetion: T) => Promise<void>;
  /**
   * The maximum number of connections that can be created
   * in the pool at any one time.
   *
   * @default Infinity
   */
  maxSize?: number;
  /**
   * The maximum number of times a connection can be returned
   * from the pool before it is automatically disposed of and
   * a new connection is allocated.
   *
   * @default Infinity
   */
  maxUses?: number;
  /**
   * How many milliseconds a connection can be idle before it
   * is automatically closed and removed from the pool.
   *
   * @default Infinity
   */
  idleTimeoutMilliseconds?: number;
  /**
   * How many milliseconds is a task allowed to run before releasing
   * the connection.
   *
   * N.B. If you supply a value for `releaseTimeoutMilliseconds`, you
   * should always implement `onReleaseTimeout` otherwise your application
   * will simply crash if this timeout is reached.
   *
   * @default Infinity
   */
  releaseTimeoutMilliseconds?: number;
  /**
   * How many milliseconds to wait in the queue for a connection
   * before rejecting with a timeout error.
   *
   * @default Infinity
   */
  queueTimeoutMilliseconds?: number;
}

/**
 * A pool of connections that are automatically managed and
 * recycled.
 */
export interface ConnectionPool<T> {
  /**
   * How many connections are currently active, both
   * idle connections in the pool, and connections that
   * are in use.
   */
  getConnectionsCount(): number;
  /**
   * How many connections are active, but not currently
   * in use.
   */
  getIdleConnectionsCount(): number;
  /**
   * How many processes are in the queue waiting for
   * a connection.
   */
  getQueueLength(): number;
  /**
   * Retrieve a connection from the connection pool.
   *
   * N.B. you must call either `release` or `dispose`
   * otherwise your connection pool will eventually
   * be stuck and your app will stall.
   */
  getConnection(): Promise<PoolConnection<T>>;
  /**
   * Prevent any further calls to `getConnection`,
   * wait for all queued and in-progress tasks, and
   * then close all connections. It is safe to call
   * this method multiple times.
   */
  drain(): Promise<void>;
}
class ConnectionPoolImpl<T> implements ConnectionPool<T> {
  private readonly _connections = new Queue<PoolConnectionRecord<T>>();
  private readonly _waiters = new Queue<Waiter<T>>();
  private readonly _options: PoolOptions<T>;
  /**
   * The number of connections that are currently in the pool
   */
  private _poolSize = 0;

  private _draining = false;
  private readonly _drained: Promise<void>;
  private _onDrained!: () => void;

  /**
   * Create a new connection pool
   */
  constructor(options: PoolOptions<T>) {
    this._options = options;
    this._drained = new Promise<void>((resolve) => {
      this._onDrained = resolve;
    });
  }

  /**
   * How many connections are currently active, both
   * idle connections in the pool, and connections that
   * are in use.
   */
  getConnectionsCount() {
    return this._poolSize;
  }

  /**
   * How many connections are active, but not currently
   * in use.
   */
  getIdleConnectionsCount() {
    return this._connections.getLength();
  }

  /**
   * How many processes are in the queue waiting for
   * a connection.
   */
  getQueueLength() {
    return this._waiters.getLength();
  }

  private _getExistingConnection() {
    let conn = this._connections.shift();
    while (conn && conn.isDisposed()) {
      conn = this._connections.shift();
    }
    return conn;
  }
  private _getWaiter() {
    let waiter = this._waiters.shift();
    while (waiter && waiter.isTimedOut()) {
      waiter = this._waiters.shift();
    }
    return waiter;
  }
  private _canAllocateConnection() {
    return (
      this._options.maxSize === undefined ||
      this._poolSize < this._options.maxSize
    );
  }
  private async _allocateConnection() {
    this._poolSize++;
    return this._options.getConnection().then(
      (connection) =>
        new PoolConnectionRecord(
          connection,
          this._release,
          this._dispose,
          this._onReleaseTimeout,
          this._onIdleTimeout,
          this._options.releaseTimeoutMilliseconds,
          this._options.idleTimeoutMilliseconds,
        ),
      (err) => {
        this._poolSize--;
        this._onPoolShrink();
        throw err;
      },
    );
  }
  private _onPoolShrink() {
    const waiter = this._getWaiter();
    if (waiter) {
      this._allocateConnection().then(
        (record) => {
          if (record) {
            waiter.resolve(record);
          } else {
            // this should never happen
            waiter.reject(new Error('Error allocating connection'));
          }
        },
        (err) => waiter.reject(err),
      );
    } else if (this._draining && this._poolSize === 0) {
      this._onDrained();
    }
  }

  private readonly _release = (record: PoolConnectionRecord<T>) => {
    if (
      this._options.maxUses !== undefined &&
      record.getUsageCount() >= this._options.maxUses
    ) {
      this._dispose(record);
      return;
    }
    const waiter = this._getWaiter();
    if (waiter) {
      waiter.resolve(record);
    } else if (this._draining) {
      void this._options
        .closeConnection(record.connection)
        .catch(globalError)
        .then(() => {
          this._poolSize--;
          if (this._poolSize === 0) {
            this._onDrained();
          }
        });
    } else {
      this._connections.push(record);
    }
  };
  private readonly _dispose = (record: PoolConnectionRecord<T>) => {
    void this._options
      .closeConnection(record.connection)
      .catch(globalError)
      .then(() => {
        this._poolSize--;
        this._onPoolShrink();
      });
  };
  private readonly _onIdleTimeout = (record: PoolConnectionRecord<T>) => {
    record.markAsDisposed();
    void this._options
      .closeConnection(record.connection)
      .catch(globalError)
      .then(() => {
        this._poolSize--;
        this._onPoolShrink();
      });
  };
  private readonly _onReleaseTimeout = (record: PoolConnectionRecord<T>) => {
    record.markAsDisposed();
    if (this._options.onReleaseTimeout) {
      void this._options
        .onReleaseTimeout(record.connection)
        .catch(globalError)
        .then(() => {
          this._poolSize--;
          this._onPoolShrink();
        });
    } else {
      globalError(releaseTimeoutError());
    }
  };

  /**
   * Retrieve a connection from the connection pool.
   *
   * N.B. you must call either `release` or `dispose`
   * otherwise your connection pool will eventually
   * be stuck and your app will stall.
   */
  async getConnection(): Promise<PoolConnection<T>> {
    const record =
      this._getExistingConnection() ??
      (this._canAllocateConnection()
        ? await this._allocateConnection()
        : await new Promise<PoolConnectionRecord<T>>((resolve, reject) => {
            this._waiters.push(
              new Waiter(
                resolve,
                reject,
                this._options.queueTimeoutMilliseconds,
              ),
            );
          }));
    return new PoolConnectionImpl(record);
  }

  /**
   * Prevent any further calls to `getConnection`,
   * wait for all queued and in-progress tasks, and
   * then close all connections. It is safe to call
   * this method multiple times.
   */
  async drain(): Promise<void> {
    this._draining = true;
    for (const c of this._connections.clear()) {
      this._release(c);
    }
    if (this._poolSize) {
      await this._drained;
    }
  }
}

/**
 * Create a new ConnectionPool to manage connections
 */
export default function createConnectionPool<T>(
  options: PoolOptions<T>,
): ConnectionPool<T> {
  return new ConnectionPoolImpl(options);
}

function doubleReleaseError() {
  return Object.assign(
    new Error(
      'Release called on client which has already been released to the pool.',
    ),
    {code: 'CONNECTION_POOL:DOUBLE_RELEASE'},
  );
}

function queueTimeoutError() {
  return Object.assign(new Error('Timed out waiting for connection.'), {
    code: 'CONNECTION_POOL:QUEUE_TIMEOUT',
  });
}
function releaseTimeoutError() {
  return Object.assign(
    new Error('Timed out waiting for .release() or .dispose() to be called.'),
    {
      code: 'CONNECTION_POOL:RELEASE_TIMEOUT',
    },
  );
}

function globalError(err: Error) {
  setImmediate(() => {
    throw err;
  });
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
});
