import {escapeSQLiteIdentifier} from '@databases/escape-identifier';
import sql, {SQLQuery, isSqlQuery, FormatConfig} from '@databases/sql';
import Mutex from './Mutex';
const DatabaseConstructor = require("better-sqlite3");
type Database = typeof DatabaseConstructor;
type Statement = typeof DatabaseConstructor.Statement;
type DatabaseOptions = typeof DatabaseConstructor.BetterSqlite3Options;

export type {SQLQuery};
export {sql, isSqlQuery};

const sqliteFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeSQLiteIdentifier(str),
  formatValue: (value) => ({placeholder: '?', value}),
};

export interface DatabaseTransaction {
  query(query: SQLQuery): Promise<any[]>;

  /**
   * @deprecated use queryStream
   */
  stream(query: SQLQuery): AsyncIterableIterator<any>;
  queryStream(query: SQLQuery): AsyncIterableIterator<any>;
}
export interface DatabaseConnection extends DatabaseTransaction {
  tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T>;
  dispose(): Promise<void>;
}
class DatabaseTransactionImplementation implements DatabaseTransaction {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }
  async query(query: SQLQuery) {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQuery(query, this._database, async (fn) => fn());
  }

  /**
   * @deprecated use queryStream
   */
  stream(query: SQLQuery): AsyncIterableIterator<any> {
    return this.queryStream(query);
  }
  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQueryStream(query, this._database, async (fn) => fn());
  }
}

export const IN_MEMORY = ':memory:';
class DatabaseConnectionImplementation implements DatabaseConnection {
  private readonly _database: Database;
  private readonly _mutex = new Mutex();
  private readonly _begin : Statement;
  private readonly _commit : Statement;
  private readonly _rollback : Statement;
  constructor(filename: string, options: DatabaseOptions = {}) {
    this._database = new DatabaseConstructor(filename, options);
    this._begin = this._database.prepare('BEGIN');
    this._commit = this._database.prepare('COMMIT');
    this._rollback = this._database.prepare('ROLLBACK');
  }
  async query(query: SQLQuery) {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQuery(query, this._database, async (fn) =>
      this._mutex.readLock(fn),
    );
  }

  /**
   * @deprecated use queryStream
   */
  stream(query: SQLQuery): AsyncIterableIterator<any> {
    return this.queryStream(query);
  }
  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQueryStream(query, this._database, async (fn) =>
      this._mutex.readLock(fn),
    );
  }

  async tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this._mutex.writeLock(async () => {
      // TODO extract those as class variables
      // however I do not know how to get
      this._begin.run();
      try {
        const result = await fn(
          new DatabaseTransactionImplementation(this._database),
        );
        this._commit.run();
        return result;
      } catch (ex) {
        this._rollback.run();
        throw ex;
      }
    });
  }

  async dispose() {
    this._database.close();
  }
}

export default function connect(
  filename: string = IN_MEMORY,
  options: DatabaseOptions = {},
): DatabaseConnection {
  return new DatabaseConnectionImplementation(filename, options);
}
module.exports = Object.assign(connect, {
  default: connect,
  IN_MEMORY,
  sql,
  isSqlQuery,
});

async function runQuery(
  query: SQLQuery,
  database: Database,
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
) {
  const {text, values} = query.format(sqliteFormat);
  return lock(async () => {
    const stm = database.prepare(text);
    try {
      return stm.all(...values);
    } catch (_err) {
      const err = _err as Error;
      // TODO we should be able to catch this before calling all()
      if (err.message.indexOf('This statement does not return data') >= 0) {
        return stm.run(...values);
      }
      throw err
    }
  });
}

async function* runQueryStream(
  query: SQLQuery,
  database: Database,
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
): AsyncIterableIterator<any> {
  const {text, values} = query.format(sqliteFormat);
  // TODO figure out how to avoid the extra closures
  let resolve = () => {};
  let reject: (reason? : any) => void;
  reject = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  let rows
  lock(async () => {
    const stm = database.prepare(text);
    rows = stm.iterate(...values);
    await promise
  }).catch((ex) => {
    setImmediate(() => {
      throw ex;
    });
  });
  try {
    for (const row of (rows || [])) {
      yield row;
    }
    resolve()
  } finally {
    reject()
  }
}
