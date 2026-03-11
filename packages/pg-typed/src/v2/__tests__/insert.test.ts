import {SQLQuery, sql} from '@databases/pg';
import {columns} from '../implementation/Columns';
import {q} from '..';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import createTableApi from '../implementation/Table';
import {TypedDatabaseQuery} from '../types/TypedDatabaseQuery';

interface DbUser {
  id: number;
  username: string;
  profile_image_url: string | null;
}
interface DbPost {
  author_id: number;
  title: string;
  created_at: Date;
}

const users = createTableApi<DbUser>('users', sql`users`, columns(`users`));
const posts = createTableApi<DbPost>('posts', sql`posts`, columns(`posts`));

const testFormat = {
  escapeIdentifier: escapePostgresIdentifier,
  formatValue: (value: unknown) => ({
    placeholder: '${ ' + JSON.stringify(value) + ' }',
    value: undefined,
  }),
};

test(`Basic Insert`, async () => {
  const insertNothing = users.insert();
  const mock = {query: jest.fn()};
  await insertNothing.executeQuery(mock);
  expect(mock.query).not.toBeCalled();
  expect(insertNothing.toSql()).toBe(null);
  expect(await mockResult<void>(insertNothing)).toBe(undefined);

  const insertOne = users.insert({
    id: 1,
    username: 'test',
    profile_image_url: null,
  });

  expect(
    await mockResult<void>(
      insertOne,
      `INSERT INTO users ("id","profile_image_url","username") VALUES (\${ 1 },\${ null },\${ "test" })`,
      [],
    ),
  ).toBe(undefined);

  const insertReturningStar = insertOne.returning();
  expect(
    await mockResult<DbUser | undefined>(
      insertReturningStar.one(),
      `INSERT INTO users ("id","profile_image_url","username") VALUES (\${ 1 },\${ null },\${ "test" }) RETURNING *`,
      [{id: 1, username: 'test', profile_image_url: null}],
    ),
  ).toEqual({id: 1, username: 'test', profile_image_url: null});

  const insertReturningId = insertOne.returning(`id`);
  expect(
    await mockResult<{id: number}[]>(
      insertReturningId,
      `INSERT INTO users ("id","profile_image_url","username") VALUES (\${ 1 },\${ null },\${ "test" }) RETURNING "id"`,
      [{id: 1}],
    ),
  ).toEqual([{id: 1}]);

  const insertReturningCount = insertOne.returningCount();
  expect(
    await mockResult<number>(
      insertReturningCount,
      `INSERT INTO users ("id","profile_image_url","username") VALUES (\${ 1 },\${ null },\${ "test" }) RETURNING (COUNT(*))::INT AS row_count`,
      [{row_count: 1}],
    ),
  ).toBe(1);
});

test(`Max/Min Inserted ID`, async () => {
  const insertAndSelectMaxAndMinId = users
    .insert(
      {id: 1, username: 'test1', profile_image_url: null},
      {id: 2, username: 'test2', profile_image_url: null},
      {id: 3, username: 'test3', profile_image_url: null},
    )
    .returning(`id`)
    .selectAggregate((c) => ({min_id: q.min(c.id), max_id: q.max(c.id)}));

  const expectedQueryForId = `SELECT MIN("id") AS "min_id",MAX("id") AS "max_id" FROM (INSERT INTO users ("id","profile_image_url","username") VALUES (\${ 1 },\${ null },\${ "test1" }),(\${ 2 },\${ null },\${ "test2" }),(\${ 3 },\${ null },\${ "test3" }) RETURNING "id") AS "users"`;
  expect(
    await mockResult<{max_id: number}>(
      insertAndSelectMaxAndMinId,
      expectedQueryForId,
      [{min_id: 1, max_id: 3}],
    ),
  ).toEqual({min_id: 1, max_id: 3});

  insertAndSelectMaxAndMinId.as(`i`);
  const insertAndSelectMaxAndMinRecord = users
    .as(`u`)
    .innerJoin(insertAndSelectMaxAndMinId.as(`i`))
    .on(({u, i}) => q.or(q.eq(u.id, i.min_id), q.eq(u.id, i.max_id)))
    .select(({u}) => q.star(u));

  expect(
    await mockResult<DbUser[]>(
      insertAndSelectMaxAndMinRecord,
      `SELECT "u".* FROM users AS "u" INNER JOIN (${expectedQueryForId}) AS "i" ON ("u"."id"="i"."min_id" OR "u"."id"="i"."max_id")`,
      [
        {id: 1, username: 'test1', profile_image_url: null},
        {id: 3, username: 'test3', profile_image_url: null},
      ],
    ),
  ).toEqual([
    {id: 1, username: 'test1', profile_image_url: null},
    {id: 3, username: 'test3', profile_image_url: null},
  ]);
});

test(`INNER JOIN`, async () => {
  const insertAsRightOfJoin = users
    .as(`u`)
    .innerJoin(
      posts
        .insert({author_id: 1, title: 'test', created_at: new Date(0)})
        .returning()
        .as(`p`),
    )
    .on(({u, p}) => q.eq(u.id, p.author_id))
    .select(({u, p}) => ({
      username: u.username,
      title: p.title,
    }));

  expect(
    await mockResult<
      {
        username: string;
        title: string;
      }[]
    >(
      insertAsRightOfJoin,
      `SELECT "u"."username","p"."title" FROM users AS "u" INNER JOIN (INSERT INTO posts ("author_id","created_at","title") VALUES (\${ 1 },\${ "1970-01-01T00:00:00.000Z" },\${ "test" }) RETURNING *) AS "p" ON ("u"."id"="p"."author_id")`,
      [{username: `ForbesLindesay`, title: `test`}],
    ),
  ).toEqual([{username: `ForbesLindesay`, title: `test`}]);
});

// function printQueryForTest<T>(
//   query: TypedDatabaseQuery<T> & {toSql(): SQLQuery | null},
// ) {
//   const q = query.toSql();
//   if (q === null) return null;
//   return q.format(testFormat).text;
// }
async function mockResult<T>(
  query: TypedDatabaseQuery<T>,
  expectedQuery?: string,
  results?: any[],
): Promise<T> {
  if ((expectedQuery === undefined) !== (results === undefined)) {
    throw new Error(
      `Mock results should have either an expected query and results, or neither.`,
    );
  }
  let called = false;
  const result = await query.executeQuery({
    query: async (q: SQLQuery) => {
      if (expectedQuery === undefined || results === undefined) {
        throw new Error(`Did not expect query to be called`);
      }
      called = true;
      expect(q.format(testFormat).text).toEqual(expectedQuery);
      return results;
    },
  });
  if (expectedQuery) {
    expect(called).toBe(true);
  }
  return result;
}
