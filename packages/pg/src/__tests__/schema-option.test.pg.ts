import connect from '..';
import sql from '@databases/sql';

jest.setTimeout(30000);

const db = connect({
  bigIntMode: 'number',
  schema: 'my_custom_schema_to_test_default_schema_option',
});

afterAll(async () => {
  await db.dispose();
});

test('bigint', async () => {
  await db.query(
    sql`CREATE SCHEMA my_custom_schema_to_test_default_schema_option`,
  );
  await db.query(
    sql`CREATE TABLE my_custom_schema_to_test_default_schema_option.values (id INT NOT NULL PRIMARY KEY);`,
  );
  await db.query(sql`
    INSERT INTO values (id)
    VALUES (1),
           (2),
           (42);
  `);
  const result = await db.query(sql`SELECT id from values;`);
  expect(result).toEqual([{id: 1}, {id: 2}, {id: 42}]);
});
