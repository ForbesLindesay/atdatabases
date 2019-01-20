import connect, {sql} from '../';

jest.setTimeout(30000);

const db = connect();

test('streaming', async () => {
  await db.query(sql`CREATE SCHEMA streaming_test`);
  await db.query(
    sql`CREATE TABLE streaming_test.values (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  const allValues = [];
  for (let batch = 0; batch < 10; batch++) {
    const batchValues = [];
    for (let i = 0; i < 1000; i++) {
      const value = batch * 1000 + i;
      batchValues.push(value);
      allValues.push(value);
    }
    await db.query(sql`
      INSERT INTO streaming_test.values (id)
      VALUES ${sql.join(batchValues.map(v => sql`(${v})`), ',')};
    `);
  }
  const results = await new Promise<any[]>((resolve, reject) => {
    const results: any[] = [];
    db.stream(sql`SELECT * FROM streaming_test.values`, {batchSize: 1})
      .on('data', data => results.push(data.id))
      .on('error', reject)
      .on('end', () => resolve(results));
  });
  expect(results).toEqual(allValues);
});
