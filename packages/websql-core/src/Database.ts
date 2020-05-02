import sql, {SQLQuery} from '@databases/sql/web';
import * as ws from './websql-types';
const {codeFrameColumns} = require('@babel/code-frame');

const DEFAULT_OPTIONS = {readOnly: false};
export {sql, SQLQuery};
export class QueryTask {
  protected readonly _isQueryTask = true;
}
export class Transaction {
  private readonly _handler: (task: QueryTask, query: SQLQuery) => void;
  constructor(handler: (task: QueryTask, query: SQLQuery) => void) {
    this._handler = handler;
  }
  query(query: SQLQuery): QueryTask {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const task = new QueryTask();
    this._handler(task, query);
    return task;
  }
}

function convertError(err: any, query: string) {
  if (!err || typeof err.message !== 'string') return err;
  const match = /near \"([^\"]+)\"/.exec(err.message);
  if (match) {
    const split = /^[a-z]+$/i.test(match[1])
      ? query.split(new RegExp(`\\b${match[1]}\\b`))
      : query.split(match[1]);
    if (split.length === 2) {
      const lines = split[0].split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;

      const e = new Error(
        `${err.message}\n\n${codeFrameColumns(query, {
          start: {line, column},
          end: {line, column: column + match[1].length},
        })}\n`,
      );
      for (const i in err) {
        (e as any)[i] = err[i];
      }
      return e;
    }
  }
  const e = new Error(`${err.message}\n\n${query}`);
  for (const i in err) {
    (e as any)[i] = err[i];
  }
  return e;
}
export default class Database {
  private readonly _db: Promise<ws.Database>;
  constructor(db: Promise<ws.Database>) {
    this._db = db;
  }
  async tx<TResult>(
    fn: (tx: Transaction) => Iterator<QueryTask, TResult, any[]>,
    options: {readOnly: boolean} = DEFAULT_OPTIONS,
  ): Promise<TResult> {
    const db = await this._db;
    return await new Promise<TResult>((resolve, reject) => {
      db[options.readOnly ? 'readTransaction' : 'transaction'](
        (transaction) => {
          let ended = false;
          let task: QueryTask | undefined;
          let query: SQLQuery | undefined;
          const tx = fn(
            new Transaction((t, q) => {
              if (ended) {
                throw new Error(
                  'This query has already finished. You cannot query it after it has finished.',
                );
              }
              if (task || query) {
                throw new Error(
                  'You already have a query in flight. You need to "yield" your first query before starting a second query.',
                );
              }
              task = t;
              query = q;
            }),
          );
          /**
           * Returns false if the error was handled, true if it was fatal
           */
          function txThrow(err: any) {
            if (!tx.throw) {
              ended = true;
              reject(err);
              return true;
            }
            let nextResult;
            try {
              task = undefined;
              query = undefined;
              nextResult = tx.throw(err);
            } catch (ex) {
              ended = true;
              reject(ex);
              return true;
            }
            next(nextResult);
            return false;
          }
          function next(r: IteratorResult<QueryTask, TResult>) {
            if (r.done) {
              if (r.value instanceof QueryTask) {
                txThrow(new Error('You should not return a QueryTask.'));
                return;
              }
              ended = true;
              resolve(r.value);
            }
            if (!(r.value instanceof QueryTask)) {
              txThrow(
                new Error('You can only yield queries in a WebSQL transaction'),
              );
              return;
            }

            if (r.value !== task) {
              txThrow(
                new Error(
                  'The query yielded was not the most recent query calls. Please immediately yield any queries.',
                ),
              );
              return;
            }

            const {text, values} = query!.compile();
            transaction.executeSql(
              text,
              values,
              (_, resultSet) => {
                let nextResult;
                try {
                  task = undefined;
                  query = undefined;
                  nextResult = tx.next(extractResults(resultSet));
                } catch (ex) {
                  ended = true;
                  reject(ex);
                  return;
                }
                next(nextResult);
                return;
              },
              (_, err) => {
                return txThrow(convertError(err, text));
              },
            );
          }
          next(tx.next());
        },
      );
    });
  }
  async query(query: SQLQuery, options: {readOnly: boolean} = DEFAULT_OPTIONS) {
    const db = await this._db;
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.compile();
    const results = await new Promise<ws.SQLResultSet>((resolve, reject) => {
      let resultSet: ws.SQLResultSet | undefined;
      db[options.readOnly ? 'readTransaction' : 'transaction'](
        (tx) => {
          tx.executeSql(text, values, (_tx, _resultSet) => {
            resultSet = _resultSet;
          });
        },
        (ex) => reject(convertError(ex, text)),
        () => {
          resolve(resultSet);
        },
      );
    });
    return extractResults(results);
  }
}

function extractResults(results: ws.SQLResultSet) {
  const rows: any[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(results.rows.item(i));
  }
  return rows;
}
