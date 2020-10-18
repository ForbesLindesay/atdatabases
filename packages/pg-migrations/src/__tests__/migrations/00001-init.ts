import {Connection, sql} from '../../';

export default async function applyMigration(db: Connection) {
  await db.query(sql`
    CREATE TABLE users (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      name VARCHAR NOT NULL
    );
    INSERT INTO "users" ("name") VALUES ('Forbes Lindesay');
  `);
}
