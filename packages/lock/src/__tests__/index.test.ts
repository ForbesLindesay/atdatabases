import {createLock, createLocksByKey} from '..';

type PromiseState<T> = ['pending'] | ['fulfilled', T] | ['rejected', string];
const pending: ['pending'] = ['pending'];
const fulfilled = <T>(value: T): ['fulfilled', T] => ['fulfilled', value];
const rejected = (err: string): ['rejected', string] => ['rejected', err];
async function clearPromiseQueue() {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => r());
  }
}
async function delay(ms: number) {
  await new Promise<void>((r) => setTimeout(r, ms));
}

function expectPromises<T>(state: {test(): T}) {
  return expect(state.test()).resolves;
}
function promisesState() {
  let running = false;
  let previousPromises: Promise<any>[] = [];
  let newPromises: Promise<any>[] = [];
  async function test() {
    expect(running).toBe(false);
    running = true;
    const promises = [...previousPromises, ...newPromises];
    previousPromises = [];
    newPromises = [];
    const results = promises.map((): PromiseState<any> => pending);
    for (let i = 0; i < promises.length; i++) {
      const index = i;
      promises[index].then(
        (value) => {
          results[index] = fulfilled(value);
        },
        (err) => {
          if (err instanceof Error) {
            results[index] = rejected(err.message);
          } else {
            results[index] = rejected('NON_ERROR');
          }
        },
      );
    }
    await clearPromiseQueue();
    previousPromises = promises.filter((_, i) => results[i][0] === 'pending');
    running = false;
    return results.slice();
  }
  function push(...value: Promise<any>[]) {
    newPromises.push(...value);
  }
  return {test, push};
}

test('lock with 20ms timeout', async () => {
  const lock = createLock(20);
  const results = promisesState();

  results.push(lock.acquireLock(), lock.acquireLock(), lock.acquireLock());
  await expectPromises(results).toEqual([
    fulfilled(undefined),
    pending,
    pending,
  ]);

  lock.releaseLock();
  await expectPromises(results).toEqual([fulfilled(undefined), pending]);

  await delay(40);
  await expectPromises(results).toEqual([
    rejected('Timed out waiting for lock after 20ms'),
  ]);

  results.push(lock.acquireLock('hello world'));
  results.push(lock.pool());
  await expectPromises(results).toEqual([fulfilled('hello world'), pending]);

  await delay(40);
  await expectPromises(results).toEqual([
    rejected('Timed out waiting for lock after 20ms'),
  ]);

  results.push(lock.acquireLock());
  results.push(lock.pool());
  await expectPromises(results).toEqual([fulfilled(undefined), pending]);

  lock.releaseLock();
  await expectPromises(results).toEqual([fulfilled(undefined)]);

  results.push(lock.acquireLock());
  await expectPromises(results).toEqual([
    rejected('Cannot call Lock after returning the object to the pool.'),
  ]);
});

test('lock with no timeout', async () => {
  const lock = createLock();
  const results = promisesState();

  results.push(lock.acquireLock(), lock.acquireLock(), lock.acquireLock());
  await expectPromises(results).toEqual([
    fulfilled(undefined),
    pending,
    pending,
  ]);

  lock.releaseLock();
  await expectPromises(results).toEqual([fulfilled(undefined), pending]);

  await delay(40);
  await expectPromises(results).toEqual([pending]);

  lock.releaseLock();
  await expectPromises(results).toEqual([fulfilled(undefined)]);

  lock.releaseLock();
  results.push(lock.acquireLock('hello world'));
  results.push(lock.pool());
  await expectPromises(results).toEqual([fulfilled('hello world'), pending]);

  await delay(40);
  await expectPromises(results).toEqual([pending]);

  lock.releaseLock();
  await expectPromises(results).toEqual([fulfilled(undefined)]);

  results.push(lock.acquireLock());
  await expectPromises(results).toEqual([
    rejected('Cannot call Lock after returning the object to the pool.'),
  ]);
});

test('locks by key', async () => {
  const lock = createLocksByKey();
  const results = promisesState();

  results.push(
    lock.acquireLock('a'),
    lock.acquireLock('a'),
    lock.acquireLock('b'),
  );
  await expectPromises(results).toEqual([
    fulfilled(undefined),
    pending,
    fulfilled(undefined),
  ]);

  lock.releaseLock('a');
  await expectPromises(results).toEqual([fulfilled(undefined)]);

  lock.releaseLock('a');
  lock.releaseLock('b');
  results.push(lock.acquireLock('a', 24), lock.acquireLock('b', 42));
  await expectPromises(results).toEqual([fulfilled(24), fulfilled(42)]);
  lock.releaseLock('a');
  lock.releaseLock('b');
});
