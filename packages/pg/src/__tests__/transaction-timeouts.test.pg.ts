import connect, {sql} from '..';

jest.setTimeout(10000);

let activeLockCount = 0;
const db = connect({
  bigIntMode: 'number',
  schema: 'transaction_timeouts',
  lockTimeoutMilliseconds: 3_000,
  idleInTransactionSessionTimeoutMilliseconds: 1_000,
  // TODO: min pg version 17
  // transactionTimeoutMilliseconds: 4_000,
});

beforeEach(() => {
  activeLockCount = 0;
});
afterEach(() => {
  expect(activeLockCount).toBe(0);
});
afterAll(async () => {
  expect(activeLockCount).toBe(0);
  await db.dispose();
});

async function prepare() {
  await db.query(sql`CREATE SCHEMA IF NOT EXISTS transaction_timeouts`);
}
async function delay(ms: number) {
  await new Promise<void>((r) => {
    setTimeout(r, ms);
  });
}

function promise<T>() {
  let resolve: ((value: T) => void) | undefined;
  let result: {value: T} | undefined;
  let hasSubscriber = false;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return {
    resolve(value: T) {
      result = {value};
      resolve!(value);
    },
    result: () => result?.value,
    async wait() {
      hasSubscriber = true;
      return await promise;
    },
    isResolved: () => result !== undefined,
    hasSubscriber: () => hasSubscriber,
  };
}

test(`lock timeout can be set overall and per transaction`, async () => {
  await prepare();
  const releaseLock = promise();
  const lock = db.tx(
    async (db) => {
      await db.advisoryTxLock(42);
      await releaseLock.wait();
    },
    {
      idleInTransactionSessionTimeoutMilliseconds: 8_000,
      // TODO: min pg version 17
      // transactionTimeoutMilliseconds: 8_000,
    },
  );
  {
    const start = Date.now();
    await expect(async () => {
      await db.tx(
        async (db) => {
          await db.advisoryTxLock(42);
        },
        {lockTimeoutMilliseconds: 500},
      );
    }).rejects.toMatchInlineSnapshot(
      `[error: canceling statement due to lock timeout]`,
    );
    const end = Date.now();
    expect(Math.abs(700 - (end - start))).toBeLessThan(200);
  }
  {
    const start = Date.now();
    await expect(async () => {
      await db.tx(
        async (db) => {
          await db.advisoryTxLock(42);
        },
        {lockTimeoutMilliseconds: 1_000},
      );
    }).rejects.toMatchInlineSnapshot(
      `[error: canceling statement due to lock timeout]`,
    );
    const end = Date.now();
    expect(Math.abs(1200 - (end - start))).toBeLessThan(200);
  }
  {
    const start = Date.now();
    await expect(async () => {
      await db.tx(
        async (db) => {
          await db.advisoryTxLock(42);
        },
        {lockTimeoutMilliseconds: 2_000},
      );
    }).rejects.toMatchInlineSnapshot(
      `[error: canceling statement due to lock timeout]`,
    );
    const end = Date.now();
    expect(Math.abs(2_200 - (end - start))).toBeLessThan(200);
  }
  {
    const start = Date.now();
    await expect(async () => {
      await db.tx(async (db) => {
        await db.advisoryTxLock(42);
      });
    }).rejects.toMatchInlineSnapshot(
      `[error: canceling statement due to lock timeout]`,
    );
    const end = Date.now();
    expect(Math.abs(3_200 - (end - start))).toBeLessThan(200);
  }
  releaseLock.resolve(undefined);
  await lock;
});

test(`idle in transaction timeout can be set overall`, async () => {
  await prepare();
  const releaseLock = promise();
  const lock = db.tx(async (db) => {
    await db.advisoryTxLock(64);
    await releaseLock.wait();
  });
  expect(Math.abs(1_200 - (await timeUntilLockAvailable()))).toBeLessThan(200);
  releaseLock.resolve(undefined);
  await expect(lock).rejects.toMatchInlineSnapshot(
    `[error: terminating connection due to idle-in-transaction timeout]`,
  );
});
test(`idle in transaction timeout can be per transaction`, async () => {
  await prepare();
  const releaseLock = promise();
  const lock = db.tx(
    async (db) => {
      await db.advisoryTxLock(64);
      await releaseLock.wait();
    },
    {idleInTransactionSessionTimeoutMilliseconds: 500},
  );
  expect(Math.abs(700 - (await timeUntilLockAvailable()))).toBeLessThan(200);
  releaseLock.resolve(undefined);
  await expect(lock).rejects.toMatchInlineSnapshot(
    `[error: terminating connection due to idle-in-transaction timeout]`,
  );
});

async function timeUntilLockAvailable() {
  const start = Date.now();
  while (!(await db.tx(async (db) => await db.tryAdvisoryTxLock(64)))) {
    await delay(10);
  }
  return Date.now() - start;
}

// TODO: min pg version 17
// test(`transaction timeout can be set per transaction`, async () => {
//   await prepare();
//   const lock = db.tx(
//     async (db) => {
//       await db.advisoryTxLock(64);
//       while (true) {
//         await db.query(sql`SELECT 1;`);
//         await delay(200);
//       }
//     },
//     {transactionTimeoutMilliseconds: 500},
//   );
//   lock.catch(() => {});
//   expect(await db.tx(async (db) => await db.tryAdvisoryTxLock(64))).toBe(false);
//   await delay(700);
//   expect(await db.tx(async (db) => await db.tryAdvisoryTxLock(64))).toBe(true);
//   await expect(lock).rejects.toMatchInlineSnapshot(
//     `[Error: Client has encountered a connection error and is not queryable]`,
//   );
// });
