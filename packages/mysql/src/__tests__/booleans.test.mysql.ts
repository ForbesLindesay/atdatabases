import connect, {sql} from '..';

jest.setTimeout(30000);
beforeAll(async () => {
  const db = connect();
  await db.query(
    sql`CREATE TABLE booleans_test_booleans (id INT NOT NULL PRIMARY KEY, test_value BOOLEAN);`,
  );
  await db.query(sql`
    INSERT INTO booleans_test_booleans (id, test_value)
    VALUES (1, ${true}),
           (2, ${false}),
           (3, 42),
           (4, null);
  `);
  await db.dispose();
});

test('booleans as number', async () => {
  const db = connect({nullMode: 'strict', tinyIntMode: 'number'});
  const result = await db.query(sql`
    SELECT id, test_value from booleans_test_booleans;
  `);
  expect(result).toEqual([
    {id: 1, test_value: 1},
    {id: 2, test_value: 0},
    {id: 3, test_value: 42},
    {id: 4, test_value: null},
  ]);
  await db.dispose();
});

test('booleans as boolean', async () => {
  const db = connect({nullMode: 'strict', tinyIntMode: 'boolean'});
  const result = await db.query(sql`
    SELECT id, test_value from booleans_test_booleans;
  `);
  expect(result).toEqual([
    {id: 1, test_value: true},
    {id: 2, test_value: false},
    {id: 3, test_value: true},
    {id: 4, test_value: null},
  ]);
  await db.dispose();
});
