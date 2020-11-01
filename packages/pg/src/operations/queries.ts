import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {QueryResult} from 'pg';
import {isSQLError} from '@databases/pg-errors';
import splitSqlQuery, {
  hasValues,
  hasSemicolonBeforeEnd,
} from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery, FormatConfig} from '@databases/sql';
import RawQueryFunction from '../types/RawQueryFunction';
const {codeFrameColumns} = require('@babel/code-frame');
// TODO: we should not depend on this internal functionality
// const {formatQuery} = require('pg-promise/lib/formatting');

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

export async function executeOneStatement(
  client: {query: RawQueryFunction},
  query: SQLQuery,
): Promise<any[]> {
  if (!isSqlQuery(query)) {
    throw new Error(
      'Invalid query, you must use @databases/sql to create your queries.',
    );
  }
  if (hasValues(query) && hasSemicolonBeforeEnd(query)) {
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
  client: {query: RawQueryFunction},
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
  const query = sql.join(queries, `;`);
  const q = query.format(pgFormat);
  if (q.values.length) {
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
  try {
    // TODO: pg-promise used: https://github.com/vitaly-t/pg-promise/blob/d92ecf0091b4a38b8972c5052662633549a1b462/lib/formatting.js#L284
    const results = (await client.query(q)) as QueryResult | QueryResult[];

    // TODO: assert that lengths match
    if (Array.isArray(results)) {
      return results.map((r) => r.rows);
    } else {
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

    ex.message += `\n\n${codeFrameColumns(q.text, {start, end})}\n`;
  }
  throw ex;
}
