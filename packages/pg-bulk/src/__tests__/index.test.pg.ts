import connect, {sql} from '@databases/pg';
import {
  bulkInsert,
  bulkSelect,
  bulkUpdate,
  bulkDelete,
  BulkOperationOptions,
} from '..';

const SCHEMA_NAME = `bulk_utils_test`;
const TABLE_NAME = `users`;
const table = sql.ident(SCHEMA_NAME, TABLE_NAME);

let queries: {readonly text: string; readonly values: readonly any[]}[] = [];
const db = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    queries.push({
      text: q.text.split(`"bulk_utils_test".`).join(``),
      values: q.values.map((v) =>
        Array.isArray(v) ? `Array<${typeof v[0]}>` : v,
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

const options: BulkOperationOptions<'id' | 'screen_name' | 'bio' | 'age'> = {
  database: db,
  schemaName: SCHEMA_NAME,
  tableName: TABLE_NAME,
  columnTypes: {
    id: sql`BIGINT`,
    screen_name: sql`TEXT`,
    bio: sql`TEXT`,
    age: sql`INT`,
  },
};

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA ${sql.ident(SCHEMA_NAME)}`);
  await db.query(
    sql`
      CREATE TABLE ${table} (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT DEFAULT 42
      );
    `,
  );
});

test(`normal hand-coded insert fails for sufficiently many records`, async () => {
  try {
    const names: string[] = [];
    for (let i = 0; i < 30_000; i++) {
      names.push(`bulk_insert_name_${i}`);
    }
    await db.query(
      sql`INSERT INTO ${table} (screen_name, age, bio) VALUES ${sql.join(
        names.map((n) => sql`(${n}, ${42}, ${`My name is ${n}`})`),
        `,`,
      )}`,
    );
  } catch (ex: any) {
    expect(ex.message).toMatch(
      /bind message has \d+ parameter formats but \d+ parameters/,
    );
    return;
  }
  throw new Error(`Expected insert to fail due to having 90,000 parameters.`);
});
test('create users in bulk', async () => {
  const names: string[] = [];
  for (let i = 0; i < 50_000; i++) {
    names.push(`bulk_insert_name_${i}`);
  }
  await expectQueries(async () => {
    await bulkInsert({
      ...options,
      columnsToInsert: [`screen_name`, `age`, `bio`],
      records: names.map((n) => ({
        screen_name: n,
        age: 42,
        bio: `My name is ${n}`,
      })),
    });
  }).toEqual([
    {
      text: `INSERT INTO "users" ("screen_name","age","bio") SELECT * FROM UNNEST($1::TEXT[],$2::INT[],$3::TEXT[])`,
      values: ['Array<string>', 'Array<number>', 'Array<string>'],
    },
  ]);
  const records = await db.query<{screen_name: string; age: number}>(
    sql`SELECT screen_name, age FROM ${table} ORDER BY screen_name ASC`,
  );
  expect(records.map((i) => i.screen_name)).toEqual(names.sort());
  expect(records.map((i) => i.age)).toEqual(names.map(() => 42));
});

test('query users in bulk', async () => {
  await expectQueries(async () => {
    expect(
      await bulkSelect({
        ...options,
        whereColumnNames: [`screen_name`, `age`],
        whereConditions: [
          {screen_name: `bulk_insert_name_5`, age: 42},
          {screen_name: `bulk_insert_name_6`, age: 42},
          {screen_name: `bulk_insert_name_7`, age: 32},
        ],
        selectColumnNames: [`screen_name`, `age`, `bio`],
        orderBy: [{columnName: `screen_name`, direction: `ASC`}],
      }),
    ).toEqual([
      {
        screen_name: `bulk_insert_name_5`,
        age: 42,
        bio: `My name is bulk_insert_name_5`,
      },
      {
        screen_name: `bulk_insert_name_6`,
        age: 42,
        bio: `My name is bulk_insert_name_6`,
      },
    ]);
  }).toEqual([
    {
      text: `SELECT "screen_name","age","bio" FROM "users" WHERE ("screen_name","age") IN (SELECT * FROM UNNEST($1::TEXT[],$2::INT[])) ORDER BY "screen_name" ASC`,
      values: ['Array<string>', 'Array<number>'],
    },
  ]);
});

test('update users in bulk', async () => {
  await expectQueries(async () => {
    await bulkUpdate({
      ...options,
      whereColumnNames: [`screen_name`, `age`],
      setColumnNames: [`age`],
      updates: [
        {where: {screen_name: `bulk_insert_name_10`, age: 42}, set: {age: 1}},
        {where: {screen_name: `bulk_insert_name_11`, age: 42}, set: {age: 2}},
        {where: {screen_name: `bulk_insert_name_12`, age: 32}, set: {age: 3}},
      ],
    });
  }).toEqual([
    {
      text: `UPDATE "users" SET "age" = "bulk_query"."updated_value_of_age" FROM (SELECT * FROM UNNEST($1::TEXT[],$2::INT[],$3::INT[]) AS bulk_query("screen_name","age","updated_value_of_age")) AS bulk_query WHERE "users"."screen_name" = "bulk_query"."screen_name" AND "users"."age" = "bulk_query"."age"`,
      values: ['Array<string>', 'Array<number>', 'Array<number>'],
    },
  ]);
  expect(
    await db.query(
      sql`SELECT screen_name, age FROM ${table} WHERE screen_name=ANY(${[
        `bulk_insert_name_10`,
        `bulk_insert_name_11`,
        `bulk_insert_name_12`,
      ]}) ORDER BY screen_name ASC`,
    ),
  ).toEqual([
    {screen_name: `bulk_insert_name_10`, age: 1},
    {screen_name: `bulk_insert_name_11`, age: 2},
    {screen_name: `bulk_insert_name_12`, age: 42},
  ]);
});

test('delete users in bulk', async () => {
  await expectQueries(async () => {
    await bulkDelete({
      ...options,
      whereColumnNames: [`screen_name`, `age`],
      whereConditions: [
        {screen_name: `bulk_insert_name_15`, age: 42},
        {screen_name: `bulk_insert_name_16`, age: 42},
        {screen_name: `bulk_insert_name_17`, age: 32},
      ],
    });
  }).toEqual([
    {
      text: `DELETE FROM "users" WHERE ("screen_name","age") IN (SELECT * FROM UNNEST($1::TEXT[],$2::INT[]))`,
      values: ['Array<string>', 'Array<number>'],
    },
  ]);
  expect(
    await db.query(
      sql`SELECT screen_name, age FROM ${table} WHERE screen_name=ANY(${[
        `bulk_insert_name_15`,
        `bulk_insert_name_16`,
        `bulk_insert_name_17`,
      ]}) ORDER BY screen_name ASC`,
    ),
  ).toEqual([{screen_name: `bulk_insert_name_17`, age: 42}]);
});
