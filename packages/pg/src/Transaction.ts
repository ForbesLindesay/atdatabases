import {Readable} from 'stream';
import {BaseTransaction} from '@databases/shared';
import sql, {SQLQuery} from '@databases/sql';
import {Transaction as ITransaction} from './types/Queryable';
import PgDriver from './Driver';

export default class Transaction
  extends BaseTransaction<Transaction, PgDriver>
  implements ITransaction
{
  public readonly sql = sql;
  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    return this._driver.queryNodeStream(query, options);
  }
}
