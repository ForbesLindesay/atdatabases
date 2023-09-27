import connect from '..';
import sql from '@databases/sql';

jest.setTimeout(30000);

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});
test('error messages', async function testErrorMessages() {
  try {
    await db.query(sql`
      SELECT * FROM foo
      WHERE id = ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'}
      INER JOIN bar ON bar.id=foo.bar_id;
    `);
  } catch (ex: any) {
    expect(ex).toHaveProperty('severity', 'ERROR');
    expect(ex).toHaveProperty('code', '42601');
    expect(ex).toHaveProperty('position', '33');
    expect(ex).toHaveProperty('length');
    expect(ex).toHaveProperty('file');
    expect(ex).toHaveProperty('line');
    expect(ex).toHaveProperty('routine');

    expect(ex.message).toMatchInlineSnapshot(`
      "syntax error at or near \\"INER\\"

        1 | SELECT * FROM foo
        2 | WHERE id = $1
      > 3 | INER JOIN bar ON bar.id=foo.bar_id;
          | ^^^^
      "
    `);

    if (!process.version.startsWith('v12.')) {
      expect(ex.stack).toMatch(/testErrorMessages/);
      expect(ex.stack).toMatch(/index\.test\.pg\.ts/);
    }
    return;
  }
  expect(false).toBe(true);
});
test('non sql error messages in a transaction', async function testErrorMessages() {
  try {
    await db.tx(async function testTransaction() {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      throw new Error('Some Error');
    });
  } catch (ex: any) {
    expect(ex.message).toBe('Some Error');

    if (!process.version.startsWith('v12.')) {
      expect(ex.stack).toMatch(/testTransaction/);
      expect(ex.stack).toMatch(/testErrorMessages/);
      expect(ex.stack).toMatch(/index\.test\.pg\.ts/);
    }
    return;
  }
  expect(false).toBe(true);
});

test('error messages in a transaction', async function testErrorMessages() {
  try {
    await db.tx(async function testTransaction(db) {
      await db.query(sql`
        SELECT * FROM foo
        WHERE id = ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'}
        INER JOIN bar ON bar.id=foo.bar_id;
      `);
    });
  } catch (ex: any) {
    expect(ex).toHaveProperty('severity', 'ERROR');
    expect(ex).toHaveProperty('code', '42601');
    expect(ex).toHaveProperty('position', '33');
    expect(ex).toHaveProperty('length');
    expect(ex).toHaveProperty('file');
    expect(ex).toHaveProperty('line');
    expect(ex).toHaveProperty('routine');

    expect(ex.message).toMatchInlineSnapshot(`
      "syntax error at or near \\"INER\\"

        1 | SELECT * FROM foo
        2 | WHERE id = $1
      > 3 | INER JOIN bar ON bar.id=foo.bar_id;
          | ^^^^
      "
    `);

    if (!process.version.startsWith('v12.')) {
      expect(ex.stack).toMatch(/testTransaction/);
      expect(ex.stack).toMatch(/testErrorMessages/);
      expect(ex.stack).toMatch(/index\.test\.pg\.ts/);
    }
    return;
  }
  expect(false).toBe(true);
});

test('query', async () => {
  const [{foo}] = await db.query<{foo: number}>(sql`SELECT 1 + 1 as foo`);
  expect(foo).toBe(2);
});

test('query - multiple queries', async () => {
  const resultA = await db.query<[[{foo: number}]]>([sql`SELECT 1 + 1 as foo`]);
  expect(resultA).toEqual([[{foo: 2}]]);
  const resultB = await db.query<[[{foo: number}], [{bar: number}]]>([
    sql`SELECT ${1} + 1 as foo;`,
    sql`SELECT 1 + ${2} as bar;`,
  ]);
  expect(resultB).toEqual([[{foo: 2}], [{bar: 3}]]);
});

test('query with params', async () => {
  const [{foo}] = await db.query<{foo: number}>(
    sql`SELECT 1 + ${41} as ${sql.ident('foo')}`,
  );
  expect(foo).toBe(42);
});

test('json', async () => {
  await db.query(sql`CREATE SCHEMA json_test`);
  await db.query(
    sql`CREATE TABLE json_test.json (id TEXT NOT NULL PRIMARY KEY, val JSONB NOT NULL);`,
  );
  async function setOneImpliedJson(
    id: string,
    val: unknown,
  ): Promise<{id: string; val: unknown}> {
    const [result] = await db.query<{id: string; val: unknown}>(sql`
      INSERT INTO json_test.json (id, val) VALUES (${id}, ${val})
      ON CONFLICT (id) DO UPDATE SET val=EXCLUDED.val
      RETURNING *;
    `);
    return result;
  }
  async function setOneExplicitJson(
    id: string,
    val: unknown,
  ): Promise<{id: string; val: unknown}> {
    const [result] = await db.query<{id: string; val: unknown}>(sql`
      INSERT INTO json_test.json (id, val) VALUES (${id}, ${JSON.stringify(
      val,
    )})
      ON CONFLICT (id) DO UPDATE SET val=EXCLUDED.val
      RETURNING *;
    `);
    return result;
  }
  async function setMany(
    ...values: readonly {
      readonly id: string;
      readonly val: unknown;
    }[]
  ): Promise<{id: string; val: unknown}[]> {
    const results = await db.query<{id: string; val: unknown}>(
      values.map(
        ({id, val}) => sql`
          INSERT INTO json_test.json (id, val)
          VALUES (${id}, ${JSON.stringify(val)})
          ON CONFLICT (id) DO UPDATE SET val=EXCLUDED.val
          RETURNING *;
        `,
      ),
    );
    return results.map(([{id, val}]) => ({id, val}));
  }

  await expect(setOneImpliedJson('obj', {foo: 'bar'})).resolves.toEqual({
    id: 'obj',
    val: {
      foo: 'bar',
    },
  });
  await expect(setOneExplicitJson('arr', ['my string', 56])).resolves.toEqual({
    id: 'arr',
    val: ['my string', 56],
  });
  await expect(setOneExplicitJson('str', 'my string')).resolves.toEqual({
    id: 'str',
    val: 'my string',
  });
  await expect(setOneExplicitJson('num', 42)).resolves.toEqual({
    id: 'num',
    val: 42,
  });

  await expect(setOneImpliedJson('obj', {foo: 'bing'})).resolves.toEqual({
    id: 'obj',
    val: {
      foo: 'bing',
    },
  });
  await expect(setOneExplicitJson('arr', [56, 'my string'])).resolves.toEqual({
    id: 'arr',
    val: [56, 'my string'],
  });
  await expect(setOneExplicitJson('str', 'my other string')).resolves.toEqual({
    id: 'str',
    val: 'my other string',
  });
  await expect(setOneExplicitJson('num', 21)).resolves.toEqual({
    id: 'num',
    val: 21,
  });

  await expect(
    setMany(
      {id: 'obj', val: {foo: 'bar'}},
      {id: 'arr', val: ['my string', 56]},
      {id: 'str', val: 'my string'},
      {id: 'num', val: 42},
    ),
  ).resolves.toEqual([
    {id: 'obj', val: {foo: 'bar'}},
    {id: 'arr', val: ['my string', 56]},
    {id: 'str', val: 'my string'},
    {id: 'num', val: 42},
  ]);
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

  expect(await db.query(sql`SELECT id from bigint_test.bigints;`)).toEqual([
    {id: 1},
    {id: 2},
    {id: 42},
  ]);
});
