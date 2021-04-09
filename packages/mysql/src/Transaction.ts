import {Readable} from 'stream';
import {BaseTransaction} from '@databases/shared';
import sql, {SQLQuery} from '@databases/sql';
import {Transaction as ITransaction} from './types/Queryable';
import MySqlDriver from './MySqlDriver';
import QueryStreamOptions from './types/QueryStreamOptions';

export default class Transaction
  extends BaseTransaction<Transaction, MySqlDriver>
  implements ITransaction {
  public readonly sql = sql;
  queryNodeStream(query: SQLQuery, options?: QueryStreamOptions): Readable {
    return this._driver.queryNodeStream(query, options);
  }
}
