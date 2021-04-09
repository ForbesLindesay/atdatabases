// This example uses "mock-db" to run in your browser

// If you are running in node.js, you can use "real" databases like
// Postgres & MySQL by just replacing this import.

import createConnectionPool, {sql} from '@databases/mock-db';
import createTyped from '@databases/mock-db-typed';

const db = createConnectionPool({
  dbName: 'my-mock-db',
  handlers: {
    onQueryStart(q, {text, values}) {
      console.log(text, values);
    },
  },
});
const tables = createTyped();

await createUsersTable(db);

// Use "db.tx" to wrap multiple statements in a transaction
await db.tx(async (db) => {
  await tables.users(db).insert({
    email: `a@example.com`,
    active: true,
  });
  await tables.users(db).insert({
    email: `b@example.com`,
    active: true,
  });
});

await tables.users(db).update({email: `a@example.com`}, {active: false});

console.log('All Users');
console.table(await tables.users(db).find().all());

console.log('Active Users');
console.table(await tables.users(db).find({active: true}).all());

async function createUsersTable(db) {
  await db.query(sql`
    CREATE TABLE users (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      email TEXT NOT NULL,
      active BOOLEAN NOT NULL
    );
  `);
}
