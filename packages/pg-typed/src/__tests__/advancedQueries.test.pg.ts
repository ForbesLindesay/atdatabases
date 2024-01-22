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
  caseInsensitive,
  and,
} from '..';
import User from './__generated__/users';

const {users, photos} = defineTables<Schema>({
  schemaName: 'typed_queries_advanced_tests',
  databaseSchema: require('./__generated__/schema.json'),
});

let queries: {readonly text: string; readonly values: readonly any[]}[] = [];
const db = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    queries.push({
      text: q.text.split(`"typed_queries_advanced_tests".`).join(``),
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
      metadata: {whatever: 'this is GREAT'},
      owner_user_id: user.id,
    },
    {
      cdn_url: 'http://example.com/g',
      metadata: {whatever: 'this is GREAT', also: {this: 'is super GREAT'}},
      owner_user_id: user.id,
    },
  );
  expect(inserted.map((img) => [img.cdn_url, img.metadata])).toEqual([
    ['http://example.com/a', 'A " string'],
    ['http://example.com/b', 42],
    ['http://example.com/c', true],
    ['http://example.com/d', [1, 2, 3]],
    ['http://example.com/e', ['foo', 'bar', 'baz']],
    ['http://example.com/f', {whatever: 'this is GREAT'}],
    [
      'http://example.com/g',
      {whatever: 'this is GREAT', also: {this: 'is super GREAT'}},
    ],
  ]);

  expect(
    await photos(db)
      .find({
        metadata: anyOf([
          jsonPath(['1'], 2),
          allOf([
            jsonPath(['whatever'], caseInsensitive('this is great')),
            jsonPath(['also', 'this'], caseInsensitive('is super great')),
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
        also: {this: 'is super GREAT'},
        whatever: 'this is GREAT',
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
            metadata: jsonPath(['whatever'], caseInsensitive('this is great')),
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
      metadata: {whatever: 'this is GREAT'},
    },
  ]);
});

test('sub queries', async () => {
  const expectedUser = await users(db).findOneRequired({
    screen_name: 'photo-owner',
  });

  await expectQueries(async () => {
    const usersWithPhotos = await users(db)
      .find({
        id: photos.key(`owner_user_id`, {}),
      })
      .all();
    expect(usersWithPhotos).toEqual([expectedUser]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE "id" IN (SELECT "owner_user_id" FROM "photos")`,
      values: [],
    },
  ]);

  await expectQueries(async () => {
    const noUsersWithQuery = await users(db)
      .find({
        id: photos.key(`owner_user_id`, {id: -1}),
      })
      .all();
    expect(noUsersWithQuery).toEqual([]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE "id" IN (SELECT "owner_user_id" FROM "photos" WHERE "id" = $1)`,
      values: [-1],
    },
  ]);

  await expectQueries(async () => {
    const noUsersWithoutNeedingQuery = await users(db)
      .find({
        id: photos.key(`owner_user_id`, {id: allOf([1, 2])}),
      })
      .all();
    expect(noUsersWithoutNeedingQuery).toEqual([]);
  }).toEqual([]);
});

test('case insensitive', async () => {
  const USER_NAME_A = `USERwithMIXEDcaseNAME_A`;
  const USER_NAME_B = `USERwithMIXEDcaseNAME_B`;
  const [USER_A, USER_B] = await users(db).insert(
    {screen_name: 'userWITHmixedCASEname_A', age: 1},
    {screen_name: 'userWITHmixedCASEname_B', age: 2},
  );

  expect(
    await users(db)
      .find({screen_name: anyOf([USER_NAME_A, USER_NAME_B])})
      .all(),
  ).toEqual([]);

  await expectQueries(async () => {
    expect(
      await users(db)
        .find({
          screen_name: anyOf([
            caseInsensitive(USER_NAME_A),
            caseInsensitive(USER_NAME_B),
          ]),
        })
        .all(),
    ).toEqual([USER_A, USER_B]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE LOWER(CAST("screen_name" AS TEXT)) = ANY($1)`,
      values: [['userwithmixedcasename_a', 'userwithmixedcasename_b']],
    },
  ]);

  await expectQueries(async () => {
    expect(
      await users(db)
        .find({
          screen_name: caseInsensitive(anyOf([USER_NAME_A, USER_NAME_B])),
        })
        .all(),
    ).toEqual([USER_A, USER_B]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE LOWER(CAST("screen_name" AS TEXT)) = ANY($1)`,
      values: [['userwithmixedcasename_a', 'userwithmixedcasename_b']],
    },
  ]);

  await expectQueries(async () => {
    expect(
      await users(db)
        .find({
          screen_name: anyOf([
            caseInsensitive(USER_NAME_A),
            caseInsensitive(USER_NAME_B),
          ]),
          age: allOf([not(1), not(3)]),
        })
        .all(),
    ).toEqual([USER_B]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE LOWER(CAST("screen_name" AS TEXT)) = ANY($1) AND NOT ("age" = ANY($2))`,
      values: [
        ['userwithmixedcasename_a', 'userwithmixedcasename_b'],
        [1, 3],
      ],
    },
  ]);

  await expectQueries(async () => {
    expect(
      await users(db)
        .find(
          and<User>(
            {
              screen_name: anyOf([
                caseInsensitive(USER_NAME_A),
                caseInsensitive(USER_NAME_B),
              ]),
              age: anyOf([not(1), not(2)]),
            },
            {
              age: anyOf([not(greaterThan(5)), not(lessThan(10))]),
            },
          ),
        )
        .all(),
    ).toEqual([USER_A, USER_B]);
  }).toEqual([
    {
      text: `SELECT * FROM "users" WHERE LOWER(CAST("screen_name" AS TEXT)) = ANY($1) AND NOT (("age" > $2 AND "age" < $3))`,
      values: [['userwithmixedcasename_a', 'userwithmixedcasename_b'], 5, 10],
    },
  ]);
});
