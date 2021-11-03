import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import tables from '..';

const {users} = tables<Schema>({schemaName: 'typed_queries_connections'});

const primary = connect({bigIntMode: 'number'});
const secondary = connect({bigIntMode: 'number'});

const User = users([primary, secondary]);

afterAll(async () => {
  await primary.dispose();
  await secondary.dispose();
});

test('create schema', async () => {
  await primary.query(sql`CREATE SCHEMA typed_queries_connections`);
  await primary.query(
    sql`
      CREATE TABLE typed_queries_connections.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT
      );
    `,
  );
});

test('create and find users', async () => {
  const [forbes, ellie] = await User.insert(
    {screen_name: 'Forbes'},
    {screen_name: 'Ellie'},
  );

  const [forbes2, john] = await User.insertOrUpdate(
    ['screen_name'],
    {screen_name: 'Forbes', bio: 'Author of @databases'},
    {screen_name: 'John', bio: 'Just a random name'},
  );
  expect(forbes2.id).toBe(forbes.id);
  expect([forbes2.bio, john.bio]).toMatchInlineSnapshot(`
    Array [
      "Author of @databases",
      "Just a random name",
    ]
  `);

  const insertOrIgnoreResults = await User.insertOrIgnore(
    {screen_name: 'John', bio: 'Updated bio'},
    {screen_name: 'Martin', bio: 'Updated bio'},
  );
  expect(insertOrIgnoreResults.length).toBe(1);
  const [martin] = insertOrIgnoreResults;
  expect(martin.screen_name).toBe('Martin');
  expect(martin.bio).toBe('Updated bio');

  // We're closing the primary connection pool to verify that read queries are run from the second connection
  await primary.dispose();

  expect(await User.findOne({id: ellie.id})).toEqual(ellie);

  expect(
    (await User.find().orderByAsc('screen_name').first())?.screen_name,
  ).toMatchInlineSnapshot(`"Ellie"`);
});
