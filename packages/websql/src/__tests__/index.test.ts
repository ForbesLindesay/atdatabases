import connect, {sql} from '../';

jest.setTimeout(30000);

const db = connect();

// afterAll(async () => {
//   await db.dispose();
// });

test('error messages', async () => {
  try {
    const s = sql;
    await db.query(s`
      SELECT * FRM 'baz;
    `);
  } catch (ex) {
    expect(ex.message).toMatchInlineSnapshot(`
"SQLITE_ERROR: near \\"FRM\\": syntax error

  1 | 
> 2 |       SELECT * FRM 'baz;
    |                ^^^
  3 |     
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
  await db.query(
    sql`CREATE TABLE bigint_test_bigints (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  await db.query(sql`
    INSERT INTO bigint_test_bigints (id)
    VALUES (1),
           (2),
           (42);
  `);
  const result = await db.query(sql`SELECT id from bigint_test_bigints;`);
  expect(result).toEqual([{id: 1}, {id: 2}, {id: 42}]);
});

test('transaction', async () => {
  const result = await db.tx(function*(tx) {
    const a = yield tx.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
    const b = yield tx.query(sql`SELECT 1 + 2 as bar;`);
    return {a, b};
  });
  expect(result).toMatchInlineSnapshot(`
Object {
  "a": Array [
    Object {
      "foo": 42,
    },
  ],
  "b": Array [
    Object {
      "bar": 3,
    },
  ],
}
`);
});
