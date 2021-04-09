import {QueryableType} from '@databases/shared';
import sql, {SQLQuery, isSqlQuery} from '@databases/sql/web';
import ConnectionPoolImplementation from './ConnectionPool';
import IsolationLevel from './types/IsolationLevel';
import Queryable, {
  Transaction,
  Connection,
  ConnectionPool,
  isTransaction,
  isConnection,
  isConnectionPool,
} from './types/Queryable';
import MockDbOptions from './types/MockDbOptions';

export type {
  SQLQuery,
  Queryable,
  Transaction,
  Connection,
  ConnectionPool,
  MockDbOptions,
};
export {
  sql,
  isSqlQuery,
  QueryableType,
  IsolationLevel,
  isTransaction,
  isConnection,
  isConnectionPool,
};

export default function createConnectionPool(
  config: string | (Partial<MockDbOptions> & {dbName: string}),
): ConnectionPool {
  const options: MockDbOptions =
    typeof config === 'string'
      ? {
          acquireLockTimeoutMilliseconds: 5_000,
          dbName: config,
          handlers: {},
        }
      : {
          acquireLockTimeoutMilliseconds:
            config.acquireLockTimeoutMilliseconds ?? 5_000,
          dbName: config.dbName,
          handlers: config.handlers ?? {},
        };
  return new ConnectionPoolImplementation(options);
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
  sql,
  isSqlQuery,
  QueryableType,
  IsolationLevel,
  isTransaction,
  isConnection,
  isConnectionPool,
});
