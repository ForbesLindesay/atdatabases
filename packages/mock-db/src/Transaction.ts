import {BaseTransaction} from '@databases/shared';
import sql from '@databases/sql/web';
import {Transaction as ITransaction} from './types/Queryable';
import MockDbDriver from './Driver';

export default class Transaction
  extends BaseTransaction<Transaction, MockDbDriver>
  implements ITransaction
{
  public readonly sql = sql;
}
