import {Connection, sql} from '../../';

export default async function applyMigration(db: Connection): Promise<void> {
  await db.query(sql`
    INSERT INTO "users" ("name") VALUES ('Eleanor Brodie');
  `);
}
