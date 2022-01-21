import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import defineTables from '..';

const {users} = defineTables<Schema>({schemaName: 'typed_queries_count'});

const dbNumber = connect({bigIntMode: 'number'});
const dbString = connect({bigIntMode: 'string'});
const dbBigInt = connect({bigIntMode: 'bigint'});

afterAll(async () => {
  await Promise.all([
    dbNumber.dispose(),
    dbString.dispose(),
    dbBigInt.dispose(),
  ]);
});

test('create schema', async () => {
  await dbNumber.query(sql`CREATE SCHEMA typed_queries_count`);
  await dbNumber.query(
    sql`
      CREATE TABLE typed_queries_count.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `,
  );
});

test('count users', async () => {
  await users(dbNumber).insert({screen_name: 'Forbes'}, {screen_name: 'Ellie'});
  expect(await users(dbNumber).count()).toBe(2);
  expect(await users(dbString).count()).toBe(2);
  expect(await users(dbBigInt).count()).toBe(2);
  expect(await users(dbNumber).count({screen_name: 'Forbes'})).toBe(1);
  expect(await users(dbString).count({screen_name: 'Forbes'})).toBe(1);
  expect(await users(dbBigInt).count({screen_name: 'Forbes'})).toBe(1);
});
