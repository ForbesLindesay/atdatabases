import PoolConnection from './PoolConnection';

/**
 * A pool of connections that are automatically managed and
 * recycled.
 */
export default interface ConnectionPool<T> {
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
