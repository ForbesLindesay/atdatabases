import connect, {sql} from '@databases/pg';
import createCluster from '@databases/pg-cluster';
import Schema from './__generated__';
import defineTables from '..';

const SCHEMA_NAME = 'typed_cluster_queries_tests';
const TABLE_NAME = 'users';

const {users} = defineTables<Schema>({
  schemaName: SCHEMA_NAME,
});

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
const cluster = createCluster(primary, replica);

beforeEach(() => {
  primaryQueries = [];
  replicaQueries = [];
});

afterAll(async () => {
  await primary.dispose();
  await replica.dispose();
});

test('create schema', async () => {
  await cluster.query(sql`CREATE SCHEMA ${sql.ident(SCHEMA_NAME)}`);
  await cluster.query(
    sql`
      CREATE TABLE ${sql.ident(SCHEMA_NAME, TABLE_NAME)} (
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

test('insert query', async () => {
  await users(cluster).insert({screen_name: 'John'}, {screen_name: 'Jane'});

  expect(primaryQueries).toHaveLength(1);
  expect(primaryQueries).toContainEqual({
    text: `INSERT INTO "users" ("screen_name") VALUES ($1),($2) RETURNING *`,
    values: ['John', 'Jane'],
  });
  expect(replicaQueries).toHaveLength(0);
});

test('select query', async () => {
  expect(
    (await users(cluster).find().orderByAsc('screen_name').first())
      ?.screen_name,
  ).toBe('Jane');

  expect(primaryQueries).toHaveLength(0);
  expect(replicaQueries).toHaveLength(1);
  expect(replicaQueries).toContainEqual({
    text: `SELECT * FROM "users" ORDER BY "screen_name" ASC LIMIT $1`,
    values: [1],
  });
});
