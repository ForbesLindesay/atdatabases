import {Connection} from '@databases/pg';
import MigrationSpec from './MigrationSpec';
import MigrationStatus from './MigrationStatus';
import Operation from './Operation';
import withTransaction from './withTransaction';

export default class Migration {
  public readonly id: string;
  public readonly index: number;
  public readonly name: string;
  private readonly _operation: () => Promise<Operation>;

  public is_applied: boolean;
  public last_up: Date | null;
  public last_down: Date | null;

  private readonly _supportsOn: boolean;

  constructor(
    migration: MigrationSpec,
    status: MigrationStatus | void,
    {supportsOn}: {supportsOn: boolean},
  ) {
    this.id = migration.id;
    this.index = migration.index;
    this.name = migration.name;
    this._operation = migration.operation;

    this.is_applied = !!(status && status.is_applied);
    this.last_up = status ? status.last_up : null;
    this.last_down = status ? status.last_down : null;

    this._supportsOn = supportsOn;
  }

  getStatus = async (db: Connection): Promise<MigrationStatus> => {
    return db
      .query(
        db.sql`SELECT * FROM "atdatabases_migrations" WHERE "id"=${this.id}`,
      )
      .then(result => {
        const status: MigrationStatus = {
          ...(result[0] || {
            is_applied: false,
            last_up: null,
            last_down: null,
          }),
          id: this.id,
          index: this.index,
          name: this.name,
        };
        this.is_applied = status.is_applied;
        this.last_up = status.last_up;
        this.last_down = status.last_down;
        return status;
      });
  };

  up = withTransaction(async (db: Connection) => {
    const {is_applied} = await this.getStatus(db);
    if (!is_applied) {
      const operation = await this._operation();
      await operation.up(db);
      await this.setStatus(db, true);
    }
  });

  down = withTransaction(async (db: Connection) => {
    const {is_applied} = await this.getStatus(db);
    if (is_applied) {
      const operation = await this._operation();
      await operation.down(db);
      await this.setStatus(db, false);
    }
  });

  setStatus = async (db: Connection, is_applied: boolean) => {
    const last_up = is_applied ? new Date() : this.last_up;
    const last_down = is_applied ? this.last_down : new Date();
    if (this._supportsOn) {
      await db.query(db.sql`
        INSERT INTO "atdatabases_migrations" (
          "id",
          "index",
          "name",
          "is_applied",
          "last_up",
          "last_down"
        )
        VALUES (
          ${this.id},
          ${this.index},
          ${this.name},
          ${is_applied},
          ${last_up},
          ${last_down}
        )
        ON CONFLICT ("id") DO UPDATE SET
          "index" = ${this.index},
          "name" = ${this.name},
          "is_applied" = ${is_applied},
          "last_up" = ${last_up},
          "last_down" = ${last_down};
      `);
    } else {
      const [{migrationExists}] = await db.query(db.sql`
        SELECT count(1) AS "migrationExists"
        FROM "atdatabases_migrations"
        WHERE id = ${this.id};
      `);
      if (migrationExists) {
        await db.query(db.sql`
          UPDATE "atdatabases_migrations" SET
            "index" = ${this.index},
            "name" = ${this.name},
            "is_applied" = ${is_applied},
            "last_up" = ${last_up},
            "last_down" = ${last_down}
          WHERE "id" = ${this.id};
        `);
      } else {
        await db.query(db.sql`
          INSERT INTO "atdatabases_migrations" (
            "id",
            "index",
            "name",
            "is_applied",
            "last_up",
            "last_down"
          )
          VALUES (
            ${this.id},
            ${this.index},
            ${this.name},
            ${is_applied},
            ${last_up},
            ${last_down}
          );
        `);
      }
    }
    this.is_applied = is_applied;
    this.last_up = last_up;
    this.last_down = last_down;
  };
}
