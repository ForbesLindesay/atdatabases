import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {isSQLError} from '@databases/pg-errors';
import splitSqlQuery, {hasValues} from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery, FormatConfig} from '@databases/sql';
import EventHandlers from '../types/EventHandlers';
import PgClient from '../types/PgClient';
const {codeFrameColumns} = require('@babel/code-frame');

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

type QueryResult = {rows: any[]};

export async function executeOneStatement(
  client: PgClient,
  query: SQLQuery,
  handlers: EventHandlers,
): Promise<any[]> {
  if (!isSqlQuery(query)) {
    throw new Error(
      'Invalid query, you must use @databases/sql to create your queries.',
    );
  }
  if (hasValues(query)) {
    const queries = splitSqlQuery(query);
    if (queries.length > 1) {
      const results = await Promise.all(
        queries.map(async (query) => {
          const q = query.format(pgFormat);
          try {
            if (handlers.onQueryStart) {
              enforceUndefined(handlers.onQueryStart(query, q));
            }
            // TODO: pg-promise used: https://github.com/vitaly-t/pg-promise/blob/d92ecf0091b4a38b8972c5052662633549a1b462/lib/formatting.js#L284
            const results = (await client.query(q)) as
              | QueryResult
              | QueryResult[];

            let rows;
            if (Array.isArray(results)) {
              if (results.length) {
                rows = results[results.length - 1].rows;
              } else {
                rows = [];
              }
            } else {
              rows = results.rows;
            }
            if (handlers.onQueryResults) {
              enforceUndefined(handlers.onQueryResults(query, q, rows));
            }
            return rows;
          } catch (ex) {
            handleError(ex, query, q, handlers);
          }
        }),
      );
      return results.length ? results[results.length - 1] : [];
    }
  }
  const q = query.format(pgFormat);
  try {
    if (handlers.onQueryStart) {
      enforceUndefined(handlers.onQueryStart(query, q));
    }
    // TODO: pg-promise used: https://github.com/vitaly-t/pg-promise/blob/d92ecf0091b4a38b8972c5052662633549a1b462/lib/formatting.js#L284
    const results = (await client.query(q)) as QueryResult | QueryResult[];

    let rows;
    if (Array.isArray(results)) {
      if (results.length) {
        rows = results[results.length - 1].rows;
      } else {
        rows = [];
      }
    } else {
      rows = results.rows;
    }
    if (handlers.onQueryResults) {
      enforceUndefined(handlers.onQueryResults(query, q, rows));
    }
    return rows;
  } catch (ex) {
    handleError(ex, query, q, handlers);
  }
}

export async function executeMultipleStatements(
  client: PgClient,
  queries: SQLQuery[],
  handlers: EventHandlers,
): Promise<any[]> {
  if (!Array.isArray(queries)) {
    throw new Error('Expected an array of queries.');
  }
  for (const el of queries) {
    if (!isSqlQuery(el)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
  }
  if (queries.some((q) => hasValues(q))) {
    return await Promise.all(
      queries.map(async (query) => {
        const q = query.format(pgFormat);
        try {
          if (handlers.onQueryStart) {
            enforceUndefined(handlers.onQueryStart(query, q));
          }
          const results = (await client.query(q)) as
            | QueryResult
            | QueryResult[];

          if (Array.isArray(results)) {
            throw new Error(
              'When passing an array of statements to `db.query`, you must ensure that each entry in the array is a single Query.',
            );
          } else {
            if (handlers.onQueryResults) {
              enforceUndefined(handlers.onQueryResults(query, q, results.rows));
            }
            return results.rows;
          }
        } catch (ex) {
          handleError(ex, query, q, handlers);
        }
      }),
    );
  }
  const query = sql.join(queries, `;`);
  const q = query.format(pgFormat);
  try {
    if (handlers.onQueryStart) {
      enforceUndefined(handlers.onQueryStart(query, q));
    }
    const results = (await client.query(q)) as QueryResult | QueryResult[];

    // TODO: assert that lengths match
    if (Array.isArray(results)) {
      if (results.length !== queries.length) {
        throw new Error(
          'The number of queries in the array did not match the number of result sets. You cannot pass a query with multiple statements as an entry in an array.',
        );
      }
      const rows = results.map((r) => r.rows);
      if (handlers.onQueryResults) {
        enforceUndefined(handlers.onQueryResults(query, q, rows));
      }
      return rows;
    } else {
      if (1 !== queries.length) {
        throw new Error(
          'The number of queries in the array did not match the number of result sets. You cannot pass a query with multiple statements as an entry in an array.',
        );
      }
      const rows = [results.rows];
      if (handlers.onQueryResults) {
        enforceUndefined(handlers.onQueryResults(query, q, rows));
      }
      return rows;
    }
  } catch (ex) {
    handleError(ex, query, q, handlers);
  }
}

function handleError(
  ex: unknown,
  query: SQLQuery,
  q: {text: string; values: unknown[]},
  handlers: EventHandlers,
): never {
  let err;
  if (isSQLError(ex) && ex.position) {
    const position = parseInt(ex.position, 10);
    const match =
      /syntax error at or near \"([^\"\n]+)\"/.exec(ex.message) ||
      /relation \"([^\"\n]+)\" does not exist/.exec(ex.message);
    let column = 0;
    let line = 1;
    for (let i = 0; i < position; i++) {
      if (q.text[i] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }

    const start = {line, column};
    let end: undefined | {line: number; column: number};
    if (match) {
      end = {line, column: column + match[1].length};
    }

    err = Object.assign(
      new Error(`${ex.message}\n\n${codeFrameColumns(q.text, {start, end})}\n`),
      ex,
    );
  } else {
    err = Object.assign(new Error(isError(ex) ? ex.message : `${ex}`), ex);
  }
  if (handlers.onQueryError) {
    enforceUndefined(handlers.onQueryError(query, q, err));
  }
  throw err;
}

function isError(ex: unknown): ex is {message: string} {
  return (
    typeof ex === 'object' &&
    ex !== null &&
    'message' in ex &&
    typeof (ex as any).message === 'string'
  );
}

function enforceUndefined(value: void) {
  if (value !== undefined) {
    throw new Error(
      `Your event handlers must return "undefined". This is to allow for the possibility of event handlers being used as hooks with more advanced functionality in the future.`,
    );
  }
}
