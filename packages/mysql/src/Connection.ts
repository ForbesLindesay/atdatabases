import {BaseConnection} from '@databases/shared';
import sql, {SQL} from '@databases/sql';
import {Connection as IConnection} from './types/Queryable';
import MySqlDriver from './MySqlDriver';
import Transaction from './Transaction';

export default class Connection
  extends BaseConnection<Transaction, MySqlDriver>
  implements IConnection
{
  public readonly sql: SQL = sql;
}
