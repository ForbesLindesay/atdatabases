import {escapeMySqlIdentifier} from '@databases/escape-identifier';
import splitSqlQuery from '@databases/split-sql-query';
import {FormatConfig, isSqlQuery, type SQLQuery} from '@databases/sql';
import {Job, QueryResultsOptions} from '@google-cloud/bigquery';
import BigQueryStreamOptions from '../types/BigQueryStreamOptions';
import {codeFrameColumns} from '@babel/code-frame';
import {assertSql} from '../utils';

const DEFAULT_PAGE_SIZE = 1000;

const bqFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeMySqlIdentifier(str),
  formatValue: (value) => ({placeholder: `?`, value}),
};

export type CreateQueryJob = (q: {query: string; params: any}) => Promise<Job>;

class BigQueryResultsStream extends ReadableStream<any> {
  constructor(
    query: SQLQuery,
    options: QueryResultsOptions,
    createQueryJob: CreateQueryJob,
  ) {
    const {text, values} = query.format(bqFormat);
    let job: Job | undefined;
    let nextOptions: QueryResultsOptions = options;
    let isCancelled = false;
    super({
      async start() {
        job = await handleError(
          async () => await createQueryJob({query: text, params: values}),
          text,
        );
      },
      async pull(controller) {
        try {
          const [records, nextPage] = await handleError(async () => {
            if (!job) throw new Error('Failed to initiate query job');
            return await job.getQueryResults(nextOptions);
          }, text);

          if (isCancelled) return;
          for (const record of records) {
            controller.enqueue(record);
          }
          if (nextPage) {
            nextOptions = nextPage;
          } else {
            controller.close();
          }
        } catch (err) {
          if (isCancelled) return;
          isCancelled = true;
          controller.error(err);
        }
      },
      async cancel() {
        if (isCancelled) return;
        isCancelled = true;
        await job?.cancel();
      },
    });
  }
}

export default class BigQueryDriver {
  private readonly _options: QueryResultsOptions;
  constructor(options: QueryResultsOptions) {
    this._options = options;
  }

  async query(
    query: SQLQuery | SQLQuery[],
    createQueryJob: CreateQueryJob,
  ): Promise<any[]> {
    const executeQuery = async (query: SQLQuery) => {
      const {text, values} = query.format(bqFormat);
      const job = await handleError(
        async () => await createQueryJob({query: text, params: values}),
        text,
      );
      const results = await handleError(
        async () => await job.getQueryResults({...this._options}),
        text,
      );
      return results[0];
    };
    if (Array.isArray(query)) {
      if (!query.every(isSqlQuery)) {
        throw new Error('Expected query to be an SQLQuery');
      }
      const results = new Array(query.length);
      for (let i = 0; i < query.length; i++) {
        results[i] = await executeQuery(query[i]);
      }
      return results;
    }
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    const queries = splitSqlQuery(query);
    if (queries.length === 0) {
      return [];
    }
    for (let i = 0; i < queries.length - 1; i++) {
      await executeQuery(queries[i]);
    }
    const results = await executeQuery(queries[queries.length - 1]);
    return results;
  }

  queryStream(
    query: SQLQuery,
    options: BigQueryStreamOptions,
    createQueryJob: CreateQueryJob,
  ): ReadableStream<any> {
    assertSql(query);
    return new BigQueryResultsStream(
      query,
      {
        ...this._options,
        autoPaginate: false,
        maxResults: options.pageSize ?? DEFAULT_PAGE_SIZE,
      },
      createQueryJob,
    );
  }
}

export async function handleError<T>(
  fn: () => Promise<T>,
  queryText: string,
): Promise<T> {
  try {
    return await fn();
  } catch (ex) {
    return throwError(ex, queryText);
  }
}
export function throwError(err: any, queryText?: string): never {
  if (!err) throw new Error(`unknown error`);
  if (err.name === `PartialFailureError`) {
    for (const rowError of err.errors) {
      for (const fieldError of rowError.errors) {
        if (fieldError.message) {
          throw Object.assign(new Error(fieldError.message), {
            reason: fieldError.reason,
            row: rowError.row,
            errors: err.errors,
          });
        }
      }
    }
  }
  const match =
    queryText &&
    typeof err.message === `string` &&
    /\[(\d+)\:(\d+)\]$/.exec(err.message);

  if (match) {
    const {message, ...rest} = err;
    const line = parseInt(match[1], 10);
    const column = parseInt(match[2], 10);
    const start = {line, column};

    throw Object.assign(
      new Error(`${err.message}\n\n${codeFrameColumns(queryText, {start})}\n`),
      rest,
    );
  }
  throw err;
}
