import {websql, Database, sql, SQLQuery} from '@databases/websql-core';

const openDatabase: websql.OpenDatabase = require('expo-sqlite').openDatabase;

export {sql, SQLQuery};

export default function connect(name: string) {
  return new Database(
    new Promise(resolve => {
      openDatabase(
        name,
        undefined as any,
        undefined as any,
        undefined as any,
        database => {
          resolve(database);
        },
      );
    }),
  );
}
