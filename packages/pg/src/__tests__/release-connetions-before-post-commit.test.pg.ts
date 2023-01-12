import connect, {sql} from '..';

jest.setTimeout(10_000);

const db = connect({
  bigIntMode: 'bigint',
  poolSize: 1,
});

afterAll(async () => {
  await db.dispose();
});

test('transaction in task', async () => {
  await db.task(async (db) => {
    const taskDb = db;
    await db.tx(async (db) => {
      await db.query(sql`SELECT 1 + 1`);
      await db.addPostCommitStep(async () => {
        // This code runs after the transaction completes
        await taskDb.query(sql`SELECT 1 + 1`);
      });
    });
  });
});

test('tx in pool', async () => {
  const poolDb = db;
  await db.tx(async (db) => {
    await db.query(sql`SELECT 1 + 1`);
    await db.addPostCommitStep(async () => {
      // This code runs after the transaction completes
      await poolDb.query(sql`SELECT 1 + 1`);
    });
  });
});
