import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import tables, {not, anyOf, greaterThan, lessThan, inQueryResults} from '..';

const {users} = tables<Schema>({
  schemaName: 'typed_queries_advanced_tests',
});

const db = connect({bigIntMode: 'number'});

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
        age INT
      );
      CREATE TABLE typed_queries_advanced_tests.photos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES typed_queries_advanced_tests.users(id),
        cdn_url TEXT NOT NULL,
        caption TEXT NULL,
        metadata JSONB NOT NULL
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
});
