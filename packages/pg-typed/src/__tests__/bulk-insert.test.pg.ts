import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import defineTables, {add, anyOf} from '..';

const {users} = defineTables<Schema>({
  schemaName: 'typed_queries_bulk_insert',
  databaseSchema: require('./__generated__/schema.json'),
});

let queries: {readonly text: string; readonly values: readonly any[]}[] = [];

const db = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    queries.push({
      text: q.text.split(`"typed_queries_bulk_insert".`).join(``),
      values: q.values.map((v) =>
        Array.isArray(v)
          ? `Array<${[...new Set(v.map((v) => typeof v))].join(` | `)}, ${
              v.length
            }>`
          : v,
      ),
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
  await db.query(sql`CREATE SCHEMA typed_queries_bulk_insert`);
  await db.query(
    sql`
      CREATE TABLE typed_queries_bulk_insert.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT DEFAULT 42,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `,
  );
});

test('create multiple users per statement using non-bulk API', async () => {
  const [forbes, ellie, john] = await users(db).insert(
    {screen_name: 'Forbes'},
    {screen_name: 'Ellie', age: 10},
    {screen_name: 'John', bio: 'Hello world'},
  );
  expect([forbes, ellie, john]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 42,
        "bio": null,
        "created_at": null,
        "id": 1,
        "screen_name": "Forbes",
        "updated_at": null,
      },
      Object {
        "age": 10,
        "bio": null,
        "created_at": null,
        "id": 2,
        "screen_name": "Ellie",
        "updated_at": null,
      },
      Object {
        "age": 42,
        "bio": "Hello world",
        "created_at": null,
        "id": 3,
        "screen_name": "John",
        "updated_at": null,
      },
    ]
  `);
  const [forbes2, martin, ellie2, john2] = await users(db).insertOrIgnore(
    {screen_name: 'Forbes'},
    {screen_name: 'Martin'},
    {screen_name: 'Ellie', age: 10},
    {screen_name: 'John', bio: 'Hello world'},
  );
  expect([forbes2, martin, ellie2, john2]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 42,
        "bio": null,
        "created_at": null,
        "id": 5,
        "screen_name": "Martin",
        "updated_at": null,
      },
      undefined,
      undefined,
      undefined,
    ]
  `);
  const [forbes3, martin2, ellie3, john3] = await users(db).insertOrUpdate(
    ['screen_name'],
    {screen_name: 'Forbes', age: 20},
    {screen_name: 'Martin'},
    {screen_name: 'Ellie', age: 5},
    {screen_name: 'John', bio: 'Whatever world'},
  );
  expect([forbes3, martin2, ellie3, john3]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 20,
        "bio": null,
        "created_at": null,
        "id": 1,
        "screen_name": "Forbes",
        "updated_at": null,
      },
      Object {
        "age": 42,
        "bio": null,
        "created_at": null,
        "id": 5,
        "screen_name": "Martin",
        "updated_at": null,
      },
      Object {
        "age": 5,
        "bio": null,
        "created_at": null,
        "id": 2,
        "screen_name": "Ellie",
        "updated_at": null,
      },
      Object {
        "age": 42,
        "bio": "Whatever world",
        "created_at": null,
        "id": 3,
        "screen_name": "John",
        "updated_at": null,
      },
    ]
  `);
});

test('create users in bulk', async () => {
  const names: string[] = [];
  for (let i = 0; i < 50_000; i++) {
    names.push(`bulk_insert_name_${i}`);
  }

  await expectQueries(async () => {
    const inserted = await users(db).bulkInsert({
      columnsToInsert: [`age`],
      sharedColumnsToInsert: {age: 42},
      records: names.map((n) => ({screen_name: n})),
    });

    expect(inserted.map((i) => i.screen_name)).toEqual(names);
    expect(inserted.map((i) => i.age)).toEqual(names.map(() => 42));
  }).toEqual([
    {
      text: `INSERT INTO "users" ("age","screen_name") SELECT $1 AS "age", * FROM UNNEST($2::TEXT[]) RETURNING "users".*`,
      values: [42, `Array<string, 50000>`],
    },
  ]);

  const records = await users(db)
    .find({screen_name: anyOf(names)})
    .orderByAsc(`screen_name`)
    .all();
  expect(records.map((i) => i.screen_name)).toEqual(names.sort());
  expect(records.map((i) => i.age)).toEqual(names.map(() => 42));
});

test('query users in bulk', async () => {
  expect(
    await users(db)
      .bulkFind({
        whereColumnNames: [`screen_name`, `age`],
        whereConditions: [
          {screen_name: `bulk_insert_name_5`, age: 42},
          {screen_name: `bulk_insert_name_6`, age: 42},
          {screen_name: `bulk_insert_name_7`, age: 32},
        ],
      })
      .select(`screen_name`, `age`, `bio`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_5`, age: 42, bio: null},
    {screen_name: `bulk_insert_name_6`, age: 42, bio: null},
  ]);

  expect(
    await users(db)
      .bulkFind({
        whereColumnNames: [`screen_name`, `age`],
        whereConditions: [
          {screen_name: `bulk_insert_name_3`, age: 42},
          {screen_name: `bulk_insert_name_4`, age: 42},
          {screen_name: `bulk_insert_name_5`, age: 42},
          {screen_name: `bulk_insert_name_6`, age: 42},
          {screen_name: `bulk_insert_name_7`, age: 32},
        ],
      })
      .andWhere({
        screen_name: anyOf([`bulk_insert_name_3`, `bulk_insert_name_5`]),
      })
      .select(`screen_name`, `age`, `bio`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_3`, age: 42, bio: null},
    {screen_name: `bulk_insert_name_5`, age: 42, bio: null},
  ]);
});

test('update users in bulk', async () => {
  const updated = await users(db).bulkUpdate({
    whereColumnNames: [`screen_name`, `age`],
    setColumnNames: [`age`],
    updates: [
      {where: {screen_name: `bulk_insert_name_10`, age: 42}, set: {age: 1}},
      {where: {screen_name: `bulk_insert_name_11`, age: 42}, set: {age: 2}},
      {where: {screen_name: `bulk_insert_name_12`, age: 32}, set: {age: 3}},
    ],
  });
  expect(updated.map(({screen_name, age}) => ({screen_name, age}))).toEqual([
    {screen_name: `bulk_insert_name_10`, age: 1},
    {screen_name: `bulk_insert_name_11`, age: 2},
  ]);
  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_10`,
          `bulk_insert_name_11`,
          `bulk_insert_name_12`,
        ]),
      })
      .select(`screen_name`, `age`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_10`, age: 1},
    {screen_name: `bulk_insert_name_11`, age: 2},
    {screen_name: `bulk_insert_name_12`, age: 42},
  ]);
});

test('delete users in bulk', async () => {
  await users(db).bulkDelete({
    whereColumnNames: [`screen_name`, `age`],
    whereConditions: [
      {screen_name: `bulk_insert_name_15`, age: 42},
      {screen_name: `bulk_insert_name_16`, age: 42},
      {screen_name: `bulk_insert_name_17`, age: 32},
    ],
  });
  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_15`,
          `bulk_insert_name_16`,
          `bulk_insert_name_17`,
        ]),
      })
      .select(`screen_name`, `age`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([{screen_name: `bulk_insert_name_17`, age: 42}]);
});

