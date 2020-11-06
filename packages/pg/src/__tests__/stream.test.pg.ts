import connect, {sql, Queryable} from '..';

jest.setTimeout(10000);
const BATCH_COUNT = 10;
const BATCH_SIZE = 1000;

// setting pool size to 1 to test connections are properly released
const db = connect({poolSize: 1, bigIntMode: 'number'});

const allValues: number[] = [];
beforeAll(async () => {
  await db.query(sql`CREATE SCHEMA streaming_test`);
  await db.query(
    sql`CREATE TABLE streaming_test.values (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  for (let batch = 0; batch < BATCH_COUNT; batch++) {
    const batchValues = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const value = batch * BATCH_SIZE + i;
      batchValues.push(value);
      allValues.push(value);
    }
    await db.query(sql`
      INSERT INTO streaming_test.values (id)
      VALUES ${sql.join(
        batchValues.map((v) => sql`(${v})`),
        sql`,`,
      )};
    `);
  }
});
afterAll(async () => {
  await db.dispose();
});

let passing = true;
function addTests(
  name: string,
  withConnection: <T>(fn: (db: Queryable) => Promise<T>) => Promise<T>,
) {
  test(`${name} - node streaming`, async () => {
    if (!passing) {
      throw new Error('An earlier test already failed');
    }
    passing = false;
    const results = await withConnection(async (db) => {
      const results = await new Promise<any[]>((resolve, reject) => {
        const results: number[] = [];
        db.queryNodeStream(sql`SELECT * FROM streaming_test.values`, {
          highWaterMark: 100,
        })
          .on('data', (data) => results.push(data.id))
          .on('error', reject)
          .on('end', () => resolve(results));
      });
      return results;
    });
    expect(results).toEqual(allValues);
    passing = true;
  });

  test(`${name} - await streaming`, async () => {
    if (!passing) {
      throw new Error('An earlier test already failed');
    }
    passing = false;
    const results = await withConnection(async (db) => {
      const results: number[] = [];
      for await (const {id} of db.queryStream(
        sql`SELECT * FROM streaming_test.values`,
        {
          batchSize: 100,
        },
      )) {
        results.push(id);
      }
      return results;
    });
    expect(results).toEqual(allValues);
    passing = true;
  });
}

addTests('Connection', (fn) => db.task((connection) => fn(connection)));

addTests('Transaction', (fn) => db.tx((transaction) => fn(transaction)));

addTests('ConnectionPool', (fn) => fn(db));
