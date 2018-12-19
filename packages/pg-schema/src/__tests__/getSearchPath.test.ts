import connect, {sql} from '@databases/pg';
import getSearchPath from '../getSearchPath';

const db = connect();

test('getSearchPath', async () => {
  expect(await getSearchPath(db)).toMatchInlineSnapshot(`
Array [
  "public",
]
`);
  expect(await getSearchPath(db, {includeNonExistantSchemas: true}))
    .toMatchInlineSnapshot(`
Array [
  "test-user",
  "public",
]
`);
  await db.query(sql`CREATE SCHEMA "test-user"`);
  expect(await getSearchPath(db)).toMatchInlineSnapshot(`
Array [
  "test-user",
  "public",
]
`);
});