test('insertOrIgnore users in bulk', async () => {
  await users(db).bulkInsertOrIgnore({
    columnsToInsert: [`age`],
    records: [
      {screen_name: `bulk_insert_name_18`, age: 56},
      {screen_name: `bulk_insert_name_19`, age: 56},
      {screen_name: `bulk_insert_name_20`, age: 56},
      {screen_name: `bulk_insert_or_ignore_name_1`, age: 56},
    ],
  });
  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_18`,
          `bulk_insert_name_19`,
          `bulk_insert_name_20`,
          `bulk_insert_or_ignore_name_1`,
        ]),
      })
      .select(`screen_name`, `age`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_18`, age: 42},
    {screen_name: `bulk_insert_name_19`, age: 42},
    {screen_name: `bulk_insert_name_20`, age: 42},
    {screen_name: `bulk_insert_or_ignore_name_1`, age: 56},
  ]);

  await users(db).bulkInsertOrIgnore({
    columnsToInsert: [`age`],
    sharedColumnsToInsert: {age: 56},
    records: [
      {screen_name: `bulk_insert_name_18`},
      {screen_name: `bulk_insert_name_19`},
      {screen_name: `bulk_insert_name_20`},
      {screen_name: `bulk_insert_or_ignore_name_2`},
    ],
  });
  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_18`,
          `bulk_insert_name_19`,
          `bulk_insert_name_20`,
          `bulk_insert_or_ignore_name_1`,
          `bulk_insert_or_ignore_name_2`,
        ]),
      })
      .select(`screen_name`, `age`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_18`, age: 42},
    {screen_name: `bulk_insert_name_19`, age: 42},
    {screen_name: `bulk_insert_name_20`, age: 42},
    {screen_name: `bulk_insert_or_ignore_name_1`, age: 56},
    {screen_name: `bulk_insert_or_ignore_name_2`, age: 56},
  ]);
});

