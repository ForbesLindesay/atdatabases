import createConnectionPool, {sql} from '../';

jest.setTimeout(30000);

const db = createConnectionPool();

afterAll(async () => {
  await db.dispose();
});

test('error messages', async () => {
  expect.assertions(1);

  try {
    await db.query(sql`SELECT * FRM 'baz;`);
  } catch (e) {
    expect((e as any).code).toMatch('SQLITE_ERROR');
  }
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
  const result = await db.tx(async (tx) => {
    const a = await tx.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
    const b = await tx.query(sql`SELECT 1 + 2 as bar;`);
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

test('two parallel queries', async () => {
  async function query() {
    const [{foo}] = await db.query(sql`SELECT 1 + 1 as foo`);
    expect(foo).toBe(2);
  }

  await Promise.all([query(), query()]);
});
