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

const db = connect({bigIntMode: 'number'});

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
  await bulkInsert({
    ...options,
    columnsToInsert: [`screen_name`, `age`, `bio`],
    records: names.map((n) => ({
      screen_name: n,
      age: 42,
      bio: `My name is ${n}`,
    })),
  });
  const records = await db.query(
    sql`SELECT screen_name, age FROM ${table} ORDER BY screen_name ASC`,
  );
  expect(records.map((i) => i.screen_name)).toEqual(names.sort());
  expect(records.map((i) => i.age)).toEqual(names.map(() => 42));
});

test('query users in bulk', async () => {
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
});

test('update users in bulk', async () => {
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
  await bulkDelete({
    ...options,
    whereColumnNames: [`screen_name`, `age`],
    whereConditions: [
      {screen_name: `bulk_insert_name_15`, age: 42},
      {screen_name: `bulk_insert_name_16`, age: 42},
      {screen_name: `bulk_insert_name_17`, age: 32},
    ],
  });
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
