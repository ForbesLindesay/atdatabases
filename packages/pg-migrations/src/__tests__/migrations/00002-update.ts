import {Connection, sql} from '../../';

export default async function applyMigration(db: Connection) {
  await db.query(sql`
    INSERT INTO "users" ("name") VALUES ('Eleanor Brodie');
  `);
}
