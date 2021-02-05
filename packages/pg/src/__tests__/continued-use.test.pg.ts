import connect, {sql, Queryable} from '..';

jest.setTimeout(30_000);

const DURATION = 10_000;
const MIN_INTERVAL = 0;
const MAX_INTERVAL = 20;
const PROCESSES = 200;

let queryErrorCount = 0;
let queryResultsCount = 0;
let connectionsOpened = 0;
let currentConnectionsOpen = 0;
let maxConcurrentConnections = 0;
const db = connect({
  bigIntMode: 'bigint',
  maxUses: 200,
  onQueryError() {
    queryErrorCount++;
  },
  onQueryResults() {
    queryResultsCount++;
  },
  onConnectionOpened() {
    connectionsOpened++;
    currentConnectionsOpen++;
    maxConcurrentConnections = Math.max(
      maxConcurrentConnections,
      currentConnectionsOpen,
    );
  },
  onConnectionClosed() {
    currentConnectionsOpen--;
  },
});

beforeAll(async () => {
  await db.query(sql`
    CREATE SCHEMA continued_use_test;
    CREATE TABLE continued_use_test.continued_use_test (
      id INT NOT NULL PRIMARY KEY
    )
  `);
});

function randomInt(minInclusive: number, maxExclusive: number) {
  return (
    minInclusive + Math.floor(Math.random() * (maxExclusive - minInclusive))
  );
}

function randomValue<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length)];
}

const getNextInt = (() => {
  let nextInt = 0;
  function getNextInt() {
    return nextInt++;
  }
  return getNextInt;
})();
function insertInt(value: number) {
  return sql`INSERT INTO continued_use_test.continued_use_test (id) VALUES (${value});`;
}
async function insertedInt(value: number) {
  return (
    (
      await db.query(
        sql`SELECT * FROM continued_use_test.continued_use_test WHERE id=${value};`,
      )
    ).length === 1
  );
}

type Environment = <T>(fn: (db: Queryable) => Promise<T>) => Promise<T>;
type TestCase = (env: Environment) => Promise<void>;
const environments: Environment[] = [
  (fn) => fn(db),
  (fn) => db.task(fn),
  (fn) => db.tx(fn),
  (fn) => db.task((db) => db.tx(fn)),
  (fn) => db.tx((db) => db.tx(fn)),
  (fn) => db.task((db) => db.tx((db) => db.tx(fn))),
];
const testCases: TestCase[] = [
  async (env) => {
    expect(await env((db) => db.query(sql`SELECT 1+1 as result`))).toEqual([
      {result: 2},
    ]);
  },
  async (env) => {
    expect(
      await env((db) =>
        db.query(sql`SELECT 1+1 as result_a;SELECT 1+2 as result_b`),
      ),
    ).toEqual([{result_b: 3}]);
  },
  async (env) => {
    expect(
      await env((db) =>
        db.query([sql`SELECT 1+1 as result_a`, sql`SELECT 1+2 as result_b`]),
      ),
    ).toEqual([[{result_a: 2}], [{result_b: 3}]]);
  },
  async (env) => {
    const i = getNextInt();
    await env((db) => db.query(insertInt(i)));
    expect(await insertedInt(i)).toBe(true);
  },
  async (env) => {
    const a = getNextInt();
    const b = getNextInt();
    await env((db) => db.query(sql`${insertInt(a)}${insertInt(b)}`));
    expect(await insertedInt(a)).toBe(true);
    expect(await insertedInt(b)).toBe(true);
  },
  async (env) => {
    const a = getNextInt();
    const b = getNextInt();
    await env((db) => db.query([insertInt(a), insertInt(b)]));
    expect(await insertedInt(a)).toBe(true);
    expect(await insertedInt(b)).toBe(true);
  },
  async (env) => {
    const a = getNextInt();
    await expect(
      env((db) =>
        db.query(
          sql`${insertInt(
            a,
          )}SELECT non_existant_column FROM continued_use_test.continued_use_test;`,
        ),
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(await insertedInt(a)).toBe(false);
  },
  async (env) => {
    const a = getNextInt();
    await expect(
      env((db) =>
        db.query(
          sql`SELECT non_existant_column FROM continued_use_test.continued_use_test;${insertInt(
            a,
          )}`,
        ),
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(await insertedInt(a)).toBe(false);
  },
  async (env) => {
    const a = getNextInt();
    await expect(
      env((db) =>
        db.query([
          insertInt(a),
          sql`SELECT non_existant_column FROM continued_use_test.continued_use_test;`,
        ]),
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(await insertedInt(a)).toBe(false);
  },
  async (env) => {
    const a = getNextInt();
    await expect(
      env((db) =>
        db.query([
          sql`SELECT non_existant_column FROM continued_use_test.continued_use_test;`,
          insertInt(a),
        ]),
      ),
    ).rejects.toBeInstanceOf(Error);
    expect(await insertedInt(a)).toBe(false);
  },
];
async function startProcess(stop: Promise<void>) {
  const results: Promise<void>[] = [];
  let stopping = false;
  const onTimeout = () => {
    if (stopping) return;
    const env = randomValue(environments);
    const testCase = randomValue(testCases);
    const result = testCase(env);
    results.push(result);
    result.then(
      () => {
        if (stopping) return;
        setTimeout(onTimeout, randomInt(MIN_INTERVAL, MAX_INTERVAL));
      },
      () => {
        if (stopping) return;
        setTimeout(onTimeout, randomInt(MIN_INTERVAL, MAX_INTERVAL));
      },
    );
  };
  setTimeout(onTimeout, randomInt(MIN_INTERVAL, MAX_INTERVAL));
  await stop;
  stopping = true;
  await Promise.all(results);
  return results.length;
}

let passed = true;
for (const env of environments) {
  describe(env.toString(), () => {
    for (const testCase of testCases) {
      test(testCase.toString(), async () => {
        try {
          await testCase(env);
        } catch (ex) {
          passed = false;
          throw ex;
        }
      });
    }
  });
}
test('continued & varied use', async () => {
  if (!passed) {
    return;
  }
  const start = Date.now();
  let testCount = 0;
  const stopPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, DURATION);
  });
  const processes: Promise<undefined | Error>[] = [];
  for (let i = 0; i < PROCESSES; i++) {
    processes.push(
      startProcess(stopPromise).then(
        (count) => {
          testCount += count;
          return undefined;
        },
        (err) => err,
      ),
    );
  }
  const err = (await Promise.all(processes)).find(
    (result) => result !== undefined,
  );
  if (err) {
    throw err;
  }
  await db.dispose();
  console.log(
    `test count = ${testCount}\nduration = ${
      Date.now() - start
    }ms\nsuccessful queries=${queryResultsCount}\nfailing queries=${queryErrorCount} (N.B. we are intentionally testing queries with errors)\nconnections opened=${connectionsOpened}\nmax concurrent connections=${maxConcurrentConnections}`,
  );
});
