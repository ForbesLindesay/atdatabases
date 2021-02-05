import sql, {SQLQuery} from '@databases/sql';
import {Lock} from '@databases/lock';
import Factory, {
  Disposable,
  ConnectionFactory,
  TransactionFactory,
} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import BaseTransaction from './BaseTransaction';
import BaseConnection from './BaseConnection';
import BaseConnectionPool, {PoolOptions} from './BaseConnectionPool';

export type {Lock};

export type {SQLQuery, PoolOptions};
export {sql};

export type {
  Driver,
  Disposable,
  TransactionFactory,
  ConnectionFactory,
  Factory,
};
export {QueryableType, BaseTransaction, BaseConnection, BaseConnectionPool};
