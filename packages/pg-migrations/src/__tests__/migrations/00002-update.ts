import {Connection, sql} from '../../';

export async function up(db: Connection) {
  await db.query(sql`
    INSERT INTO "users" ("name") VALUES ('Eleanor Brodie');
  `);
}
export async function down(db: Connection) {
  await db.query(sql`
    DELETE FROM "users" WHERE "name" = 'Eleanor Brodie';
  `);
}

// Do not edit this unique ID
export const id = 'd000jcbsfkyrhtasvyy8';
