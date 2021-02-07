import type {SQLQuery} from '@databases/sql';

export default interface Driver<TTransactionOptions, TQueryStreamOptions> {
  /**
   * How long to wait when aquiring a lock on a connection or transaction.
   * This can help catch cases where you attempt to query using a connection
   * from within a transaction associated with that connection.
   */
  readonly aquireLockTimeoutMilliseconds: number;

  beginTransaction(options: TTransactionOptions | undefined): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  createSavepoint(savepointName: string): Promise<void>;
  releaseSavepoint(savepointName: string): Promise<void>;
  rollbackToSavepoint(savepointName: string): Promise<void>;

  executeAndReturnAll(queries: SQLQuery[]): Promise<any[][]>;
  executeAndReturnLast(queries: SQLQuery[]): Promise<any[]>;
  queryStream(
    query: SQLQuery,
    options: TQueryStreamOptions | undefined,
  ): AsyncGenerator<any, void, unknown>;

  shouldRetryTransactionFailure(
    options: TTransactionOptions | undefined,
    err: Error,
    errorCount: number,
  ): Promise<boolean>;

  canRecycleConnectionAfterError(err: Error): Promise<boolean>;
}
