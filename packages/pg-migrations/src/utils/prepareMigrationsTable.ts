import {Connection} from '@databases/pg';

export default async function prepareMigrationsTable(connection: Connection) {
  await connection.tx(async tx => {
    await tx.query(tx.sql`
      CREATE TABLE IF NOT EXISTS "atdatabases_migrations_version" (
        "id" INTEGER NOT NULL PRIMARY KEY,
        "version" INTEGER
      );
    `);
    const v = await tx.query(
      tx.sql`SELECT "version" FROM "atdatabases_migrations_version" WHERE "id" = 0`,
    );
    if (v.length === 0) {
      await tx.query(tx.sql`
        CREATE TABLE "atdatabases_migrations" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "index" INTEGER NOT NULL,
          "name" TEXT NOT NULL,
          "is_applied" BOOLEAN NOT NULL DEFAULT FALSE,
          "last_up" TIMESTAMP,
          "last_down" TIMESTAMP
        );
        INSERT INTO "atdatabases_migrations_version" ("id", "version") VALUES (0, 1);
      `);
      return;
    }
    const version: number = v[0].version;
    if (version > 1) {
      throw new Error(
        'This database has been migrated using a newer version of @databases/pg-migrations. Please upgrade your copy of @databases/migrations before running migrations.',
      );
    }
    // ...Handle Upgrading Versions Here...
  });
}
