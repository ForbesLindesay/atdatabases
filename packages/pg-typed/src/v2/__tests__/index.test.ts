import {sql} from '@databases/pg';
import {columns} from '../implementation/Columns';
import createQuery from '../QueryImplementation';
import {q} from '..';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {ProjectedLimitQuery} from '../types/Queries';

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

const users = createQuery<DbUser>('users', sql`users`, columns(`users`));
const posts = createQuery<DbPost>('posts', sql`posts`, columns(`posts`));

const testFormat = {
  escapeIdentifier: escapePostgresIdentifier,
  formatValue: (value: unknown) => ({
    placeholder: '${ ' + JSON.stringify(value) + ' }',
    value: undefined,
  }),
};

test(`INNER JOIN`, () => {
  const joinWithWhereBeforeJoin = users
    .as(`u`)
    .where((u) => q.eq(u.id, 10))
    .innerJoin(posts.as(`p`))
    .on(({u, p}) => q.eq(u.id, p.author_id))
    .select(({u, p}) => ({
      id: u.id,
      username: u.username,
      title: p.title,
    }));
  const joinWithWhereAfterJoin = users
    .as(`u`)
    .innerJoin(posts.as(`p`))
    .on(({u, p}) => q.eq(u.id, p.author_id))
    .where(({u}) => q.eq(u.id, 10))
    .select(({u, p}) => ({
      id: u.id,
      username: u.username,
      title: p.title,
    }));
  expect(
    printQueryForTest<{
      id: number;
      username: string;
      title: string;
    }>(joinWithWhereBeforeJoin),
  ).toEqual(
    `SELECT "u"."id","u"."username","p"."title" FROM users AS "u" INNER JOIN posts AS "p" ON ("u"."id"="p"."author_id") WHERE "u"."id"=\${ 10 }`,
  );
  expect(
    printQueryForTest<{
      id: number;
      username: string;
      title: string;
    }>(joinWithWhereAfterJoin),
  ).toEqual(
    printQueryForTest<{
      id: number;
      username: string;
      title: string;
    }>(joinWithWhereBeforeJoin),
  );
});

test(`group by`, () => {
  const groupBy = users
    .as(`u`)
    .innerJoin(posts.as(`p`))
    .on(({u, p}) => q.eq(u.id, p.author_id))
    .groupBy(({u}) => ({
      id: u.id,
      username: u.username,
    }))
    .selectAggregate(({p}) => ({
      last_posted_at: q.max(p.created_at),
      total_count: q.count(),
    }))
    .orderByDesc(`last_posted_at`);

  expect(
    printQueryForTest<{
      id: number;
      username: string;
      last_posted_at: Date;
      total_count: number;
    }>(groupBy),
  ).toEqual(
    `SELECT "u"."id","u"."username",MAX("p"."created_at") AS "last_posted_at",(COUNT(*))::INT AS "total_count" FROM users AS "u" INNER JOIN posts AS "p" ON ("u"."id"="p"."author_id") GROUP BY 1,2 ORDER BY 3 DESC`,
  );
});

