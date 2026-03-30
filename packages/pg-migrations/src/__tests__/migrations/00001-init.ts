import {type Transaction, sql} from '../../../dist/index.js';

export default async function applyMigration(db: Transaction): Promise<void> {
  await db.query(sql`
    CREATE TABLE users (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      name VARCHAR NOT NULL
    );
    INSERT INTO "users" ("name") VALUES ('Forbes Lindesay');
  `);
}
