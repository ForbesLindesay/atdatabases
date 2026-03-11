import {
  websql,
  Database,
  Transaction,
  sql,
  SQLQuery,
  isSqlQuery,
} from '@databases/websql-core';
// @ts-expect-error
import openDatabaseUntyped from 'websql';

const openDatabase: websql.OpenDatabase = openDatabaseUntyped;

export type {SQLQuery, Database, Transaction};
export {sql, isSqlQuery};
export const IN_MEMORY = ':memory:';
export interface Options {
  version?: string;
  displayName?: string;
  estimatedSize?: number;
}
export default function connect(
  name: string = IN_MEMORY,
  options: Options = {},
): Database {
  return new Database(
    new Promise((resolve) => {
      openDatabase(
        name,
        options.version!,
        options.displayName!,
        options.estimatedSize!,
        (database) => {
          resolve(database);
        },
      );
    }),
  );
}
