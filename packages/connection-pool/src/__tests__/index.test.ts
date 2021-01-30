import createConnectionPool from '../';

test('ConnectionPool', async () => {
  let nextConnection = 1;
  const connections = new Set();
  const pool = createConnectionPool({
    getConnection: async () => {
      const connection = nextConnection++;
      connections.add(connection);
      return connection;
    },
    closeConnection: async (connection) => {
      connections.delete(connection);
    },
    maxSize: 3,
  });
  const a = await pool.getConnection();
  expect(a.connection).toBe(1);

  const b = await pool.getConnection();
  expect(b.connection).toBe(2);

  const c = await pool.getConnection();
  expect(c.connection).toBe(3);

  b.release();
  const d = await pool.getConnection();
  expect(d.connection).toBe(2);

  const ePromise = pool.getConnection();
  a.release();
  const e = await ePromise;
  expect(e.connection).toBe(1);

  c.dispose();
  await new Promise((r) => setTimeout(r, 100));
  const f = await pool.getConnection();
  expect(f.connection).toBe(4);

  const gPromise = pool.getConnection();
  f.dispose();
  const g = await gPromise;
  expect(g.connection).toBe(5);

  expect([...connections].sort()).toEqual([1, 2, 5]);
  let drained = false;
  pool.drain().then(
    () => {
      drained = true;
    },
    (err) => {
      setImmediate(() => {
        throw err;
      });
    },
  );

  await new Promise((r) => setTimeout(r, 100));
  expect(drained).toBe(false);

  d.release();
  await new Promise((r) => setTimeout(r, 100));
  expect(drained).toBe(false);

  e.release();
  await new Promise((r) => setTimeout(r, 100));
  expect(drained).toBe(false);

  g.release();
  await new Promise((r) => setTimeout(r, 100));
  expect(drained).toBe(true);
});
