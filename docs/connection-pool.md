---
id: connection-pool
title: @databases/connection-pool
sidebar_label: connection-pool
---

The `@databases/connection-pool` package provides a generic, async connection pool for use with database connections and any other similar resource. This is useful when either:

1. There is a significant cost to create or destroy connections, and you therefore want to recycle existing connections wherever possible
2. There is a limit to the total number of connections it is ok to create, and you therefore want to ensure that additional concurrent requests are queued.

## Usage

```typescript
import ConnectionPool from '@databases/connection-pool';

async function connect(connectionString) {
  console.log(`Connecting to ${connectionString}`);
  // simulate time spent connecting to a database:
  await new Promise((r) => setTimeout(r, 1000));
  let disposed = false;
  return {
    query: async () => {
      if (disposed) {
        throw new Error('Cannot query after calling dispose');
      }
      // execute some query here
    },
    dispose: () => {
      disposed = true;
      // simulate time spent disconnecting from a database:
      await new Promise((r) => setTimeout(r, 1000));
    },
  };
}

const pool = new ConnectionPool({
  getConnection: async () => {
    return connect(process.env.DATABASE_URL);
  },
  closeConnection: async (connection) => {
    try {
      connection.dispose();
    } catch (ex) {
      console.error(ex.stack);
    }
  },
  maxSize: 3,
});

async function queryPool() {
  const con = pool.getConnection();
  try {
    return await con.connection.query();
  } finally {
    // If you prefer not to recycle this connection
    // e.g. because you know the connection is stuck
    // in an error state, you can call `conn.dispose()`
    // instead of `conn.release()`.
    conn.release();
  }
}
```

```javascript
const ConnectionPool = require('@databases/connection-pool');

async function connect(connectionString) {
  console.log(`Connecting to ${connectionString}`);
  // simulate time spent connecting to a database:
  await new Promise((r) => setTimeout(r, 1000));
  let disposed = false;
  return {
    query: async () => {
      if (disposed) {
        throw new Error('Cannot query after calling dispose');
      }
      // execute some query here
    },
    dispose: () => {
      disposed = true;
      // simulate time spent disconnecting from a database:
      await new Promise((r) => setTimeout(r, 1000));
    },
  };
}

const pool = new ConnectionPool({
  getConnection: async () => {
    return connect(process.env.DATABASE_URL);
  },
  closeConnection: async (connection) => {
    try {
      connection.dispose();
    } catch (ex) {
      console.error(ex.stack);
    }
  },
  maxSize: 3,
});

async function queryPool() {
  const con = pool.getConnection();
  try {
    return await con.connection.query();
  } finally {
    // If you prefer not to recycle this connection
    // e.g. because you know the connection is stuck
    // in an error state, you can call `conn.dispose()`
    // instead of `conn.release()`.
    conn.release();
  }
}
```

## API

```typescript
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
/**
 * Create a new ConnectionPool to manage connections
 */
export default function createConnectionPool<T>(
  options: PoolOptions<T>,
): ConnectionPool<T>;
```
