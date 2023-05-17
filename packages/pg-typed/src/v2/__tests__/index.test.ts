import {SQLQuery, sql} from '@databases/pg';
import {columns} from '../implementation/Columns';
import createQuery from '../QueryImplementation';
import {q} from '..';
import {escapePostgresIdentifier} from '@databases/escape-identifier';

interface DbUser {
  id: number;
  username: string;
}
interface DbPost {
  author_id: number;
  title: string;
  created_at: Date;
}

const users = createQuery<DbUser>('users', sql`users`, columns(`users`));
const posts = createQuery<DbPost>('posts', sql`posts`, columns(`posts`));

test(`q`, () => {
  const join = users
    .as(`u`)
    .where((u) => q.eq(u.id, 10))
    .innerJoin(posts.as(`p`))
    .on(({u, p}) => q.eq(u.id, p.author_id))
    // .where(({u}) => q.eq(u.id, 10))
    .select(({u, p}) => ({
      id: u.id,
      username: u.username,
      title: p.title,
    }));
  expect(printQueryForTest(join)).toEqual(
    `SELECT "u"."id","u"."username","p"."title" FROM users AS "u" INNER JOIN posts AS "p" ON ("u"."id"="p"."author_id") WHERE "u"."id"=\${ 10 }`,
  );

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

  expect(printQueryForTest(groupBy)).toEqual(
    `SELECT "u"."id","u"."username",MAX("p"."created_at") AS "last_posted_at",COUNT(*) AS "total_count" FROM users AS "u" INNER JOIN posts AS "p" ON ("u"."id"="p"."author_id") GROUP BY 1,2 ORDER BY 3 DESC`,
  );

  const conditions = users
    .where({id: 10})
    .where(sql`username='x' OR username='y'`)
    .where((u) =>
      q.and(q.gt(u.id, 1), q.lt(u.id, 20), sql`id % 2 = 0 OR id % 3 = 0`),
    );

  expect(printQueryForTest(conditions)).toEqual(
    `SELECT * FROM users WHERE "id"=\${ 10 } AND (username='x' OR username='y') AND "id">\${ 1 } AND "id"<\${ 20 } AND (id % 2 = 0 OR id % 3 = 0)`,
  );
});

function printQueryForTest(query: {toSql(): SQLQuery}) {
  return query.toSql().format({
    escapeIdentifier: escapePostgresIdentifier,
    formatValue: (value: unknown) => ({
      placeholder: '${ ' + JSON.stringify(value) + ' }',
      value: undefined,
    }),
  }).text;
}
