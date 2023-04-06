import createConnectionPool, {sql} from '../';

jest.setTimeout(30000);

const db = createConnectionPool(':memory:', {}, { maxSize: 2, releaseTimeoutMilliseconds: 100 });

afterAll(async () => {
  await db.dispose();
});

test('two parallel queries', async () => {
  let concurrent = 0;
  async function query () {
    const result = await db.tx(async (tx) => {
      if (++concurrent > 2) {
        throw new Error('Too many concurrent queries');
      }
      const a = await tx.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
      const b = await tx.query(sql`SELECT 1 + 2 as bar;`);
      return {a, b};
    });
    concurrent--
    expect(result).toEqual({ a: [ { foo: 42 } ], b: [ { bar: 3 } ]})
  }

  await Promise.all([query(), query(), query(), query()]);
});

test('never releasing', async () => {
  try {
    await db.tx(() => {
      return new Promise(function () {
        // not calling resolve
      });
    });
    fail()
  } catch (e) {
    // pass
    expect((e as Error).message).toEqual('Transaction aborted');
  }
});
