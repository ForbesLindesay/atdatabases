import chalk from 'chalk';
import connect, {Connection} from '@databases/pg';
import sql from '@databases/sql';
import Operation from './Operation';
import Migration from './Migration';
import MigrationSpec from './MigrationSpec';
import MigrationStatus from './MigrationStatus';
import getPgVersion from './getPgVersion';
import prepareMigrationsTable from './prepareMigrationsTable';

export {Connection, sql, Migration, MigrationSpec, Operation};

export enum Direction {
  up = 'up',
  down = 'down',
}
export enum NumberOfOperations {
  all = 'all',
  last = 'last',
  one = 'one',
}

export function packageOperation(op: Operation): Operation {
  return op;
}

export interface Options {
  silent?: boolean;
  interactive?: boolean;
}
export class MigrationsPackage {
  public readonly migrations: ReadonlyArray<MigrationSpec>;
  private _supportsOn = true;
  constructor(migrations: MigrationSpec[]) {
    this.migrations = migrations;
  }
  private async run<T>(
    db: Connection | string | undefined,
    operation: (db: Connection, migrations: Migration[]) => Promise<T>,
  ): Promise<T> {
    if (typeof db === 'string' || db === undefined) {
      const connection = connect(db);
      const result = await this.run(connection, operation);
      await connection.dispose();
      return result;
    }
    return await db.task(async task => {
      await prepareMigrationsTable(task);
      const [major] = await getPgVersion(task);
      this._supportsOn = major >= 10;

      const migrations: MigrationStatus[] = await db.query(
        sql`SELECT * FROM "atdatabases_migrations"`,
      );

      return await operation(
        task,
        this.migrations.map(
          migration =>
            new Migration(
              migration,
              migrations.find(m => m.id === migration.id),
              {supportsOn: this._supportsOn},
            ),
        ),
      );
    });
  }

  checkState(migrations: ReadonlyArray<Migration>) {
    let applied = true;
    return migrations.every(migration => {
      if (!migration.is_applied) {
        applied = false;
      }
      return migration.is_applied === applied;
    });
  }

  async getState(db?: Connection | string) {
    return await this.run(db, async (_db, migrations) => {
      return migrations;
    });
  }

  async runOperation(
    connectionString: string | undefined,
    direction: Direction,
    numberOfOperations: NumberOfOperations,
    options: Options = {},
  ) {
    return await this.run(connectionString, async (db, migrations) => {
      if (!this.checkState(migrations)) {
        return migrations;
      }
      switch (direction) {
        case Direction.up:
          if (numberOfOperations === NumberOfOperations.last) {
            throw new Error(
              'You cannot use "last" with "up", because it does not make sense to skip intermediate migrations.',
            );
          }
          for (const m of migrations) {
            if (!m.is_applied) {
              if (!options.silent) {
                console.info(
                  chalk.green('applying') +
                    ' database migration ' +
                    chalk.cyan(m.name),
                );
              }
              await m.up(db);
              if (numberOfOperations === NumberOfOperations.one) {
                return undefined;
              }
            }
          }
          break;
        case Direction.down:
          for (const m of migrations.slice().reverse()) {
            if (m.is_applied) {
              if (!options.silent) {
                console.info(
                  chalk.red('reverting') +
                    ' database migration ' +
                    chalk.cyan(m.name),
                );
              }
              await m.down(db);
              if (numberOfOperations === NumberOfOperations.one) {
                return undefined;
              }
            }
            if (numberOfOperations === NumberOfOperations.last) {
              return undefined;
            }
          }
          break;
      }
      return undefined;
    });
  }

  async upOne(connectionString?: string, options: Options = {}) {
    return await this.runOperation(
      connectionString,
      Direction.up,
      NumberOfOperations.one,
      options,
    );
  }
  async upAll(connectionString?: string, options: Options = {}) {
    return await this.runOperation(
      connectionString,
      Direction.up,
      NumberOfOperations.all,
      options,
    );
  }

  async downAll(connectionString?: string, options: Options = {}) {
    return await this.runOperation(
      connectionString,
      Direction.down,
      NumberOfOperations.all,
      options,
    );
  }
  async downOne(connectionString?: string, options: Options = {}) {
    return await this.runOperation(
      connectionString,
      Direction.down,
      NumberOfOperations.one,
      options,
    );
  }
  async downLast(connectionString?: string, options: Options = {}) {
    return await this.runOperation(
      connectionString,
      Direction.down,
      NumberOfOperations.last,
      options,
    );
  }
}
export default function packageMigrations(
  ...migrations: MigrationSpec[]
): MigrationsPackage {
  const pkg = new MigrationsPackage(migrations);
  const AUTO_RUN_DB_MIGRATION_PROCESS: any = (global as any)
    .AUTO_RUN_DB_MIGRATION_PROCESS;
  if (AUTO_RUN_DB_MIGRATION_PROCESS) {
    AUTO_RUN_DB_MIGRATION_PROCESS(pkg);
  }
  return pkg;
}
