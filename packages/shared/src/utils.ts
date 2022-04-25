import type {SQLQuery} from '@databases/sql';
import {isSqlQuery} from '@databases/sql/web';
import type Driver from './Driver';
import {ConnectionFactory, Disposable, TransactionFactory} from './Factory';

export function assertSql(query: SQLQuery | SQLQuery[]) {
  if (Array.isArray(query)) {
    for (const q of query) {
      if (!isSqlQuery(q)) {
        throw new Error(
          'Invalid query, you must use @databases/sql to create your queries.',
        );
      }
    }
  } else {
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
  }
}
export async function executeAndReturnAll<TTransactionOptions>(
  driver: Driver<TTransactionOptions, any>,
  queries: SQLQuery[],
): Promise<any[][]> {
  return driver.executeAndReturnAll(queries);
}
export async function executeAndReturnLast<TTransactionOptions>(
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
  TResult,
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
  TResult,
>(
  driver: TDriver,
  factories: TransactionFactory<TDriver, TTransaction>,
  fn: (connection: TTransaction) => Promise<TResult>,
  options: TTransactionOptions | undefined,
): Promise<TResult> {
  let failureCount = 0;
  while (true) {
    await driver.beginTransaction(options);
    const postCommitSteps: (() => Promise<void>)[] = [];
    const tx = factories.createTransaction(driver, {
      addPostCommitStep: (fn) => {
        postCommitSteps.push(fn);
      },
    });
    let result;
    try {
      result = await fn(tx);
      await tx.dispose();
      await driver.commitTransaction();
    } catch (ex: any) {
      await tx.dispose();
      await driver.rollbackTransaction();
      if (
        await driver.shouldRetryTransactionFailure(options, ex, ++failureCount)
      ) {
        continue;
      }
      throw ex;
    }
    for (const step of postCommitSteps) {
      await step();
    }
    return result;
  }
}