test('insertOrUpdate users in bulk', async () => {
  await expectQueries(async () => {
    await users(db).bulkInsertOrUpdate({
      columnsToInsert: [`screen_name`, `age`, `bio`],
      columnsThatConflict: [`screen_name`],
      columnsToUpdate: [`bio`],
      sharedColumnsToInsert: {bio: `Updated in bulk`},
      records: [
        {screen_name: `bulk_insert_name_21`, age: 1},
        {screen_name: `bulk_insert_name_22`, age: 2},
        {screen_name: `bulk_insert_name_23`, age: 3},
        {screen_name: `bulk_insert_or_update_name_1`, age: 4},
      ],
    });
  }).toEqual([
    {
      text: `INSERT INTO "users" ("bio","age","screen_name") SELECT $1 AS "bio", * FROM UNNEST($2::INTEGER[],$3::TEXT[]) ON CONFLICT ("screen_name") DO UPDATE SET "bio"=EXCLUDED."bio" RETURNING "users".*`,
      values: [`Updated in bulk`, `Array<number, 4>`, `Array<string, 4>`],
    },
  ]);

  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_21`,
          `bulk_insert_name_22`,
          `bulk_insert_name_23`,
          `bulk_insert_or_update_name_1`,
        ]),
      })
      .select(`screen_name`, `age`, `bio`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_21`, age: 42, bio: `Updated in bulk`},
    {screen_name: `bulk_insert_name_22`, age: 42, bio: `Updated in bulk`},
    {screen_name: `bulk_insert_name_23`, age: 42, bio: `Updated in bulk`},
    {
      screen_name: `bulk_insert_or_update_name_1`,
      age: 4,
      bio: `Updated in bulk`,
    },
  ]);

  await expectQueries(async () => {
    await users(db).bulkInsertOrUpdate({
      columnsToInsert: [`screen_name`, `age`],
      columnsThatConflict: [`screen_name`],
      columnsToUpdate: [`age`],
      sharedColumnsToInsert: {age: 0},
      sharedColumnsToUpdate: {age: add(1)},
      records: [
        {screen_name: `bulk_insert_name_21`},
        {screen_name: `bulk_insert_name_22`},
        {screen_name: `bulk_insert_name_23`},
        {screen_name: `bulk_insert_or_update_name_1`},
      ],
    });
  }).toEqual([
    {
      text: `INSERT INTO "users" ("age","screen_name") SELECT $1 AS "age", * FROM UNNEST($2::TEXT[]) ON CONFLICT ("screen_name") DO UPDATE SET "age"="users"."age"+$3 RETURNING "users".*`,
      values: [0, `Array<string, 4>`, 1],
    },
  ]);
  expect(
    await users(db)
      .find({
        screen_name: anyOf([
          `bulk_insert_name_21`,
          `bulk_insert_name_22`,
          `bulk_insert_name_23`,
          `bulk_insert_or_update_name_1`,
        ]),
      })
      .select(`screen_name`, `age`, `bio`)
      .orderByAsc(`screen_name`)
      .all(),
  ).toEqual([
    {screen_name: `bulk_insert_name_21`, age: 43, bio: `Updated in bulk`},
    {screen_name: `bulk_insert_name_22`, age: 43, bio: `Updated in bulk`},
    {screen_name: `bulk_insert_name_23`, age: 43, bio: `Updated in bulk`},
    {
      screen_name: `bulk_insert_or_update_name_1`,
      age: 5,
      bio: `Updated in bulk`,
    },
  ]);
});
