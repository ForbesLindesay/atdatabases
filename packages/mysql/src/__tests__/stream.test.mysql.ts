import connect, {sql} from '..';

jest.setTimeout(30000);

const db = connect();

afterAll(async () => {
  await db.dispose();
});

const allValues: number[] = [];
beforeAll(async () => {
  await db.query(
    sql`CREATE TABLE streaming_test_values (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  for (let batch = 0; batch < 10; batch++) {
    const batchValues = [];
    for (let i = 0; i < 1000; i++) {
      const value = batch * 1000 + i;
      batchValues.push(value);
      allValues.push(value);
    }
    await db.query(sql`
      INSERT INTO streaming_test_values (id)
      VALUES ${sql.join(
        batchValues.map((v) => sql`(${v})`),
        sql`,`,
      )};
    `);
  }
});

test('await streaming', async () => {
  const results: number[] = [];
  const stream: ReadableStream<any> = db.queryStream(
    sql`SELECT * FROM streaming_test_values`,
  );
  // @ts-expect-error - ReadableStream is iterable, but TypeScript doesn't always know that.
  for await (const {id} of stream) {
    results.push(id);
  }
  expect(results).toEqual(allValues);
});
