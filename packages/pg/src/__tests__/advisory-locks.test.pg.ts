import connect, {sql, Transaction} from '..';

jest.setTimeout(10000);

let activeLockCount = 0;
const db = connect({
  bigIntMode: 'number',
  schema: 'advisory_locks',
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
  await db.query(sql`CREATE SCHEMA IF NOT EXISTS advisory_locks`);
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
    wait() {
      hasSubscriber = true;
      return promise;
    },
    isResolved: () => result !== undefined,
    hasSubscriber: () => hasSubscriber,
  };
}

function testTransaction<T>(getLock: (db: Transaction) => Promise<T>) {
  activeLockCount++;
  const gotLock = promise<T>();
  const releaseLock = promise<undefined>();
  const tx = db.tx(async (db) => {
    const result = await getLock(db);
    gotLock.resolve(result);
    await releaseLock.wait();
  });
  return {
    waitForLock: () => gotLock.wait(),
    hasLock: () => gotLock.isResolved() && !releaseLock.isResolved(),
    lockValue: () => gotLock.result(),

    releaseLock: () => {
      expect(releaseLock.isResolved()).toBe(false);
      activeLockCount--;
      releaseLock.resolve(undefined);
    },
    waitForRelease: () => tx,
  };
}

for (const [keyName, key, otherKey] of [
  ['number', 1, 2],
  ['string', '3', '4'],
  ['bigint', BigInt(5), BigInt(6)],
  ['pair of ints', [10, 32], [10, 31]],
] as const) {
  test(`locks wait for each other - ${keyName}`, async () => {
    await prepare();

    const txOther = testTransaction(async (db) => {
      await db.advisoryTxLock(otherKey);
    });
    txOther.waitForLock();

    const txA = testTransaction(async (db) => {
      await db.advisoryTxLock(key);
    });
    await txA.waitForLock();
    const txB = testTransaction(async (db) => {
      await db.advisoryTxLock(key);
    });

    expect(txA.hasLock()).toBe(true);
    expect(txB.hasLock()).toBe(false);

    txA.releaseLock();
    await txB.waitForLock();

    expect(txA.hasLock()).toBe(false);
    expect(txB.hasLock()).toBe(true);

    txB.releaseLock();

    txOther.releaseLock();
  });

  test(`exclusive locks wait for shared locks - ${keyName}`, async () => {
    await prepare();

    const txA = testTransaction(async (db) => {
      await db.advisoryTxLockShared(key);
    });
    const txB = testTransaction(async (db) => {
      await db.advisoryTxLockShared(key);
    });

    await Promise.all([txA.waitForLock(), txB.waitForLock()]);

    const txC = testTransaction(async (db) => {
      await db.advisoryTxLock(key);
    });

    await delay(50);

    expect(txA.hasLock()).toBe(true);
    expect(txB.hasLock()).toBe(true);
    expect(txC.hasLock()).toBe(false);

    txA.releaseLock();
    txB.releaseLock();
    await txC.waitForLock();

    const txD = testTransaction(async (db) => {
      await db.advisoryTxLockShared(key);
    });
    const txE = testTransaction(async (db) => {
      await db.advisoryTxLockShared(key);
    });
    await delay(50);

    expect(txA.hasLock()).toBe(false);
    expect(txB.hasLock()).toBe(false);
    expect(txC.hasLock()).toBe(true);
    expect(txD.hasLock()).toBe(false);
    expect(txE.hasLock()).toBe(false);

    txC.releaseLock();
    await Promise.all([txD.waitForLock(), txE.waitForLock()]);
    expect(txA.hasLock()).toBe(false);
    expect(txB.hasLock()).toBe(false);
    expect(txC.hasLock()).toBe(false);
    expect(txD.hasLock()).toBe(true);
    expect(txE.hasLock()).toBe(true);
    txD.releaseLock();
    txE.releaseLock();
  });

  test(`try does not wait - ${keyName}`, async () => {
    await prepare();

    const txA = testTransaction(async (db) => await db.tryAdvisoryTxLock(key));
    expect(await txA.waitForLock()).toBe(true);
    const txB = testTransaction(async (db) => await db.tryAdvisoryTxLock(key));
    expect(await txB.waitForLock()).toBe(false);

    txA.releaseLock();
    txB.releaseLock();
    await txA.waitForRelease();

    const txC = testTransaction(async (db) => await db.tryAdvisoryTxLock(key));
    expect(await txC.waitForLock()).toBe(true);
    txC.releaseLock();
  });
  test(`try does not wait shared - ${keyName}`, async () => {
    await prepare();

    const txA = testTransaction(async (db) => await db.tryAdvisoryTxLockShared(key));
    expect(await txA.waitForLock()).toBe(true);
    const txB = testTransaction(async (db) => await db.tryAdvisoryTxLockShared(key));
    expect(await txB.waitForLock()).toBe(true);

    const txC = testTransaction(async db => await db.tryAdvisoryTxLock(key));
    expect(await txC.waitForLock()).toBe(false);

    txA.releaseLock();
    txB.releaseLock();
    txC.releaseLock();
    await Promise.all([txA.waitForRelease(), txB.waitForRelease()])

    const txD = testTransaction(async (db) => await db.tryAdvisoryTxLock(key));
    expect(await txD.waitForLock()).toBe(true);
    const txE = testTransaction(async (db) => await db.tryAdvisoryTxLockShared(key));
    expect(await txE.waitForLock()).toBe(false);
    txD.releaseLock();
    txE.releaseLock();
    await txD.waitForRelease();
    

    const txF = testTransaction(async (db) => await db.tryAdvisoryTxLockShared(key));
    expect(await txF.waitForLock()).toBe(true);
    const txG = testTransaction(async (db) => await db.tryAdvisoryTxLockShared(key));
    expect(await txG.waitForLock()).toBe(true);
    txF.releaseLock();
    txG.releaseLock();
  });
}
