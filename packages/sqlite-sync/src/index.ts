import {escapeSQLiteIdentifier} from '@databases/escape-identifier';
import sql, {SQLQuery, isSqlQuery, FormatConfig} from '@databases/sql';
import DatabaseConstructor, {Statement, Options as DatabaseOptions, Database} from 'better-sqlite3';

export type {SQLQuery};
export {sql, isSqlQuery};

const sqliteFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeSQLiteIdentifier(str),
  formatValue: (value) => ({placeholder: '?', value}),
};

export interface DatabaseTransaction {
  query(query: SQLQuery): any[];
  queryStream(query: SQLQuery): IterableIterator<any>;
}
export interface DatabaseConnection extends DatabaseTransaction {
  tx<T>(fn: (db: DatabaseTransaction) => T): T;
  dispose(): void;
}

class DatabaseTransactionImplementation implements DatabaseTransaction {
  private readonly _database: Database;
  constructor(database: Database) {
    this._database = database;
  }

  query(query: SQLQuery) {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQuery(query, this._database);
  }

  /**
   * @deprecated use queryStream
   */
  queryStream(query: SQLQuery): IterableIterator<any> {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQueryStream(query, this._database);
  }
}

export const IN_MEMORY = ':memory:';
class DatabaseConnectionImplementation implements DatabaseConnection {
  private readonly _database: Database;
  private readonly _begin : Statement;
  private readonly _commit : Statement;
  private readonly _rollback : Statement;
  constructor(filename: string, options: DatabaseOptions = {}) {
    this._database = new DatabaseConstructor(filename, options);
    this._begin = this._database.prepare('BEGIN');
    this._commit = this._database.prepare('COMMIT');
    this._rollback = this._database.prepare('ROLLBACK');
  }
  query(query: SQLQuery) {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQuery(query, this._database);
  }

  queryStream(query: SQLQuery): IterableIterator<any> {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    return runQueryStream(query, this._database);
  }

  tx<T>(fn: (db: DatabaseTransaction) => T): T {
    this._begin.run();
    try {
      const result = fn(
        new DatabaseTransactionImplementation(this._database),
      );
      this._commit.run();
      return result;
    } catch (ex) {
      this._rollback.run();
      throw ex;
    }
  }

  dispose() {
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

function runQuery(
  query: SQLQuery,
  database: Database,
) {
  const {text, values} = query.format(sqliteFormat);
  const stm = database.prepare(text);
  try {
    return stm.all(...values) as any[];
  } catch (_err) {
    const err = _err as Error;
    // TODO we should be able to catch this before calling all()
    if (err.message.indexOf('This statement does not return data') >= 0) {
      stm.run(...values);
      return [];
    }
    throw err
  }
}

function* runQueryStream(
  query: SQLQuery,
  database: Database
): IterableIterator<any> {
  const {text, values} = query.format(sqliteFormat);
  const stm = database.prepare(text);
  const rows = stm.iterate(...values);
  for (const row of (rows || [])) {
    yield row;
  }
}
