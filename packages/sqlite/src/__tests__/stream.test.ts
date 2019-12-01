import connect, {sql} from '../';

jest.setTimeout(30000);

const db = connect();

test('streaming', async () => {
  await db.query(
    sql`CREATE TABLE stream_values (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  const allValues = [];
  for (let batch = 0; batch < 10; batch++) {
    const batchValues = [];
    for (let i = 0; i < 10; i++) {
      const value = batch * 10 + i;
      batchValues.push(value);
      allValues.push(value);
    }
    await db.query(sql`
      INSERT INTO stream_values (id)
      VALUES ${sql.join(batchValues.map(v => sql`(${v})`), sql`,`)};
    `);
  }
  const results = [];
  for await (const row of db.queryStream(sql`SELECT * FROM stream_values`)) {
    results.push(row.id);
  }
  expect(results).toEqual(allValues);
});
