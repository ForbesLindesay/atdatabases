import {Readable} from 'stream';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {isSqlQuery, SQLQuery, FormatConfig} from '@databases/sql';
import AbortSignal from '../types/AbortSignal';
import PgClient from '../types/PgClient';
const Cursor = require('pg-cursor');

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

export function queryNodeStream(
  client: PgClient,
  query: SQLQuery,
  options: {highWaterMark?: number},
): Readable {
  if (!isSqlQuery(query)) {
    throw new Error(
      'Invalid query, you must use @databases/sql to create your queries.',
    );
  }
  const q = query.format(pgFormat);
  const c = new Cursor(q.text, q.values);
  let closed = false;
  let reading = false;
  const stream = new Readable({
    ...options,
    // defau† to `false` in node 12 but true in node 14
    autoDestroy: true,
    objectMode: true,
    read(this: Readable, count: number) {
      if (reading) return;
      reading = true;
      const read = () => {
        c.read(count, (err: Error | null, rows: any[]) => {
          if (err) {
            this.emit('error', err);
            return;
          }
          if (!rows.length) {
            closed = true;
            this.push(null);
            return;
          }
          let keepReading = true;
          for (const row of rows) {
            keepReading = keepReading && this.push(row);
          }
          if (keepReading) {
            read();
          } else {
            reading = false;
          }
        });
      };
      read();
    },
    destroy(err, callback) {
      if (closed) {
        callback(err);
        return;
      }
      closed = true;
      c.close((err2: Error | null) => {
        callback(err ?? err2);
      });
    },
  });
  void client.query(c);
  return stream;
}

export async function* queryStream(
  client: PgClient,
  query: SQLQuery,
  {batchSize = 16, signal}: {batchSize?: number; signal?: AbortSignal},
): AsyncGenerator<any, void, unknown> {
  if (!isSqlQuery(query)) {
    throw new Error(
      'Invalid query, you must use @databases/sql to create your queries.',
    );
  }
  if (signal?.aborted) {
    throw new Error('Aborted');
  }
  const q = query.format(pgFormat);
  const c = new Cursor(q.text, q.values);
  void client.query(c);

  const read = async () => {
    return await new Promise<any[]>((resolve, reject) => {
      c.read(batchSize, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  let aborted = false;
  const abort = () => {
    if (aborted) return;
    aborted = true;
    c.close(() => {
      // ignore
    });
  };
  signal?.addEventListener('abort', abort);

  try {
    let nextPagePromise;
    let ended = false;
    while (!ended) {
      const page = await (nextPagePromise ?? read());
      if (page.length !== 0) {
        nextPagePromise = read();
        nextPagePromise.catch((ex) => {
          // this error gets picked up later, so don't report the unhandled rejection
        });
        ended = false;
      } else {
        nextPagePromise = undefined;
        ended = true;
      }
      for (const row of page) {
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        yield row;
      }
    }
    aborted = true;
  } finally {
    signal?.removeEventListener('abort', abort);
    abort();
  }
}
