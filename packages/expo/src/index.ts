import {
  websql,
  Database,
  Transaction,
  sql,
  type SQLQuery,
  isSqlQuery,
} from '@databases/websql-core';
import {openDatabase} from 'expo-sqlite';

export type {SQLQuery, Database, Transaction};
export {sql, isSqlQuery};

export default function connect(name: string): Database {
  return new Database(
    new Promise((resolve) => {
      openDatabase(
        name,
        undefined as any,
        undefined as any,
        undefined as any,
        (database) => {
          resolve(database as any as websql.Database);
        },
      );
    }),
  );
}
