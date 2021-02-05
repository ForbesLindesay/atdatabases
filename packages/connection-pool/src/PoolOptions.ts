import {attemptHook, globalError} from './utils/errors';
import {isTimeout, Timeout, withTimeout} from './utils/timeout';

function zeroToInfinity(
  value: number | undefined,
  defaultValue: number = Infinity,
): number {
  if (value === undefined) {
    return defaultValue;
  } else if (value === 0) {
    return Infinity;
  } else {
    return value;
  }
}

/**
 * Options for configuring a connection pool
 */
export default interface PoolOptions<T> {
  /**
   * `getConnection` is used to create a new connection. If it
   * throws an error, no connection is added to the pool.
   */
  openConnection: (removeFromPool: () => void) => Promise<T>;

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
   * Handler to be called every time a connection from the pool
   * is activated.
   */
  onActive?: (connetion: T) => void;

  /**
   * Handler to be called every time a connection is returned
   * to the pool.
   */
  onIdle?: (connetion: T) => void;

  /**
   * Handler for when neither `release` nor `dispose` is
   * called within `releaseTimeoutMilliseconds`. This is
   * called instead of `closeConnection`, so it should
   * ensure the connection is properly closed. If you set
   * `releaseTimeoutMilliseconds`, you must also provide an
   * implementation of `onReleaseTimeout`.
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

  /**
   * How many milliseconds to wait for a connection to open.
   *
   * @default 60_000
   */
  openConnectionTimeoutMilliseconds?: number;

  /**
   * How many milliseconds to wait for a connection to close.
   *
   * @default 60_000
   */
  closeConnectionTimeoutMilliseconds?: number;

  onTimeoutClosingConnection?: () => void;
  onErrorClosingConnection?: (err: Error) => void;
}

export class PoolOptionsObject<T> {
  private readonly _options: PoolOptions<T>;

  /**
   * The maximum number of connections that can be created
   * in the pool at any one time.
   *
   * @default Infinity
   */
  readonly maxSize: number;

  /**
   * The maximum number of times a connection can be returned
   * from the pool before it is automatically disposed of and
   * a new connection is allocated.
   *
   * @default Infinity
   */
  readonly maxUses: number;

  /**
   * How many milliseconds a connection can be idle before it
   * is automatically closed and removed from the pool.
   *
   * @default Infinity
   */
  readonly idleTimeoutMilliseconds: number;

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
  readonly releaseTimeoutMilliseconds: number;

  /**
   * How many milliseconds to wait in the queue for a connection
   * before rejecting with a timeout error.
   *
   * @default Infinity
   */
  readonly queueTimeoutMilliseconds: number;

  private readonly _openConnectionTimeoutMilliseconds: number;
  private readonly _closeConnectionTimeoutMilliseconds: number;

  constructor(options: PoolOptions<T>) {
    this._options = options;
    this.maxSize = zeroToInfinity(options.maxSize);
    this.maxUses = zeroToInfinity(options.maxUses);
    this.idleTimeoutMilliseconds = zeroToInfinity(
      options.idleTimeoutMilliseconds,
    );
    this.releaseTimeoutMilliseconds = zeroToInfinity(
      options.releaseTimeoutMilliseconds,
    );
    this.queueTimeoutMilliseconds = zeroToInfinity(
      options.queueTimeoutMilliseconds,
    );
    this._openConnectionTimeoutMilliseconds = zeroToInfinity(
      options.openConnectionTimeoutMilliseconds,
      60_000,
    );
    this._closeConnectionTimeoutMilliseconds = zeroToInfinity(
      options.closeConnectionTimeoutMilliseconds,
      60_000,
    );

    if (
      this._options.releaseTimeoutMilliseconds !== undefined &&
      !this._options.onReleaseTimeout
    ) {
      throw new Error(
        `If you specify releaseTimeoutMilliseconds you must provide a handler for onReleaseTimeout`,
      );
    }
  }

  private readonly _onConnectionAfterTimeout = (connection: T) => {
    void this.closeConnection(connection);
  };
  public async openConnection(
    removeFromPool: () => void,
  ): Promise<T | Timeout> {
    return withTimeout(
      this._options.openConnection,
      {
        timeoutMilliseconds: this._openConnectionTimeoutMilliseconds,
        onResultAfterTimeout: this._onConnectionAfterTimeout,
      },
      removeFromPool,
    );
  }

  private readonly _onConnectionClosed = (timeout: Timeout | void) => {
    if (isTimeout(timeout)) {
      if (this._options.onTimeoutClosingConnection) {
        this._options.onTimeoutClosingConnection();
      } else {
        console.warn(
          `pool.closeConnetion timed out after ${this._closeConnectionTimeoutMilliseconds}ms`,
        );
      }
    }
  };
  private readonly _onConnectionError = (err: Error) => {
    if (this._options.onErrorClosingConnection) {
      this._options.onErrorClosingConnection(err);
    } else {
      console.error(`Error closing connection: ${err.stack}`);
    }
  };
  public async closeConnection(connection: T): Promise<void> {
    return withTimeout(
      this._options.closeConnection,
      {timeoutMilliseconds: this._closeConnectionTimeoutMilliseconds},
      connection,
    )
      .then(this._onConnectionClosed, this._onConnectionError)
      .catch(globalError);
  }

  public onActive(connection: T) {
    return attemptHook(this._options.onActive, connection);
  }

  public onIdle(connection: T) {
    return attemptHook(this._options.onIdle, connection);
  }

  public onReleaseTimeout(connection: T) {
    void withTimeout(
      this._options.onReleaseTimeout!,
      {timeoutMilliseconds: this._closeConnectionTimeoutMilliseconds},
      connection,
    )
      .then(this._onConnectionClosed, this._onConnectionError)
      .catch(globalError);
  }
}
