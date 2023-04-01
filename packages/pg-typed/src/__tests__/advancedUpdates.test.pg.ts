import connect, {sql} from '@databases/pg';
import defineTables, {currentTimestamp, greaterThan, add} from '..';

interface DatabaseSchema {
  users: {
    record: {
      id: number;
      screen_name: string;
      activity_count: number;
      is_active: boolean;
      updated_at: Date;
    };
    insert: {
      id?: number;
      screen_name: string;
      activity_count: number;
      is_active: boolean;
      updated_at: Date;
    };
  };
}
const {users} = defineTables<DatabaseSchema>({
  schemaName: 'typed_queries_advanced_updates_tests',
});

let queries: {readonly text: string; readonly values: readonly any[]}[] = [];
const db = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    queries.push({
      text: q.text.split(`"typed_queries_advanced_updates_tests".`).join(``),
      values: q.values,
    });
  },
});
function expectQueries(fn: () => Promise<void>) {
  return expect(
    (async () => {
      try {
        queries = [];
        await fn();
        return queries;
      } catch (ex) {
        console.error(queries);
        throw ex;
      }
    })(),
  ).resolves;
}

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA typed_queries_advanced_updates_tests`);
  await db.query(
    sql`
      CREATE TABLE typed_queries_advanced_updates_tests.users (
        id SERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT NOT NULL,
        activity_count INT NOT NULL,
        is_active BOOLEAN NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `,
  );
});

test('advanced updates', async () => {
  const [forbes, ellie] = await users(db).insert(
    {
      screen_name: 'Forbes',
      activity_count: 0,
      is_active: true,
      updated_at: currentTimestamp(),
    },
    {
      screen_name: 'Ellie',
      activity_count: 0,
      is_active: false,
      updated_at: currentTimestamp(),
    },
  );
  const expectUsers = () =>
    expect(users(db).find().orderByAsc(`id`).all()).resolves;

  // Simple Update
  await expectQueries(async () => {
    await users(db).update({screen_name: 'Forbes'}, {activity_count: 1});
  }).toEqual([
    {
      text: `UPDATE "users" SET "activity_count"=$1 WHERE "screen_name" = $2 RETURNING *`,
      values: [1, 'Forbes'],
    },
  ]);
  await expectUsers().toEqual([{...forbes, activity_count: 1}, ellie]);

  // Increment activity count
  await expectQueries(async () => {
    await users(db).update({screen_name: 'Forbes'}, {activity_count: add(2)});
    await users(db).update({screen_name: 'Ellie'}, {activity_count: add(1)});
  }).toEqual([
    {
      text: `UPDATE "users" SET "activity_count"="activity_count"+$1 WHERE "screen_name" = $2 RETURNING *`,
      values: [2, 'Forbes'],
    },
    {
      text: `UPDATE "users" SET "activity_count"="activity_count"+$1 WHERE "screen_name" = $2 RETURNING *`,
      values: [1, 'Ellie'],
    },
  ]);
  await expectUsers().toEqual([
    {...forbes, activity_count: 3},
    {...ellie, activity_count: 1},
  ]);

  // Negate is_active count
  await expectQueries(async () => {
    await users(db).update(
      {},
      {activity_count: add(1), is_active: sql`NOT(is_active)`},
    );
  }).toEqual([
    {
      text: `UPDATE "users" SET "activity_count"="activity_count"+$1, "is_active"=NOT(is_active) RETURNING *`,
      values: [1],
    },
  ]);
  await expectUsers().toEqual([
    {...forbes, activity_count: 4, is_active: false},
    {...ellie, activity_count: 2, is_active: true},
  ]);

  // not returning
  await expectQueries(async () => {
    await users(db).update(
      {},
      {activity_count: 0, is_active: false},
      {columnsToReturn: []},
    );
  }).toEqual([
    {
      text: `UPDATE "users" SET "activity_count"=$1, "is_active"=$2`,
      values: [0, false],
    },
  ]);
  await expectUsers().toEqual([
    {...forbes, activity_count: 0, is_active: false},
    {...ellie, activity_count: 0, is_active: false},
  ]);

  // returning specific fields
  await expectQueries(async () => {
    const results = await users(db).update(
      {},
      {activity_count: 0, is_active: false},
      {columnsToReturn: [`screen_name`]},
    );
    expect(results).toEqual([{screen_name: 'Forbes'}, {screen_name: 'Ellie'}]);
  }).toEqual([
    {
      text: `UPDATE "users" SET "activity_count"=$1, "is_active"=$2 RETURNING "screen_name"`,
      values: [0, false],
    },
  ]);
  await expectUsers().toEqual([
    {...forbes, activity_count: 0, is_active: false},
    {...ellie, activity_count: 0, is_active: false},
  ]);

  // currentTimestamp
  await expectQueries(async () => {
    await users(db).update(
      {screen_name: 'Forbes'},
      {updated_at: currentTimestamp()},
    );
  }).toEqual([
    {
      text: `UPDATE "users" SET "updated_at"=CURRENT_TIMESTAMP WHERE "screen_name" = $1 RETURNING *`,
      values: ['Forbes'],
    },
  ]);
  const updatedUsers = await users(db).find().orderByAsc(`id`).all();
  expect(updatedUsers[0].updated_at.getTime()).toBeGreaterThan(
    forbes.updated_at.getTime(),
  );

  // increment with Dates
  await expectQueries(async () => {
    await users(db).update(
      {screen_name: 'Ellie'},
      {updated_at: add(`-2 HOUR`)},
    );
    const results = await users(db)
      .find({
        updated_at: greaterThan(add(currentTimestamp(), `-1 HOUR`)),
      })
      .select(`screen_name`)
      .all();
    expect(results).toEqual([{screen_name: 'Forbes'}]);
  }).toEqual([
    {
      text: `UPDATE "users" SET "updated_at"="updated_at"+$1 WHERE "screen_name" = $2 RETURNING *`,
      values: ['-2 HOUR', 'Ellie'],
    },
    {
      text: `SELECT "screen_name" FROM "users" WHERE "updated_at" > CURRENT_TIMESTAMP+$1`,
      values: ['-1 HOUR'],
    },
  ]);
});
