import MigrationSpec from './MigrationSpec';
import {ConnectionPool, Connection, isConnectionPool} from '@databases/pg';
import Migration from './Migration';
import prepareMigrationsTable from './prepareMigrationsTable';
import getPgVersion from './getPgVersion';
import MigrationStatus from './MigrationStatus';
import chalk from 'chalk';
import MigrationMetadata from './MigrationMetadata';

export enum Direction {
  up = 'up',
  down = 'down',
}
export enum NumberOfOperations {
  all = 'all',
  last = 'last',
  one = 'one',
}

function isValidState(migrations: ReadonlyArray<Migration>): boolean {
  let applied = true;
  return migrations.every(migration => {
    if (!migration.is_applied) {
      applied = false;
    }
    return migration.is_applied === applied;
  });
}

export interface OperationOptions {
  silent?: boolean;
  // interactive?: boolean;
}
export default class ConnectedMigrationsPackage {
  private readonly _connection: ConnectionPool | Connection;
  private readonly _migrations: ReadonlyArray<MigrationSpec>;
  public readonly migrations: ReadonlyArray<MigrationMetadata>;
  private _supportsOn = true;
  constructor(
    connection: ConnectionPool | Connection,
    migrations: ReadonlyArray<MigrationSpec>,
  ) {
    this._connection = connection;
    this._migrations = migrations;
    this.migrations = migrations.map(m => ({
      id: m.id,
      index: m.index,
      name: m.name,
    }));
  }

  private async run<T>(
    operation: (db: Connection, migrations: Migration[]) => Promise<T>,
  ): Promise<T> {
    return await this._connection.task(async task => {
      await prepareMigrationsTable(task);
      const [major] = await getPgVersion(task);
      this._supportsOn = major >= 10;

      const migrations: MigrationStatus[] = await task.query(
        task.sql`SELECT * FROM "atdatabases_migrations"`,
      );

      return await operation(
        task,
        this._migrations.map(
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

  async getState(): Promise<MigrationStatus[]> {
    return await this.run(async (_db, migrations) => {
      return migrations.map(m => ({
        id: m.id,
        index: m.index,
        name: m.name,
        is_applied: m.is_applied,
        last_up: m.last_up,
        last_down: m.last_down,
      }));
    });
  }

  async setStatus(id: string, isApplied: boolean) {
    await this.run(async (db, migrations) => {
      const migration = migrations.find(m => m.id === id);
      if (!migration) {
        throw new Error(`Could not find a migration with the id "${id}"`);
      }
      await migration.setStatus(db, isApplied);
    });
  }

  async upById(id: string) {
    await this.run(async (db, migrations) => {
      const migration = migrations.find(m => m.id === id);
      if (!migration) {
        throw new Error(`Could not find a migration with the id "${id}"`);
      }
      await migration.up(db);
    });
  }
  async downById(id: string) {
    await this.run(async (db, migrations) => {
      const migration = migrations.find(m => m.id === id);
      if (!migration) {
        throw new Error(`Could not find a migration with the id "${id}"`);
      }
      await migration.down(db);
    });
  }

  async runOperation(
    direction: Direction,
    numberOfOperations: NumberOfOperations,
    options: OperationOptions = {},
  ) {
    return await this.run(async (db, migrations) => {
      if (!isValidState(migrations)) {
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

  async upOne(options: OperationOptions = {}) {
    return await this.runOperation(
      Direction.up,
      NumberOfOperations.one,
      options,
    );
  }
  async upAll(options: OperationOptions = {}) {
    return await this.runOperation(
      Direction.up,
      NumberOfOperations.all,
      options,
    );
  }

  async downAll(options: OperationOptions = {}) {
    return await this.runOperation(
      Direction.down,
      NumberOfOperations.all,
      options,
    );
  }
  async downOne(options: OperationOptions = {}) {
    return await this.runOperation(
      Direction.down,
      NumberOfOperations.one,
      options,
    );
  }
  async downLast(options: OperationOptions = {}) {
    return await this.runOperation(
      Direction.down,
      NumberOfOperations.last,
      options,
    );
  }
  async dispose() {
    if (isConnectionPool(this._connection)) {
      await this._connection.dispose();
    }
  }
}
