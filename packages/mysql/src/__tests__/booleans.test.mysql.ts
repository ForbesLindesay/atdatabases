import connect, {sql} from '..';

jest.setTimeout(30000);

const db = connect();

afterAll(async () => {
  await db.dispose();
});

test('booleans', async () => {
  await db.query(
    sql`CREATE TABLE booleans_test_booleans (id INT NOT NULL PRIMARY KEY, test_value BOOLEAN NOT NULL);`,
  );
  await db.query(sql`
    INSERT INTO booleans_test_booleans (id, test_value)
    VALUES (1, ${true}),
           (2, ${false});
  `);
  const result = await db.query(sql`
    SELECT id, test_value from booleans_test_booleans;
  `);
  expect(result).toEqual([
    {id: 1, test_value: 1},
    {id: 2, test_value: 0},
  ]);
});
