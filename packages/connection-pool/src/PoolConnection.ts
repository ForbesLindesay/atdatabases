/**
 * A connection returned from a pool. When it is no longer
 * needed, you must call `release` or `dispose` exactly
 * once, in order to return it to the pool.
 */
export default interface PoolConnection<T> {
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
