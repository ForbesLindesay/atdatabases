import sql, {SQLQuery} from '@databases/sql';
import * as ws from './websql-types';

const DEFAULT_OPTIONS = {readOnly: false};
export {sql};
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
export default class Database {
  private readonly _db: Promise<ws.Database>;
  constructor(db: Promise<ws.Database>) {
    this._db = db;
  }
  async tx<TResult>(
    fn: (tx: Transaction) => Iterator<TResult | QueryTask>,
    options: {readOnly: boolean} = DEFAULT_OPTIONS,
  ): Promise<Exclude<TResult, QueryTask>> {
    const db = await this._db;
    return await new Promise<Exclude<TResult, QueryTask>>((resolve, reject) => {
      db[options.readOnly ? 'readTransaction' : 'transaction'](transaction => {
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
        function next(r: IteratorResult<TResult | QueryTask>) {
          if (r.done) {
            if (r.value instanceof QueryTask) {
              txThrow(new Error('You should not return a QueryTask.'));
              return;
            }
            ended = true;
            resolve(r.value as any);
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
              return txThrow(err);
            },
          );
        }
        next(tx.next());
      });
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
        tx => {
          tx.executeSql(text, values, (_tx, _resultSet) => {
            resultSet = _resultSet;
          });
        },
        reject,
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
