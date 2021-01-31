import {Readable} from 'stream';
import {BaseTransaction} from '@databases/shared';
import {SQLQuery} from '@databases/sql';
import AbortSignal from './types/AbortSignal';
import {Transaction as ITransaction} from './types/Queryable';
import PgDriver from './Driver';

export default class Transaction extends BaseTransaction<Transaction, PgDriver>
  implements ITransaction {
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
