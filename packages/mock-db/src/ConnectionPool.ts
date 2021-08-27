import {BaseConnectionPool, Factory, PoolOptions} from '@databases/shared';
import * as alasql from 'alasql';
import sql from '@databases/sql/web';
import Connection from './Connection';
import Transaction from './Transaction';
import {ConnectionPool as IConnectionPool} from './types/Queryable';

import MockDbDriver from './Driver';
import MockDbOptions from './types/MockDbOptions';

const factories: Factory<MockDbDriver, Connection, Transaction> = {
  createTransaction(driver, transactionParentContext) {
    return new Transaction(driver, factories, transactionParentContext);
  },
  createConnection(driver) {
    return new Connection(driver, factories);
  },
};

const getConnectionPoolOptions = ({
  acquireLockTimeoutMilliseconds,
  dbName,
  handlers,
}: MockDbOptions): PoolOptions<MockDbDriver> => {
  return {
    maxSize: 1,
    openConnection: async () => {
      return new MockDbDriver(
        new (alasql as any).Database(dbName),
        handlers,
        acquireLockTimeoutMilliseconds,
      );
    },
    closeConnection: async (driver) => {
      try {
        await driver.dispose();
        if (handlers.onConnectionClosed) {
          handlers.onConnectionClosed();
        }
      } catch (ex) {
        console.warn(ex.message);
      }
    },
  };
};

export default class ConnectionPool
  extends BaseConnectionPool<Connection, Transaction, MockDbDriver>
  implements IConnectionPool
{
  public readonly sql = sql;
  constructor(options: MockDbOptions) {
    super(getConnectionPoolOptions(options), factories);
  }
}
