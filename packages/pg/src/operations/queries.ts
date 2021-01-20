import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {isSQLError} from '@databases/pg-errors';
import splitSqlQuery, {hasValues} from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery, FormatConfig} from '@databases/sql';
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
            // TODO: pg-promise used: https://github.com/vitaly-t/pg-promise/blob/d92ecf0091b4a38b8972c5052662633549a1b462/lib/formatting.js#L284
            const results = (await client.query(q)) as
              | QueryResult
              | QueryResult[];

            if (Array.isArray(results)) {
              if (results.length) {
                return results[results.length - 1].rows;
              } else {
                return [];
              }
            } else {
              return results.rows;
            }
          } catch (ex) {
            handleError(ex, query);
          }
        }),
      );
      return results.length ? results[results.length - 1] : [];
    }
  }
  const q = query.format(pgFormat);
  try {
    // TODO: pg-promise used: https://github.com/vitaly-t/pg-promise/blob/d92ecf0091b4a38b8972c5052662633549a1b462/lib/formatting.js#L284
    const results = (await client.query(q)) as QueryResult | QueryResult[];

    if (Array.isArray(results)) {
      if (results.length) {
        return results[results.length - 1].rows;
      } else {
        return [];
      }
    } else {
      return results.rows;
    }
  } catch (ex) {
    handleError(ex, query);
  }
}

export async function executeMultipleStatements(
  client: PgClient,
  queries: SQLQuery[],
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
          const results = (await client.query(q)) as
            | QueryResult
            | QueryResult[];

          if (Array.isArray(results)) {
            throw new Error(
              'When passing an array of statements to `db.query`, you must ensure that each entry in the array is a single Query.',
            );
          } else {
            return results.rows;
          }
        } catch (ex) {
          handleError(ex, query);
        }
      }),
    );
  }
  const query = sql.join(queries, `;`);
  const q = query.format(pgFormat);
  try {
    const results = (await client.query(q)) as QueryResult | QueryResult[];

    // TODO: assert that lengths match
    if (Array.isArray(results)) {
      if (results.length !== queries.length) {
        throw new Error(
          'The number of queries in the array did not match the number of result sets. You cannot pass a query with multiple statements as an entry in an array.',
        );
      }
      return results.map((r) => r.rows);
    } else {
      if (1 !== queries.length) {
        throw new Error(
          'The number of queries in the array did not match the number of result sets. You cannot pass a query with multiple statements as an entry in an array.',
        );
      }
      return [results.rows];
    }
  } catch (ex) {
    handleError(ex, query);
  }
}

function handleError(ex: unknown, query: SQLQuery): never {
  if (isSQLError(ex) && ex.position) {
    const q = query.format(pgFormat);
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

    throw Object.assign(
      new Error(`${ex.message}\n\n${codeFrameColumns(q.text, {start, end})}\n`),
      ex,
    );
  }
  throw Object.assign(new Error(isError(ex) ? ex.message : `${ex}`), ex);
}

function isError(ex: unknown): ex is {message: string} {
  return (
    typeof ex === 'object' &&
    ex !== null &&
    'message' in ex &&
    typeof (ex as any).message === 'string'
  );
}
