import connect, {IsolationLevel, Transaction, sql} from '..';

jest.setTimeout(30000);

const db = connect({
  bigIntMode: 'number',
  schema: 'transaction_isolation_test',
});

afterAll(async () => {
  await db.dispose();
});

function createSynchronizer() {
  const promises: Promise<void>[] = [];
  const queue = () => {
    let resolve: () => void;
    promises.push(
      new Promise((r) => {
        resolve = r;
      }),
    );
    return async (): Promise<void> => {
      resolve();
      await Promise.all(promises);
    };
  };
  return [queue(), queue()] as const;
}
async function transaction(
  db: Transaction,
  {from, to, wait}: {from: number; to: number; wait: () => Promise<void>},
) {
  const [{sum}] = await db.query(
    sql`SELECT SUM(value) as sum FROM mytab WHERE class = ${from};`,
  );
  await wait();
  await db.query(sql`INSERT INTO mytab (class, value) VALUES (${to}, ${sum})`);
}

async function prepare() {
  await db.query(sql`CREATE SCHEMA IF NOT EXISTS transaction_isolation_test`);
  await db.query(sql`DROP TABLE IF EXISTS mytab;`);
  await db.query(
    sql`CREATE TABLE mytab (
      id SERIAL NOT NULL PRIMARY KEY,
      class INT NOT NULL,
      value INT NOT NULL
    );`,
  );
  await db.query(sql`
    INSERT INTO mytab (class, value)
    VALUES (1, 10),
           (1, 20),
           (2, 100),
           (2, 200);
  `);
}
async function results() {
  return await db.query(sql`
    SELECT class, value FROM mytab ORDER BY value ASC, class ASC
  `);
}

test('default isolation level', async () => {
  await prepare();
  const [waitA, waitB] = createSynchronizer();
  await Promise.all([
    db.tx(async (tx) => await transaction(tx, {from: 1, to: 2, wait: waitA})),
    db.tx(async (tx) => await transaction(tx, {from: 2, to: 1, wait: waitB})),
  ]);
  await expect(results()).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "class": 1,
              "value": 10,
            },
            Object {
              "class": 1,
              "value": 20,
            },
            Object {
              "class": 2,
              "value": 30,
            },
            Object {
              "class": 2,
              "value": 100,
            },
            Object {
              "class": 2,
              "value": 200,
            },
            Object {
              "class": 1,
              "value": 300,
            },
          ]
        `);
});

test('serializable', async () => {
  await prepare();
  const [waitA, waitB] = createSynchronizer();
  await expect(
    Promise.all([
      db.tx(
        async (tx) => await transaction(tx, {from: 1, to: 2, wait: waitA}),
        {
          isolationLevel: IsolationLevel.SERIALIZABLE,
        },
      ),
      db.tx(
        async (tx) => await transaction(tx, {from: 2, to: 1, wait: waitB}),
        {
          isolationLevel: IsolationLevel.SERIALIZABLE,
        },
      ),
    ]),
  ).rejects.toMatchInlineSnapshot(
    `[error: could not serialize access due to read/write dependencies among transactions]`,
  );
});

test('serializable - with retry', async () => {
  await prepare();
  const [waitA, waitB] = createSynchronizer();
  let attempts = 0;
  await Promise.all([
    db.tx(
      async (tx) => {
        attempts++;
        await transaction(tx, {from: 1, to: 2, wait: waitA});
      },
      {
        isolationLevel: IsolationLevel.SERIALIZABLE,
        retrySerializationFailures: true,
      },
    ),
    db.tx(
      async (tx) => {
        attempts++;
        await transaction(tx, {from: 2, to: 1, wait: waitB});
      },
      {
        isolationLevel: IsolationLevel.SERIALIZABLE,
        retrySerializationFailures: true,
      },
    ),
  ]);
  expect(attempts).toBe(3);
  expect([
    [
      {
        class: 1,
        value: 10,
      },
      {
        class: 1,
        value: 20,
      },
      {
        class: 2,
        value: 30,
      },
      {
        class: 2,
        value: 100,
      },
      {
        class: 2,
        value: 200,
      },
      {
        class: 1,
        value: 330,
      },
    ],
    [
      {
        class: 1,
        value: 10,
      },
      {
        class: 1,
        value: 20,
      },
      {
        class: 2,
        value: 100,
      },
      {
        class: 2,
        value: 200,
      },
      {
        class: 1,
        value: 300,
      },
      {
        class: 2,
        value: 330,
      },
    ],
  ]).toContainEqual(await results());
});
