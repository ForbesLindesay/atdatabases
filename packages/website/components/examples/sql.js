// This example uses "mock-db" to run in your browser

// If you are running in node.js, you can use "real" databases like
// Postgres & MySQL by just replacing this import.

import createConnectionPool, {sql} from '@databases/mock-db';

const db = createConnectionPool({
  dbName: 'my-mock-db',
  handlers: {
    onQueryStart(q, {text, values}) {
      console.log(text, values);
    },
  },
});

await createUsersTable(db);

// Use "db.tx" to wrap multiple statements in a transaction
await db.tx(async (db) => {
  await addUser(db, 'a@example.com');
  await addUser(db, 'b@example.com');
});

await setActive(db, 'a@example.com', false);

console.log('All Users');
console.table(await db.query(sql`SELECT * FROM users;`));

console.log('Active Users');
console.table(
  await db.query(sql`
    SELECT * FROM users WHERE active = TRUE;
  `),
);

async function createUsersTable(db) {
  await db.query(sql`
    CREATE TABLE users (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      email TEXT NOT NULL,
      active BOOLEAN NOT NULL
    );
  `);
}

async function addUser(db, email) {
  await db.query(sql`
    INSERT INTO users (email, active)
    VALUES (${email}, true)
  `);
}

async function setActive(db, email, isActive) {
  await db.query(sql`
    UPDATE users
    SET active = ${isActive}
    WHERE email=${email}
  `);
}
