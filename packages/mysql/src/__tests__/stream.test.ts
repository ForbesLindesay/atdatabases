import connect, {sql} from '../';

jest.setTimeout(30000);

const db = connect();

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
        batchValues.map(v => sql`(${v})`),
        sql`,`,
      )};
    `);
  }
});

test('node streaming', async () => {
  const results = await new Promise<any[]>((resolve, reject) => {
    const results: number[] = [];
    db.queryNodeStream(sql`SELECT * FROM streaming_test_values`, {
      highWaterMark: 1,
    })
      .on('data', data => results.push(data.id))
      .on('error', reject)
      .on('end', () => resolve(results));
  });
  expect(results).toEqual(allValues);
});

test('await streaming', async () => {
  const results: number[] = [];
  for await (const {id} of db.queryStream(
    sql`SELECT * FROM streaming_test_values`,
    {
      highWaterMark: 1,
    },
  )) {
    results.push(id);
  }
  expect(results).toEqual(allValues);
});
