import {BaseConnection} from '@databases/shared';
import sql, {type SQL} from '@databases/sql';
import {Connection as IConnection} from './types/Queryable';
import PgDriver from './Driver';
import Transaction from './Transaction';

export default class Connection
  extends BaseConnection<Transaction, PgDriver>
  implements IConnection
{
  public readonly sql: SQL = sql;
}
