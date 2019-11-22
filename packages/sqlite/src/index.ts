import * as sqlite from 'sqlite3';
import sql, {SQLQuery} from '@databases/sql';
import Mutex from './Mutex';
export {sql};

export enum DatabaseConnectionMode {
  ReadOnly = sqlite.OPEN_READONLY,
  ReadWrite = sqlite.OPEN_READWRITE,
  // tslint:disable-next-line:no-bitwise
  ReadWriteCreate = sqlite.OPEN_READWRITE | sqlite.OPEN_CREATE,
  // tslint:disable-next-line:no-bitwise
  ReadCreate = sqlite.OPEN_READONLY | sqlite.OPEN_CREATE,
  Create = sqlite.OPEN_CREATE,
}

export interface DatabaseConnectionOptions {
  /**
   * Sets the busy timeout. Must be a postive integer if provided.
   *
   * @see https://www.sqlite.org/c3ref/busy_timeout.html
   */
  busyTimeout?: number;
  /**
   * Defaults to DatabaseConnectionMode.ReadWriteCreate
   */
  mode?: DatabaseConnectionMode;
  /**
   * Enable long stack traces for debugging. This is global
   * and cannot be disabled once enabled.
   */
  verbose?: boolean;
}

export class DatabaseTransaction {
  private readonly _database: sqlite.Database;
  constructor(database: sqlite.Database) {
    this._database = database;
  }
  async query(query: SQLQuery) {
    return runQuery(query, this._database, async fn => fn());
  }

  /**
   * @deprecated use queryStream
   */
  stream(query: SQLQuery): AsyncIterableIterator<any> {
    return this.queryStream(query);
  }
  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    return runQueryStream(query, this._database, async fn => fn());
  }
}

export const IN_MEMORY = ':memory:';
export class DatabaseConnection {
  private readonly _database: sqlite.Database;
  private readonly _mutex = new Mutex();
  constructor(filename: string, options: DatabaseConnectionOptions = {}) {
    this._database = new sqlite.Database(filename, options.mode);
    if (options.verbose) {
      sqlite.verbose();
    }
    if (options.busyTimeout !== undefined) {
      this._database.configure('busyTimeout', options.busyTimeout);
    }
  }
  async query(query: SQLQuery) {
    return runQuery(query, this._database, async fn =>
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
    return runQueryStream(query, this._database, async fn =>
      this._mutex.readLock(fn),
    );
  }

  async tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this._mutex.writeLock(async () => {
      await new Promise<void>((resolve, reject) => {
        this._database.run('BEGIN', err => {
          if (err) reject(err);
          else resolve();
        });
      });
      try {
        const result = fn(new DatabaseTransaction(this._database));
        await new Promise<void>((resolve, reject) => {
          this._database.run('COMMIT', err => {
            if (err) reject(err);
            else resolve();
          });
        });
        return result;
      } catch (ex) {
        await new Promise<void>((resolve, reject) => {
          this._database.run('REVERT', err => {
            if (err) reject(err);
            else resolve();
          });
        });
        throw ex;
      }
    });
  }

  async dispose() {
    await new Promise<void>((resolve, reject) => {
      this._database.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default function connect(
  filename: string = IN_MEMORY,
  options: DatabaseConnectionOptions = {},
) {
  return new DatabaseConnection(filename, options);
}

async function runQuery(
  query: SQLQuery,
  database: sqlite.Database,
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
) {
  const {text, values} = query.compileMySQL();
  return lock(async () => {
    return await new Promise<any[]>((resolve, reject) => {
      database.all(text, values, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });
}
async function* runQueryStream(
  query: SQLQuery,
  database: sqlite.Database,
  lock: <T>(fn: () => Promise<T>) => Promise<T>,
): AsyncIterableIterator<any> {
  const {text, values} = query.compileMySQL();
  type Value = {done: false; value: any} | {done: true};
  let resolve: (value: Value) => void;
  let reject: (value: any) => void;
  let nextValue = new Promise<Value>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  lock(async () => {
    await new Promise<void>(releaseMutex => {
      database.each(
        text,
        values,
        (err, row) => {
          if (err) reject(err);
          else resolve({done: false, value: row});
          nextValue = new Promise<any>((_resolve, _reject) => {
            resolve = _resolve;
            reject = _reject;
          });
        },
        err => {
          releaseMutex();
          if (err) reject(err);
          else resolve({done: true});
        },
      );
    });
  }).catch(ex => {
    setImmediate(() => {
      throw ex;
    });
  });
  let value = await nextValue;
  while (!value.done) {
    yield value.value;
    value = await nextValue;
  }
}
