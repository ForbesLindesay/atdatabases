import {Readable} from 'stream';
import {BaseConnection} from '@databases/shared';
import {SQLQuery} from '@databases/sql';
import AbortSignal from './types/AbortSignal';
import {Connection as IConnection} from './types/Queryable';
import PgDriver from './Driver';
import Transaction from './Transaction';
import TransactionOptions from './types/TransactionOptions';
import {isSQLError, SQLErrorCode} from '@databases/pg-errors';

export default class Connection extends BaseConnection<Transaction, PgDriver>
  implements IConnection {
  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    transactionOptions: TransactionOptions = {},
  ): Promise<T> {
    let retrySerializationFailuresCount =
      transactionOptions.retrySerializationFailures === true
        ? 10
        : typeof transactionOptions.retrySerializationFailures === 'number'
        ? transactionOptions.retrySerializationFailures
        : 0;
    while (true) {
      try {
        return await super.tx(fn, transactionOptions);
      } catch (ex) {
        if (isSQLError(ex) && ex.code === SQLErrorCode.SERIALIZATION_FAILURE) {
          if (retrySerializationFailuresCount--) {
            continue;
          }
        }
        throw ex;
      }
    }
  }

  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    return this._driver.queryNodeStream(query, options);
  }

  queryStream(
    query: SQLQuery,
    options: {
      batchSize?: number;
      signal?: AbortSignal | undefined;
    } = {},
  ): AsyncGenerator<any, void, unknown> {
    return this._driver.queryStream(query, options);
  }
}
