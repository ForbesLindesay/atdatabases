import {Connection, sql} from '../../';

export async function up(db: Connection) {
  await db.query(sql`
    CREATE TABLE users (
      id BIGSERIAL NOT NULL PRIMARY KEY,
      name VARCHAR NOT NULL
    );
    INSERT INTO "users" ("name") VALUES ('Forbes Lindesay');
  `);
}
export async function down(db: Connection) {
  await db.query(sql`
    DROP TABLE users;
  `);
}

// Do not edit this unique ID
export const id = 'd000jcbsfkyjcwricki6';
