import {BaseTransaction} from '@databases/shared';
import sql, {type SQL} from '@databases/sql';
import {Transaction as ITransaction} from './types/Queryable';
import MySqlDriver from './MySqlDriver';

export default class Transaction
  extends BaseTransaction<Transaction, MySqlDriver>
  implements ITransaction
{
  public readonly sql: SQL = sql;
}
