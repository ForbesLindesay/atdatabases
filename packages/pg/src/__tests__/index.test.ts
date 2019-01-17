import connect from '../';
import sql from '@databases/sql';

jest.setTimeout(30000);

const db = connect();
const db2 = connect();
const db3 = connect();

test('error messages', async () => {
  try {
    await db.query(sql`
      SELECT * FROM foo;
      SELECT * FROM bar WHERE id = ${'Hello World, Goodbye World, etc.'};
      SELECT * FRM baz;
      SELECT * FROM bing;
    `);
  } catch (ex) {
    expect(ex.message).toMatchInlineSnapshot(`
"syntax error at or near \\"FRM\\"

  2 |       SELECT * FROM foo;
  3 |       SELECT * FROM bar WHERE id = $1;
> 4 |       SELECT * FRM baz;
    |                ^^^
  5 |       SELECT * FROM bing;
  6 |     
"
`);
    return;
  }
  expect(false).toBe(true);
});

test('query', async () => {
  const [{foo}] = await db.query(sql`SELECT 1 + 1 as foo`);
  expect(foo).toBe(2);
});

test('query with params', async () => {
  const [{foo}] = await db.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
  expect(foo).toBe(42);
});

test('bigint', async () => {
  await db.query(sql`CREATE SCHEMA bigint_test`);
  await db.query(
    sql`CREATE TABLE bigint_test.bigints (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  await db.query(sql`
    INSERT INTO bigint_test.bigints (id)
    VALUES (1),
           (2),
           (42);
  `);
  const result = await db.query(sql`SELECT id from bigint_test.bigints;`);
  expect(result).toEqual([{id: 1}, {id: 2}, {id: 42}]);
  // tslint:disable-next-line:no-void-expression
  expect(await db.dispose()).toBe(undefined);

  expect(await db2.query(sql`SELECT id from bigint_test.bigints;`)).toEqual([
    {id: 1},
    {id: 2},
    {id: 42},
  ]);
  await db2.dispose();

  expect(await db3.query(sql`SELECT id from bigint_test.bigints;`)).toEqual([
    {id: 1},
    {id: 2},
    {id: 42},
  ]);
  await db3.dispose();
});