test(`arbitrary SQL conditions`, () => {
  const conditions = users
    .where({id: 10})
    .where(sql`username='x' OR username='y'`)
    .where((u) =>
      q.and(q.gt(u.id, 1), q.lt(u.id, 20), sql`id % 2 = 0 OR id % 3 = 0`),
    );

  expect(printQueryForTest<DbUser>(conditions)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 10 } AND (username='x' OR username='y') AND "id">\${ 1 } AND "id"<\${ 20 } AND (id % 2 = 0 OR id % 3 = 0)`,
  );
});

test(`condition nesting`, () => {
  const or = users.where((u) => q.or(q.eq(u.id, 1), q.eq(u.id, 10)));
  const and = users.where((u) => q.and(q.gte(u.id, 1), q.lte(u.id, 10)));
  const and_or = users.where((u) =>
    q.and(
      q.or(q.eq(u.id, 1), q.eq(u.id, 10)),
      q.neq(u.profile_image_url, null),
    ),
  );
  const or_and = users.where((u) =>
    q.or(
      q.and(q.eq(u.id, 1), q.eq(u.username, 'ForbesLindesay')),
      q.eq(u.id, 10),
    ),
  );

  expect(printQueryForTest<DbUser>(or)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 1 } OR "id"=\${ 10 }`,
  );
  expect(printQueryForTest<DbUser>(and)).toEqual(
    `SELECT * FROM users WHERE "id">=\${ 1 } AND "id"<=\${ 10 }`,
  );
  expect(printQueryForTest<DbUser>(and_or)).toEqual(
    `SELECT * FROM users WHERE ("id"=\${ 1 } OR "id"=\${ 10 }) AND "profile_image_url" IS NOT NULL`,
  );
  // AND already binds more tightly than OR so no extra parentheses are needed here - although extra parentheses
  // would potentially make it easier for humans to read.
  expect(printQueryForTest<DbUser>(or_and)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 1 } AND "username"=\${ "ForbesLindesay" } OR "id"=\${ 10 }`,
  );
});

test(`condition nesting - objects`, () => {
  const or = users.where(q.or({id: 1}, {id: 10}));
  const and = users.where(q.and<DbUser>({id: q.gte(1)}, {id: q.lte(10)}));
  const and_or = users.where(
    q.and<DbUser>(q.or({id: 1}, {id: 10}), {profile_image_url: q.not(null)}),
  );
  const or_and = users.where(
    q.or(q.and<DbUser>({id: 1}, {username: 'ForbesLindesay'}), {id: 10}),
  );

  expect(printQueryForTest<DbUser>(or)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 1 } OR "id"=\${ 10 }`,
  );
  expect(printQueryForTest<DbUser>(and)).toEqual(
    `SELECT * FROM users WHERE "id">=\${ 1 } AND "id"<=\${ 10 }`,
  );
  expect(printQueryForTest<DbUser>(and_or)).toEqual(
    `SELECT * FROM users WHERE ("id"=\${ 1 } OR "id"=\${ 10 }) AND "profile_image_url" IS NOT NULL`,
  );
  // AND already binds more tightly than OR so no extra parentheses are needed here - although extra parentheses
  // would potentially make it easier for humans to read.
  expect(printQueryForTest<DbUser>(or_and)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 1 } AND "username"=\${ "ForbesLindesay" } OR "id"=\${ 10 }`,
  );
});

test(`operators - lower`, () => {
  const lowerUsernames = users.select((u) => ({
    username: q.lower(u.username),
    greeting: q.lower('HELLO WORLD'),
  }));
  expect(
    printQueryForTest<{
      username: string;
      greeting: string;
    }>(lowerUsernames),
  ).toEqual(
    `SELECT LOWER("username") AS "username",LOWER(\${ "HELLO WORLD" }) AS "greeting" FROM users`,
  );

  const lowerMaxUsername = users.selectAggregate((u) => ({
    username: q.lower(q.max(u.username)),
    greeting: q.lower('HELLO WORLD'),
  }));
  expect(
    printQueryForTest<{
      username: string;
      greeting: string;
    }>(lowerMaxUsername),
  ).toEqual(
    `SELECT LOWER(MAX("username")) AS "username",LOWER(\${ "HELLO WORLD" }) AS "greeting" FROM users`,
  );

  const maxLowerUsername = users.selectAggregate((u) => ({
    username: q.max(q.lower(u.username)),
    greeting: q.lower('HELLO WORLD'),
  }));
  expect(
    printQueryForTest<{
      username: string;
      greeting: string;
    }>(maxLowerUsername),
  ).toEqual(
    `SELECT MAX(LOWER("username")) AS "username",LOWER(\${ "HELLO WORLD" }) AS "greeting" FROM users`,
  );
});

test(`operators - json`, () => {
  interface DbRecord {
    id: number;
    data: {foo: string; bar: number};
  }
  const records = createQuery<DbRecord>(
    `records`,
    sql`records`,
    columns(`records`, [
      {columnName: 'id', type: 'INT'},
      {columnName: 'data', type: 'JSONB'},
    ]),
  );
  const query = records
    .where((r) =>
      q.or(
        q.eq(q.json(r.data).prop(`foo`).asJson(), 'hello'),
        q.eq(q.json(r.data).prop(`foo`).asString(), 'world'),
      ),
    )
    .select((r) => ({
      foo: q.json(r.data).prop(`foo`).asString(),
      bar: q.json(r.data).prop(`bar`).asJson(),
    }));
  expect(
    printQueryForTest<{
      foo: string;
      bar: number;
    }>(query),
  ).toEqual(
    `SELECT "data"#>>\${ ["foo"] } AS "foo","data"#>\${ ["bar"] } AS "bar" FROM records WHERE "data"#>\${ ["foo"] }=\${ "\\"hello\\"" } OR "data"#>>\${ ["foo"] }=\${ "world" }`,
  );

  const lowerMaxUsername = users.selectAggregate((u) => ({
    username: q.lower(q.max(u.username)),
    greeting: q.lower('HELLO WORLD'),
  }));
  expect(
    printQueryForTest<{
      username: string;
      greeting: string;
    }>(lowerMaxUsername),
  ).toEqual(
    `SELECT LOWER(MAX("username")) AS "username",LOWER(\${ "HELLO WORLD" }) AS "greeting" FROM users`,
  );

  const maxLowerUsername = users.selectAggregate((u) => ({
    username: q.max(q.lower(u.username)),
    greeting: q.lower('HELLO WORLD'),
  }));
  expect(
    printQueryForTest<{
      username: string;
      greeting: string;
    }>(maxLowerUsername),
  ).toEqual(
    `SELECT MAX(LOWER("username")) AS "username",LOWER(\${ "HELLO WORLD" }) AS "greeting" FROM users`,
  );
});
function printQueryForTest<T>(query: ProjectedLimitQuery<T>) {
  return query.toSql().format(testFormat).text;
}
