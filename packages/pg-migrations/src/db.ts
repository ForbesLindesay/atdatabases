import connect, {Connection} from '@databases/pg';

function con<T>(
  fn: (connection: Connection) => Promise<T>,
): (db?: Connection | string | undefined) => Promise<T>;
function con<T, TArg1>(
  fn: (connection: Connection, arg1: TArg1) => Promise<T>,
): (db: Connection | string | undefined, arg1: TArg1) => Promise<T>;
function con<T>(
  fn: (connection: Connection, ...args: any[]) => Promise<T>,
): (db?: Connection | string | undefined) => Promise<T> {
  async function run(
    db: Connection | string | undefined,
    ...args: any[]
  ): Promise<T> {
    if (typeof db === 'string' || db === undefined) {
      const connection = connect(db);
      const result = await fn(connection, ...args);
      await connection.dispose();
      return result;
    }
    return await fn(db, ...args);
  }
  return run;
}
function tx<T>(
  fn: (tx: Connection) => Promise<T>,
): (db: Connection) => Promise<T> {
  return async (db: Connection): Promise<T> => await db.tx(fn);
}

export {con, tx};
