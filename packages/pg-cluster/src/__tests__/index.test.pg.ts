import connect, {sql} from '@databases/pg';
import createCluster from '..';

const SCHEMA_NAME = 'cluster_test';
const TABLE_NAME = 'users';
const table = sql.ident(SCHEMA_NAME, TABLE_NAME);
const USERS = [
  {screen_name: 'John', age: 30},
  {screen_name: 'Jane', age: 29},
];

interface TestQuery {
  text: string;
  values: any[];
}

let primaryQueries: TestQuery[] = [];
let replicaQueries: TestQuery[] = [];

const primary = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    primaryQueries.push({
      text: q.text.split(`"${SCHEMA_NAME}".`).join(``),
      values: q.values.map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
    });
  },
});
const replica = connect({
  bigIntMode: 'number',
  onQueryStart(_q, q) {
    replicaQueries.push({
      text: q.text.split(`"${SCHEMA_NAME}".`).join(``),
      values: q.values.map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
    });
  },
});
const cluster = createCluster(primary, [replica]);

beforeEach(() => {
  primaryQueries = [];
  replicaQueries = [];
});

afterAll(async () => {
  await primary.dispose();
  await replica.dispose();
});

test('CREATE queries sent to primary', async () => {
  await cluster.query(sql`CREATE SCHEMA ${sql.ident(SCHEMA_NAME)}`);
  await cluster.query(
    sql`
      CREATE TABLE ${table} (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT NOT NULL,
        age INT DEFAULT 42
      );
    `,
  );
});

test('INSERT queries sent to primary', async () => {
  await cluster.query(
    sql`INSERT INTO ${table} (screen_name, age) VALUES ${sql.join(
      USERS.map((user) => sql`(${user.screen_name}, ${user.age})`),
      `,`,
    )}`,
  );
  await cluster.query(
    USERS.map(
      (user) =>
        sql`INSERT INTO ${table} (screen_name, age) VALUES (${user.screen_name}, ${user.age})`,
    ),
  );

  expect(primaryQueries).toHaveLength(3);
  expect(primaryQueries).toContainEqual({
    text: `INSERT INTO "users" (screen_name, age) VALUES ($1, $2),($3, $4)`,
    values: ['John', 30, 'Jane', 29],
  });
  expect(primaryQueries).toContainEqual({
    text: `INSERT INTO "users" (screen_name, age) VALUES ($1, $2)`,
    values: ['John', 30],
  });
  expect(primaryQueries).toContainEqual({
    text: `INSERT INTO "users" (screen_name, age) VALUES ($1, $2)`,
    values: ['Jane', 29],
  });
  expect(replicaQueries).toHaveLength(0);
});

test('SELECT read-only queries sent to replicas', async () => {
  const users = await cluster.query(sql`SELECT * FROM ${table}`);

  expect(users).toHaveLength(4);
  expect(users).toContainEqual(expect.objectContaining(USERS[0]));
  expect(users).toContainEqual(expect.objectContaining(USERS[1]));

  expect(primaryQueries).toHaveLength(0);
  expect(replicaQueries).toHaveLength(1);
  expect(replicaQueries).toContainEqual({
    text: `SELECT * FROM "users"`,
    values: [],
  });
});

test('WITH read-only queries sent to replicas', async () => {
  await cluster.query(sql`WITH t AS (SELECT * FROM ${table}) SELECT * FROM t`);

  expect(primaryQueries).toHaveLength(0);
  expect(replicaQueries).toHaveLength(1);
  expect(replicaQueries).toContainEqual({
    text: `WITH t AS (SELECT * FROM "users") SELECT * FROM t`,
    values: [],
  });
});

test('WITH write queries sent to primary', async () => {
  await cluster.query(
    sql`WITH t AS (UPDATE ${table} SET age = age * 2 RETURNING *) SELECT * FROM t`,
  );

  expect(primaryQueries).toHaveLength(1);
  expect(primaryQueries).toContainEqual({
    text: `WITH t AS (UPDATE "users" SET age = age * 2 RETURNING *) SELECT * FROM t`,
    values: [],
  });
  expect(replicaQueries).toHaveLength(0);
});

test('UPDATE queries sent to primary', async () => {
  await cluster.query(sql`UPDATE ${table} SET age = age * 3`);

  expect(primaryQueries).toHaveLength(1);
  expect(primaryQueries).toContainEqual({
    text: `UPDATE "users" SET age = age * 3`,
    values: [],
  });
  expect(replicaQueries).toHaveLength(0);
});
