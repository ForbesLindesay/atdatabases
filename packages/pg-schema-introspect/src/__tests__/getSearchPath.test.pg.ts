import connect, {sql} from '@databases/pg';
import getSearchPath from '../getSearchPath';

const db = connect({bigIntMode: 'number'});

test('getSearchPath', async () => {
  expect(await getSearchPath(db)).toMatchInlineSnapshot(`
    [
      "public",
    ]
  `);
  expect(await getSearchPath(db, {includeNonExistantSchemas: true}))
    .toMatchInlineSnapshot(`
    [
      "test-user",
      "public",
    ]
  `);
  await db.query(sql`CREATE SCHEMA "test-user"`);
  expect(await getSearchPath(db)).toMatchInlineSnapshot(`
    [
      "test-user",
      "public",
    ]
  `);
});
