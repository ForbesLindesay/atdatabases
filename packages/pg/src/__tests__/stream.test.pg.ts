import connect, {sql} from '..';

jest.setTimeout(10000);

const BATCH_COUNT = 10;
const BATCH_SIZE = 1000;

test(`streaming`, async () => {
  const db = connect({poolSize: 1, bigIntMode: 'number'});

  const allValues: number[] = [];

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

  // Run it a few times to check connections are handled correctly
  for (let i = 0; i < 3; i++) {
    const results: number[] = [];
    const stream: ReadableStream<any> = db.queryStream(
      sql`SELECT * FROM streaming_test.values`,
      {batchSize: 100},
    );

    // @ts-expect-error - ReadableStream is iterable, but TypeScript doesn't always know that.
    for await (const {id} of stream) {
      results.push(id);
    }

    expect(results).toEqual(allValues);
  }
  await db.dispose();
});
