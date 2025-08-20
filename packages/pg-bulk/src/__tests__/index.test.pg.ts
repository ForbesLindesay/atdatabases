import connect, {sql} from '@databases/pg';
import {
  bulkInsertStatement,
  bulkWhereCondition,
  bulkUpdateStatement,
  bulkDeleteStatement,
} from '..';

const SCHEMA_NAME = `bulk_utils_test`;
const TABLE_NAME = `users`;
const table = sql.ident(SCHEMA_NAME, TABLE_NAME);
const COLUMN_TYPES = {
  id: sql`BIGINT`,
  screen_name: sql`TEXT`,
  bio: sql`TEXT`,
  age: sql`INT`,
};

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
    await db.query(
      bulkInsertStatement({
        table,
        operations: names,
        columns: {
          screen_name: {getValue: (n) => n, type: COLUMN_TYPES.screen_name},
          age: {value: 42},
          bio: {getValue: (n) => `My name is ${n}`, type: COLUMN_TYPES.bio},
        },
      }),
    );
  }).toEqual([
    {
      text: `INSERT INTO "users" ("age","screen_name","bio") SELECT $1,* FROM UNNEST($2::TEXT[],$3::TEXT[])`,
      values: [42, 'Array<string>', 'Array<string>'],
    },
  ]);
  const records = await db.query(
    sql`SELECT screen_name, age FROM ${table} ORDER BY screen_name ASC`,
  );
  expect(records.map((i) => i.screen_name)).toEqual(names.sort());
  expect(records.map((i) => i.age)).toEqual(names.map(() => 42));
});

test('query users in bulk', async () => {
  await expectQueries(async () => {
    expect(
      await db.query(
        sql`SELECT screen_name, age, bio FROM ${table} WHERE ${bulkWhereCondition(
          {
            operations: [
              {screen_name: `bulk_insert_name_5`, age: 42},
              {screen_name: `bulk_insert_name_6`, age: 42},
              {screen_name: `bulk_insert_name_7`, age: 32},
            ],
            whereColumns: {
              screen_name: {
                getValue: (o) => o.screen_name,
                type: COLUMN_TYPES.screen_name,
              },
              age: {getValue: (o) => o.age, type: COLUMN_TYPES.age},
            },
          },
        )} ORDER BY screen_name ASC`,
      ),
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
      text: `SELECT screen_name, age, bio FROM "users" WHERE ("screen_name","age") IN (SELECT * FROM UNNEST($1::TEXT[],$2::INT[])) ORDER BY screen_name ASC`,
      values: ['Array<string>', 'Array<number>'],
    },
  ]);
});

test('update users in bulk', async () => {
  await expectQueries(async () => {
    await db.query(
      bulkUpdateStatement({
        table,
        operations: [
          {name: `bulk_insert_name_10`, age: 42, new_age: 1},
          {name: `bulk_insert_name_11`, age: 42, new_age: 2},
          {name: `bulk_insert_name_12`, age: 32, new_age: 3},
        ],
        whereColumns: {
          screen_name: {
            getValue: (o) => o.name,
            type: COLUMN_TYPES.screen_name,
          },
          age: {getValue: (o) => o.age, type: COLUMN_TYPES.age},
        },
        setColumns: {age: {getValue: (o) => o.new_age, type: COLUMN_TYPES.age}},
      }),
    );
  }).toEqual([
    {
      text: `UPDATE "users" SET "age" = bulk_query."set_0" FROM UNNEST($1::INT[],$2::TEXT[],$3::INT[]) AS bulk_query("set_0","where_0","where_1") WHERE "screen_name" = bulk_query."where_0" AND "age" = bulk_query."where_1"`,
      values: ['Array<number>', 'Array<string>', 'Array<number>'],
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
    await db.query(
      bulkDeleteStatement({
        table,
        operations: [
          {name: `bulk_insert_name_15`, age: 42},
          {name: `bulk_insert_name_16`, age: 42},
          {name: `bulk_insert_name_17`, age: 32},
        ],
        whereColumns: {
          screen_name: {
            getValue: (o) => o.name,
            type: COLUMN_TYPES.screen_name,
          },
          age: {getValue: (o) => o.age, type: COLUMN_TYPES.age},
        },
      }),
    );
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
