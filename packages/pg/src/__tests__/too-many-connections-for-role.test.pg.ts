import connect, {sql, SQLErrorCode} from '..';

jest.setTimeout(30_000);

beforeAll(async () => {
  const db = connect({
    bigIntMode: 'bigint',
  });
  await db.query(sql`
    CREATE SCHEMA too_many_connections;
    CREATE ROLE too_many_connections WITH
      LOGIN
      PASSWORD 'test_password'
      CONNECTION LIMIT 2;
    CREATE TABLE too_many_connections.too_many_connections (
      id INT NOT NULL PRIMARY KEY
    );
  `);
  await db.dispose();
});

test(`Handling too many connections for role`, async () => {
  const connectionString = `postgres://too_many_connections:test_password@${
    process.env.PG_URL!.split(`@`)[1]
  }`;
  const errors: any[] = [];
  const pool = connect({
    bigIntMode: 'bigint',
    connectionString,
    onError(err) {
      errors.push(err);
    },
  });
  await Promise.all(
    Array.from({length: 10}).map(async () => {
      expect(
        await pool.tx(async (db) => {
          await new Promise<void>((r) => setTimeout(() => r(), 500));
          return (await db.query(sql`SELECT 1+1 AS result`))[0].result;
        }),
      ).toBe(2);
    }),
  );
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.length).toBeLessThan(10);
  for (const err of errors) {
    expect(err.message).toMatch(/too many connections for role/);
    expect(err.code).toBe(SQLErrorCode.TOO_MANY_CONNECTIONS);
  }
  await pool.dispose();
});
