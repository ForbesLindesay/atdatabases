import connect, {sql} from '..';

jest.setTimeout(30000);

const db = connect();

afterAll(async () => {
  await db.dispose();
});

test('error messages', async () => {
  try {
    const s = sql;
    await db.query(s`
      SELECT 1 + ${1} as foo;
      SELECT 1 + 42 as bar;
      SELECT * FRM 'baz;
      SELECT * FROM bing;
    `);
  } catch (ex: any) {
    expect(ex.message).toMatchInlineSnapshot(`
      "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near:

      > 1 | SELECT * FRM 'baz;
          |          ^^^^^^^^^
      > 2 | SELECT * FROM bing;
          | ^^^^^^^^^^^^^^^^^^^
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
