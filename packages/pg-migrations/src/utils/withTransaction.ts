import {Connection} from '@databases/pg';

function withTransaction<TArgs extends unknown[], TResult>(
  fn: (tx: Connection, ...args: TArgs) => Promise<TResult>,
) {
  return async (db: Connection, ...args: TArgs): Promise<TResult> =>
    await db.tx(async (tx) => {
      return await fn(tx, ...args);
    });
}

export default withTransaction;
