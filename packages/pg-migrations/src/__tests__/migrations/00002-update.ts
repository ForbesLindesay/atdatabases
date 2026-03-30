import {type Transaction, sql} from '../../../dist/index.js';

export default async function applyMigration(db: Transaction): Promise<void> {
  await db.query(sql`
    INSERT INTO "users" ("name") VALUES ('Eleanor Brodie');
  `);
}
