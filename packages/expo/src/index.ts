import {websql, Database, sql} from '@databases/websql-core';

const openDatabase: websql.OpenDatabase = require('expo-sqlite').SQLite
  .openDatabase;

export {sql};

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
