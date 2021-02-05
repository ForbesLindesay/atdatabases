import connect, {sql} from '..';

jest.setTimeout(30000);

beforeAll(async () => {
  const db = connect();
  await db.query(
    sql`CREATE TABLE bigint_test_bigints (id INT NOT NULL PRIMARY KEY, test_value BIGINT NOT NULL);`,
  );
  await db.query(sql`
    INSERT INTO bigint_test_bigints (id, test_value)
    VALUES (1, ${1}),
           (2, ${2}),
           (3, ${2000}),
           (4, ${Number.MAX_SAFE_INTEGER}),
           (5, ${'9999999999999999'});
  `);
  await db.dispose();
});

test('bigints as number', async () => {
  const db = connect({bigIntMode: 'number'});
  const result = await db.query(sql`
    SELECT id, test_value from bigint_test_bigints;
  `);
  expect(result).toEqual([
    {id: 1, test_value: 1},
    {id: 2, test_value: 2},
    {id: 3, test_value: 2000},
    {id: 4, test_value: Number.MAX_SAFE_INTEGER},
    // N.B. this value is inexact:
    {id: 5, test_value: 10000000000000000},
  ]);
  await db.dispose();
});

test('bigints as string', async () => {
  const db = connect({bigIntMode: 'string'});
  const result = await db.query(sql`
    SELECT id, test_value from bigint_test_bigints;
  `);
  expect(result).toEqual([
    {id: 1, test_value: '1'},
    {id: 2, test_value: '2'},
    {id: 3, test_value: '2000'},
    {id: 4, test_value: Number.MAX_SAFE_INTEGER.toString()},
    {id: 5, test_value: '9999999999999999'},
  ]);
  await db.dispose();
});

test('bigints as BigInt', async () => {
  const db = connect({bigIntMode: 'bigint'});
  const result = await db.query(sql`
    SELECT id, test_value from bigint_test_bigints;
  `);
  expect(result).toEqual([
    {id: 1, test_value: BigInt('1')},
    {id: 2, test_value: BigInt('2')},
    {id: 3, test_value: BigInt('2000')},
    {id: 4, test_value: BigInt(Number.MAX_SAFE_INTEGER.toString())},
    {id: 5, test_value: BigInt('9999999999999999')},
  ]);
  await db.dispose();
});
