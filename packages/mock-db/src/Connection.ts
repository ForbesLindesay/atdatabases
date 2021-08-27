import {BaseConnection} from '@databases/shared';
import sql from '@databases/sql/web';
import {Connection as IConnection} from './types/Queryable';
import MockDbDriver from './Driver';
import Transaction from './Transaction';

export default class Connection
  extends BaseConnection<Transaction, MockDbDriver>
  implements IConnection
{
  public readonly sql = sql;
}
