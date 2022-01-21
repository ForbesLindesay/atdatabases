import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import defineTables, {
  not,
  anyOf,
  greaterThan,
  lessThan,
  inQueryResults,
  jsonPath,
  allOf,
  or,
} from '..';

const {users, photos} = defineTables<Schema>({
  schemaName: 'typed_queries_advanced_tests',
  databaseSchema: require('./__generated__/schema.json'),
});

const db = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    console.log(q);
  },
});

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA typed_queries_advanced_tests`);
  await db.query(
    sql`
      CREATE TABLE typed_queries_advanced_tests.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
      CREATE TABLE typed_queries_advanced_tests.photos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES typed_queries_advanced_tests.users(id),
        cdn_url TEXT NOT NULL,
        caption TEXT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `,
  );
});

test('create users', async () => {
  const [forbes, ellie] = await users(db).insert(
    {screen_name: 'Forbes'},
    {screen_name: 'Ellie'},
  );
  await expect(users(db).findOne({screen_name: not('Ellie')})).resolves.toEqual(
    forbes,
  );
  await expect(
    users(db).findOne({screen_name: not('Forbes')}),
  ).resolves.toEqual(ellie);

  await expect(
    users(db)
      .find({screen_name: anyOf(['Forbes', 'Ellie'])})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([forbes, ellie]);

  await expect(
    users(db)
      .find({screen_name: anyOf(new Set(['Forbes', 'Ellie']))})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([forbes, ellie]);

  await expect(
    users(db)
      .find({screen_name: not(anyOf(['Forbes', 'Ellie']))})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([]);

  await expect(
    users(db)
      .find({screen_name: anyOf([])})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([]);

  await expect(
    users(db)
      .find({screen_name: greaterThan('Forbes')})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([]);
  await expect(
    users(db)
      .find({screen_name: lessThan('Forbes')})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([ellie]);

  await expect(
    users(db)
      .find({screen_name: greaterThan('Ellie')})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([forbes]);
  await expect(
    users(db)
      .find({screen_name: lessThan('Ellie')})
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([]);

  await expect(
    users(db)
      .find({
        screen_name: anyOf([greaterThan('Ellie'), lessThan('Forbes')]),
      })
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([forbes, ellie]);

  await expect(
    users(db)
      .find({
        screen_name: anyOf([lessThan('Ellie'), greaterThan('Forbes')]),
      })
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([]);

  await expect(
    users(db)
      .find({
        id: inQueryResults(
          sql`SELECT id FROM typed_queries_advanced_tests.users WHERE screen_name = 'Ellie'`,
        ),
      })
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([ellie]);
  await expect(
    users(db)
      .find({
        id: not(
          inQueryResults(
            sql`SELECT id FROM typed_queries_advanced_tests.users WHERE screen_name = 'Ellie'`,
          ),
        ),
      })
      .orderByDesc('screen_name')
      .all(),
  ).resolves.toEqual([forbes]);

  // Pick<User, "screen_name" | "age">[]
  const subsetOfFields = await users(db)
    .find()
    .select('screen_name', 'age')
    .orderByDesc('screen_name')
    .all();
  expect(subsetOfFields).toEqual([
    {screen_name: 'Forbes', age: null},
    {screen_name: 'Ellie', age: null},
  ]);
});

test('JSON values can be of any type', async () => {
  const [user] = await users(db).insert({screen_name: 'photo-owner'});
  const inserted = await photos(db).insert(
    {
      cdn_url: 'http://example.com/a',
      metadata: 'A " string',
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/b',
      metadata: 42,
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/c',
      metadata: true,
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/d',
      metadata: [1, 2, 3],
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/e',
      metadata: ['foo', 'bar', 'baz'],
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/f',
      metadata: {whatever: 'this is great'},
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/g',
      metadata: {whatever: 'this is great', also: {this: 'is super great'}},
      owner_user_id: user.id,
    },
  );
  expect(inserted.map((img) => [img.cdn_url, img.metadata])).toEqual([
    ['http://example.com/a', 'A " string'],
    ['http://example.com/b', 42],
    ['http://example.com/c', true],
    ['http://example.com/d', [1, 2, 3]],
    ['http://example.com/e', ['foo', 'bar', 'baz']],
    ['http://example.com/f', {whatever: 'this is great'}],
    [
      'http://example.com/g',
      {whatever: 'this is great', also: {this: 'is super great'}},
    ],
  ]);

  expect(
    await photos(db)
      .find({
        metadata: anyOf([
          jsonPath(['1'], 2),
          allOf([
            jsonPath(['whatever'], 'this is great'),
            jsonPath(['also', 'this'], 'is super great'),
          ]),
        ]),
      })
      .orderByAsc(`cdn_url`)
      .select(`cdn_url`, `metadata`)
      .all(),
  ).toEqual([
    {
      cdn_url: 'http://example.com/d',
      metadata: [1, 2, 3],
    },
    {
      cdn_url: 'http://example.com/g',
      metadata: {
        also: {this: 'is super great'},
        whatever: 'this is great',
      },
    },
  ]);

  expect(
    await photos(db)
      .find(
        or(
          {
            cdn_url: anyOf(['http://example.com/d', 'http://example.com/g']),
            metadata: jsonPath(['1'], 2),
          },
          {
            cdn_url: 'http://example.com/f',
            metadata: jsonPath(['whatever'], 'this is great'),
          },
        ),
      )
      .orderByAsc(`cdn_url`)
      .select(`cdn_url`, `metadata`)
      .all(),
  ).toEqual([
    {
      cdn_url: 'http://example.com/d',
      metadata: [1, 2, 3],
    },
    {
      cdn_url: 'http://example.com/f',
      metadata: {whatever: 'this is great'},
    },
  ]);
});
