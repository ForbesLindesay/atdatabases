import type {SQLQuery} from '@databases/sql';
import type Driver from './Driver';
import {ConnectionFactory, Disposable, TransactionFactory} from './Factory';

export function executeAndReturnAll<TTransactionOptions>(
  driver: Driver<TTransactionOptions, any>,
  queries: SQLQuery[],
): Promise<any[][]> {
  return driver.executeAndReturnAll(queries);
}
export function executeAndReturnLast<TTransactionOptions>(
  driver: Driver<TTransactionOptions, any>,
  queries: SQLQuery[],
): Promise<any[]> {
  return driver.executeAndReturnLast(queries);
}

export async function queryInternal<TTransactionOptions, TResult>(
  driver: Driver<TTransactionOptions, any>,
  queries: SQLQuery[],
  fn: <TTransactionOptions>(
    driver: Driver<TTransactionOptions, any>,
    queries: SQLQuery[],
  ) => Promise<TResult>,
): Promise<TResult> {
  const hasTransaction = queries.length > 1;
  try {
    if (hasTransaction) {
      await driver.beginTransaction(undefined);
    }
    const results = await fn(driver, queries);
    if (hasTransaction) {
      await driver.commitTransaction();
    }
    return results;
  } catch (ex) {
    if (hasTransaction) {
      await driver.rollbackTransaction();
    }
    throw ex;
  }
}
export async function taskInternal<
  TConnection extends Disposable,
  TTransactionOptions,
  TDriver extends Driver<TTransactionOptions, any>,
  TResult
>(
  driver: TDriver,
  factories: ConnectionFactory<TDriver, TConnection>,
  fn: (connection: TConnection) => Promise<TResult>,
): Promise<TResult> {
  const connection = factories.createConnection(driver);
  try {
    return await fn(connection);
  } finally {
    await connection.dispose();
  }
}
export async function txInternal<
  TTransaction extends Disposable,
  TTransactionOptions,
  TDriver extends Driver<TTransactionOptions, any>,
  TResult
>(
  driver: TDriver,
  factories: TransactionFactory<TDriver, TTransaction>,
  fn: (connection: TTransaction) => Promise<TResult>,
  options: TTransactionOptions | undefined,
): Promise<TResult> {
  let failureCount = 0;
  await driver.beginTransaction(options);
  while (true) {
    const tx = factories.createTransaction(driver);
    try {
      const result = await fn(tx);
      await tx.dispose();
      await driver.commitTransaction();
      return result;
    } catch (ex) {
      await tx.dispose();
      await driver.rollbackTransaction();
      if (
        await driver.shouldRetryTransactionFailure(options, ex, ++failureCount)
      ) {
        continue;
      }
      throw ex;
    }
  }
}

const resolvedPromise = Promise.resolve();
export function asyncNoop() {
  return resolvedPromise;
}
