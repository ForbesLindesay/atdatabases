import createConnectionPool from '../';

async function clearPromiseQueue() {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => r());
  }
}

async function delay(ms: number) {
  await new Promise<void>((r) => setTimeout(r, ms));
}

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
  await clearPromiseQueue();
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

  await clearPromiseQueue();
  expect(drained).toBe(false);

  d.release();
  await clearPromiseQueue();
  expect(drained).toBe(false);

  e.release();
  await clearPromiseQueue();
  expect(drained).toBe(false);

  g.release();
  await clearPromiseQueue();
  expect(drained).toBe(true);
  expect(connections.size).toBe(0);
});

test('ConnectionPool - Unlimited size', async () => {
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
  });
  expect(pool.getConnectionsCount() === 0);
  expect(pool.getIdleConnectionsCount() === 0);
  expect(pool.getQueueLength() === 0);
  const records = [];
  for (let i = 1; i <= 100; i++) {
    const connectionRecord = await pool.getConnection();
    expect(connectionRecord.connection).toBe(i);
    records.push(connectionRecord);
  }
  expect(pool.getConnectionsCount() === 100);
  expect(pool.getIdleConnectionsCount() === 0);
  expect(pool.getQueueLength() === 0);
  for (const r of records.splice(0, records.length)) {
    r.release();
  }
  expect(pool.getConnectionsCount() === 100);
  expect(pool.getIdleConnectionsCount() === 100);
  expect(pool.getQueueLength() === 0);
  for (let i = 1; i <= 100; i++) {
    const connectionRecord = await pool.getConnection();
    expect(connectionRecord.connection).toBe(i);
    records.push(connectionRecord);
  }
  expect(pool.getConnectionsCount() === 100);
  expect(pool.getIdleConnectionsCount() === 0);
  expect(pool.getQueueLength() === 0);
  for (const r of records.splice(0, records.length)) {
    r.dispose();
  }
  await clearPromiseQueue();
  expect(pool.getConnectionsCount() === 0);
  expect(pool.getIdleConnectionsCount() === 0);
  expect(pool.getQueueLength() === 0);

  expect(pool.getConnectionsCount() === 0);

  await pool.drain();
  expect(connections.size).toBe(0);
});

test('ConnectionPool - maxUses', async () => {
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
    maxSize: 2,
    maxUses: 2,
  });
  let [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);
  a.release();
  b.release();
  expect([...connections].sort()).toEqual([1, 2]);

  [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);
  expect([...connections].sort()).toEqual([1, 2]);
  a.release();
  await clearPromiseQueue();
  expect([...connections].sort()).toEqual([2]);
  a = await pool.getConnection();
  const bPromise = pool.getConnection();
  b.release();
  b = await bPromise;
  await clearPromiseQueue();
  expect([...connections].sort()).toEqual([3, 4]);
  expect(a.connection).toBe(3);
  expect(b.connection).toBe(4);
  a.release();
  b.release();

  await pool.drain();
  expect(connections.size).toBe(0);
});

test('ConnectionPool - idleTimeoutMilliseconds', async () => {
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
    maxSize: 2,
    idleTimeoutMilliseconds: 10,
  });
  let [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);
  a.release();
  b.release();
  expect([...connections].sort()).toEqual([1, 2]);

  [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);
  a.release();
  b.release();
  expect([...connections].sort()).toEqual([1, 2]);

  await delay(50);
  expect([...connections].sort()).toEqual([]);
  [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(3);
  expect(b.connection).toBe(4);
  a.release();
  b.release();

  await pool.drain();
  expect(connections.size).toBe(0);
});

test('ConnectionPool - queueTimeoutMilliseconds', async () => {
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
    maxSize: 2,
    queueTimeoutMilliseconds: 10,
  });
  let [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);
  await expect(pool.getConnection()).rejects.toHaveProperty(
    'code',
    'CONNECTION_POOL:QUEUE_TIMEOUT',
  );

  const aPromise = pool.getConnection();
  a.release();
  b.release();
  [a, b] = await Promise.all([aPromise, pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);

  a.release();
  b.release();
  await pool.drain();
  expect(connections.size).toBe(0);
});

test('ConnectionPool - releaseTimeoutMilliseconds', async () => {
  let nextConnection = 1;
  const connections = new Set();
  const timedOut = new Set();
  const pool = createConnectionPool({
    getConnection: async () => {
      const connection = nextConnection++;
      connections.add(connection);
      return connection;
    },
    closeConnection: async (connection) => {
      connections.delete(connection);
    },
    onReleaseTimeout: async (connection) => {
      timedOut.add(connection);
      // N.B. in a real app, you must either throw (crashing the app)
      // or close the connection here
    },
    maxSize: 2,
    releaseTimeoutMilliseconds: 10,
  });
  let [a, b] = await Promise.all([pool.getConnection(), pool.getConnection()]);
  expect(a.connection).toBe(1);
  expect(b.connection).toBe(2);

  // we'll just try and get 2 more without releasing the original conections
  const [c, d] = await Promise.all([
    pool.getConnection(),
    pool.getConnection(),
  ]);
  expect(c.connection).toBe(3);
  expect(d.connection).toBe(4);
  expect([...timedOut].sort()).toEqual([1, 2]);

  // releasing the original connections is a no-op
  a.release();
  b.dispose();
  await clearPromiseQueue();

  expect(pool.getConnectionsCount()).toBe(2);
  expect(pool.getIdleConnectionsCount()).toBe(0);
  expect(pool.getQueueLength()).toBe(0);
  expect([...connections].sort()).toEqual([1, 2, 3, 4]);

  await pool.drain();
  expect(connections.size - timedOut.size).toBe(0);
});
