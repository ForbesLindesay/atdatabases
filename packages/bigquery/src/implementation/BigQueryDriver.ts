import {escapeMySqlIdentifier} from '@databases/escape-identifier';
import splitSqlQuery from '@databases/split-sql-query';
import {FormatConfig, isSqlQuery, SQLQuery} from '@databases/sql';
import {Job, QueryResultsOptions} from '@google-cloud/bigquery';
import {Readable} from 'stream';
import BigQueryStreamOptions from '../types/BigQueryStreamOptions';
const {codeFrameColumns} = require('@babel/code-frame');

const DEFAULT_PAGE_SIZE = 1000;

interface BigQueryPage {
  isEmpty: () => boolean;
  shift: () => any;
  nextPage: undefined | (() => Promise<BigQueryPage>);
}

const bqFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeMySqlIdentifier(str),
  formatValue: (value) => ({placeholder: `?`, value}),
};

export type CreateQueryJob = (q: {query: string; params: any}) => Promise<Job>;

class BigQueryResultsStream extends Readable {
  constructor(getFirstPage: () => Promise<BigQueryPage>) {
    let reading = false;
    let currentPage: BigQueryPage | undefined;
    super({
      objectMode: true,
      read() {
        (async () => {
          if (reading) {
            return;
          }
          reading = true;
          let more = true;
          while (more) {
            if (!currentPage) {
              currentPage = await getFirstPage();
            }
            if (currentPage.isEmpty()) {
              if (currentPage.nextPage) {
                currentPage = await currentPage.nextPage();
                if (currentPage.isEmpty()) {
                  this.push(null);
                  return;
                }
              } else {
                this.push(null);
                return;
              }
            }
            while (!currentPage.isEmpty()) {
              more = this.push(currentPage.shift());
            }
          }
          reading = false;
        })().catch((e) => {
          this.destroy(e);
        });
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

  private async _getFirstPage(
    query: SQLQuery,
    options: BigQueryStreamOptions,
    createQueryJob: CreateQueryJob,
  ) {
    if (!isSqlQuery(query)) {
      throw new Error('Expected query to be an SQLQuery');
    }
    const {text, values} = query.format(bqFormat);
    const getNextPage = async (
      job: Job,
      query: QueryResultsOptions,
    ): Promise<BigQueryPage> => {
      const results = await handleError(
        async () => await job.getQueryResults(query),
        text,
      );
      const records = results[0];
      const nextQuery = results[1] as any;
      let i = 0;
      return {
        isEmpty() {
          return i === records.length;
        },
        shift() {
          return records[i++];
        },
        nextPage: nextQuery ? () => getNextPage(job, nextQuery) : undefined,
      };
    };
    const job = await handleError(
      async () => await createQueryJob({query: text, params: values}),
      text,
    );
    return await getNextPage(job, {
      ...this._options,
      autoPaginate: false,
      maxResults: options.pageSize ?? DEFAULT_PAGE_SIZE,
    });
  }
  queryStream(
    query: SQLQuery,
    options: BigQueryStreamOptions,
    createQueryJob: CreateQueryJob,
  ): AsyncGenerator<any, void, unknown> {
    const getFirstPage = async () =>
      await this._getFirstPage(query, options, createQueryJob);
    let currentPage: BigQueryPage | undefined;
    return {
      async next(): Promise<IteratorResult<any, void>> {
        if (!currentPage) {
          currentPage = await getFirstPage();
        }
        if (currentPage.isEmpty()) {
          if (currentPage.nextPage) {
            currentPage = await currentPage.nextPage();
            if (currentPage.isEmpty()) {
              return {done: true, value: undefined};
            }
          } else {
            return {done: true, value: undefined};
          }
        }
        return {done: false, value: currentPage.shift()};
      },
      async return(): Promise<IteratorResult<any, void>> {
        return {done: true, value: undefined};
      },
      async throw(e): Promise<IteratorResult<any, void>> {
        throw e;
      },
      [Symbol.asyncIterator](): AsyncGenerator<any, void, unknown> {
        // tslint:disable-next-line no-invalid-this
        return this;
      },
    };
  }

  queryNodeStream(
    query: SQLQuery,
    options: BigQueryStreamOptions,
    createQueryJob: CreateQueryJob,
  ): Readable {
    const getFirstPage = async () =>
      await this._getFirstPage(query, options, createQueryJob);
    return new BigQueryResultsStream(getFirstPage);
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
