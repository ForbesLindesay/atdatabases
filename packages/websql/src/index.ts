import {websql, Database, sql, SQLQuery} from '@databases/websql-core';
const openDatabase: websql.OpenDatabase = require('websql');

export {sql, SQLQuery};
export const IN_MEMORY = ':memory:';
export interface Options {
  version?: string;
  displayName?: string;
  estimatedSize?: number;
}
export default function connect(
  name: string = IN_MEMORY,
  options: Options = {},
) {
  return new Database(
    new Promise(resolve => {
      openDatabase(
        name,
        options.version!,
        options.displayName!,
        options.estimatedSize!,
        database => {
          resolve(database);
        },
      );
    }),
  );
}
