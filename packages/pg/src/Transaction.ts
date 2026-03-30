import {BaseTransaction} from '@databases/shared';
import sql, {type SQL} from '@databases/sql';
import {Transaction as ITransaction} from './types/Queryable';
import PgDriver from './Driver';

export default class Transaction
  extends BaseTransaction<Transaction, PgDriver>
  implements ITransaction
{
  public readonly sql: SQL = sql;
}
