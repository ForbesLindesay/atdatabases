import connect, {sql} from '@databases/mysql';
import declareTables from '..';

// JSON added in 5.7
const SUPPORTS_JSON_TYPE = !process.env.MYSQL_TEST_IMAGE?.includes(`:5.6`);

interface Photo {
  caption: string | null;
  cdn_url: string & {__brand?: 'url'};
  id: number & {readonly __brand?: 'photos_id'};
  metadata: unknown;
  owner_user_id: User['id'];
}
interface PhotosInsertParameters {
  caption?: string | null;
  cdn_url: string & {__brand?: 'url'};
  id?: number & {readonly __brand?: 'photos_id'};
  metadata: unknown;
  owner_user_id: User['id'];
}

interface User {
  age: number | null;
  bio: string | null;
  id: number & {readonly __brand?: 'users_id'};
  screen_name: string;
}
interface UsersInsertParameters {
  age?: number | null;
  bio?: string | null;
  id?: number & {readonly __brand?: 'users_id'};
  screen_name: string;
}

interface DatabaseSchema {
  typed_queries_tests_photos: {record: Photo; insert: PhotosInsertParameters};
  typed_queries_tests_users: {record: User; insert: UsersInsertParameters};
}
const tables = declareTables<DatabaseSchema>({
  serializeValue(tableName, columnName, value) {
    if (
      tableName === `typed_queries_tests_photos` &&
      columnName === `metadata`
    ) {
      return JSON.stringify(value);
    }
    return value;
  },
});
const users = tables.typed_queries_tests_users;
const photos = tables.typed_queries_tests_photos;

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});

let t = test;

if (!SUPPORTS_JSON_TYPE) t = test.skip;
t('create schema', async () => {
  await db.query(
    sql`
      CREATE TABLE typed_queries_tests_users (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        screen_name TEXT(512) NOT NULL,
        bio TEXT(512),
        age INT
      );
      CREATE TABLE typed_queries_tests_photos (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES typed_queries_tests.users(id),
        cdn_url TEXT(512) NOT NULL,
        caption TEXT(512) NULL,
        metadata JSON NOT NULL
      );
    `,
  );
});

t('create users', async () => {
  await users(db).insert({screen_name: 'Forbes'}, {screen_name: 'Ellie'});
  await photos(db).insert(
    {
      cdn_url: 'http://example.com/1',
      metadata: {},
      owner_user_id: 1,
    },
    {
      cdn_url: 'http://example.com/2',
      metadata: {},
      owner_user_id: 1,
    },
    {
      cdn_url: 'http://example.com/3',
      metadata: {},
      owner_user_id: 1,
    },
    {
      cdn_url: 'http://example.com/4',
      metadata: {},
      owner_user_id: 2,
      caption: null,
    },
  );
  const photoRecords = await photos(db)
    .find({owner_user_id: 1})
    .orderByAsc('cdn_url')
    .limit(2);
  expect(photoRecords.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/1",
      "http://example.com/2",
    ]
  `);

  const photoRecordsOffset = await photos(db)
    .find({owner_user_id: 1})
    .orderByAsc('cdn_url')
    .offset(1)
    .limit(2);
  expect(photoRecords.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/2",
      "http://example.com/3",
    ]
  `);

  const photoRecordsDesc = await photos(db)
    .find({owner_user_id: 1})
    .orderByDesc('cdn_url')
    .limit(2);
  expect(photoRecordsDesc.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/3",
      "http://example.com/2",
    ]
  `);
  expect(await users(db).findOne({id: 2})).toEqual({
    id: 2,
    screen_name: 'Ellie',
    age: null,
    bio: null,
  });

  await photos(db).update(
    {cdn_url: 'http://example.com/1'},
    {
      metadata: {rating: 5},
    },
  );

  await photos(db).delete({cdn_url: 'http://example.com/2'});

  expect(
    (await photos(db).find().orderByAsc('cdn_url').all()).map((u) => u.cdn_url),
  ).toMatchInlineSnapshot(`
    Array [
      "http://example.com/1",
      "http://example.com/3",
      "http://example.com/4",
    ]
  `);

  expect(
    (await users(db).find().orderByAsc('screen_name').first())?.screen_name,
  ).toMatchInlineSnapshot(`"Ellie"`);
  expect(
    (await users(db).find().orderByDesc('screen_name').first())?.screen_name,
  ).toMatchInlineSnapshot(`"Forbes"`);

  expect(
    (await users(db).find().orderByAsc('screen_name').all()).map((u) => [
      u.screen_name,
      u.bio,
    ]),
  ).toMatchInlineSnapshot(`
    Array [
      Array [
        "Ellie",
        null,
      ],
      Array [
        "Forbes",
        null,
      ],
    ]
  `);

  await photos(db).update(
    {cdn_url: 'http://example.com/3'},
    {caption: 'Hello World'},
  );
  expect(await photos(db).find({caption: null}).orderByAsc('id').all()).toEqual(
    (await photos(db).find().orderByAsc('id').all()).filter(
      (p) => p.caption === null,
    ),
  );
  expect(
    (await photos(db).find({caption: null}).orderByAsc('id').all()).map(
      (p) => ({
        caption: p.caption,
        cdn_url: p.cdn_url,
      }),
    ),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "caption": null,
        "cdn_url": "http://example.com/1",
      },
      Object {
        "caption": null,
        "cdn_url": "http://example.com/4",
      },
    ]
  `);
});
