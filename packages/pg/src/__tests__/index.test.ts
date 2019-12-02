import connect, { TransactionOptions } from '../';
import sql from '@databases/sql';
import { txMode } from 'pg-promise';

jest.setTimeout(30000);

const db = connect(
  undefined,
  {noDuplicateDatabaseObjectsWarning: true},
);
const db2 = connect(
  undefined,
  {noDuplicateDatabaseObjectsWarning: true},
);
const db3 = connect(
  undefined,
  {noDuplicateDatabaseObjectsWarning: true},
);

afterAll(async () => {
  // tslint:disable-next-line:no-void-expression
  expect(await db.dispose()).toBe(undefined);
  await db2.dispose();
  await db3.dispose();
});

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

  expect(await db2.query(sql`SELECT id from bigint_test.bigints;`)).toEqual([
    {id: 1},
    {id: 2},
    {id: 42},
  ]);

  expect(await db3.query(sql`SELECT id from bigint_test.bigints;`)).toEqual([
    {id: 1},
    {id: 2},
    {id: 42},
  ]);
});

test('deferrable transactions', async () => {
  const transactionOptions: TransactionOptions = {
    isolationLevel: txMode.isolationLevel.serializable,
    readOnly: false,
    deferrable: true,
  };
  let error;
  try {
    await db.tx(async (tx) => {
      await tx.query(sql`
      CREATE TABLE parents (
        id SERIAL PRIMARY KEY
      );
    `);

      await tx.query(sql`
      CREATE TABLE children (
        id SERIAL PRIMARY KEY,
        parent_id INT REFERENCES parents(id) INITIALLY DEFERRED
      );
    `);

      // inserting into children before creating the parent will throw an error
      // unless the transaction is deferred
      await tx.query(sql`
      INSERT INTO children (
        parent_id
      ) VALUES (
        1
      );
    `);

      await tx.query(sql`
      INSERT INTO parents (
        id
      ) VALUES (
        1
      );
    `);
    }, transactionOptions);
  } catch (e) {
    error = e;
  } finally {
    expect(error).toBe(undefined);
  }
});
