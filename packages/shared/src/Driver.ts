import type {SQLQuery} from '@databases/sql';

export default interface Driver<TTransactionOptions> {
  beginTransaction(options: TTransactionOptions | undefined): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  createSavepoint(savepointName: string): Promise<void>;
  releaseSavepoint(savepointName: string): Promise<void>;
  rollbackToSavepoint(savepointName: string): Promise<void>;

  executeAndReturnAll(queries: SQLQuery[]): Promise<any[][]>;
  executeAndReturnLast(queries: SQLQuery[]): Promise<any[]>;

  shouldRetryTransactionFailure(
    options: TTransactionOptions | undefined,
    err: Error,
    errorCount: number,
  ): Promise<boolean>;
}
