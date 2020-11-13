import {extname} from 'path';
import {
  DatabaseEngine,
  DatabaseEngineTransaction,
  AppliedMigration,
  Result,
  DatabaseVersionError,
  MigrationWithNoValidExport,
  DirectoryContext,
  IDirectoryContext,
} from '@databases/migrations-base';
import {ConnectionPool, Queryable, Transaction} from '@databases/pg';

export interface MigrationsConfig {
  migrationsDirectory: string;
  /**
   * @default "atdatabases_migrations_version"
   */
  versionTableName: string;
  /**
   * @default "atdatabases_migrations_applied"
   */
  appliedMigrationsTableName: string;
}

export type Migration = (tx: Transaction) => Promise<void>;
export default class PostgresDatabaseEngine
  implements DatabaseEngine<Migration> {
  private readonly _connection: ConnectionPool;
  private readonly _config: MigrationsConfig;
  public readonly directory: IDirectoryContext<Migration>;
  constructor(connection: ConnectionPool, config: MigrationsConfig) {
    this._connection = connection;
    this._config = config;
    this.directory = new DirectoryContext(
      config.migrationsDirectory,
      // load migration:
      (
        migrationFileName: string,
      ): Result<Migration, MigrationWithNoValidExport> => {
        switch (extname(migrationFileName)) {
          case '.sql':
            return Result.ok(async (db: Transaction) => {
              await db.query([db.sql.file(migrationFileName)]);
            });
          case '.js':
          case '.mjs':
          case '.jsx':
            return getExport(require(migrationFileName), migrationFileName);
          case '.ts':
          case '.tsx':
            return getExport(require(migrationFileName), migrationFileName);
          default:
            throw new Error(
              `Unsupported extension "${extname(migrationFileName)}"`,
            );
        }
      },
    );
  }

  readonly databaseName = 'Postgres';
  readonly packageName = '@databases/pg-migrations';
  readonly cliName = 'pg-migrations';
  readonly packageVersion = require('../package.json').version;

  async checkDatabaseVersion(): Promise<Result<void, DatabaseVersionError>> {
    const [major, minor] = await getPgVersion(this._connection);
    if (major < 10) {
      return Result.fail<DatabaseVersionError>({
        code: 'database_version',
        actualVersion: `${major}.${minor}`,
        minimumVersion: '10.0',
      });
    }
    await this._connection.query(this._connection.sql`
      CREATE TABLE IF NOT EXISTS ${this._connection.sql.ident(
        ...this._config.versionTableName.split('.'),
      )} (
        id INTEGER NOT NULL PRIMARY KEY,
        version TEXT
      );
    `);
    return Result.ok();
  }

  async tx<TResult>(
    fn: (tx: DatabaseEngineTransaction<Migration>) => Promise<TResult>,
  ): Promise<TResult> {
    const versionTableName = this._connection.sql.ident(
      ...this._config.versionTableName.split('.'),
    );
    const appliedMigrationsTableName = this._connection.sql.ident(
      ...this._config.appliedMigrationsTableName.split('.'),
    );
    return await this._connection.tx(async (tx) => {
      return await fn({
        async getVersion(): Promise<string> {
          const versionRecords = await tx.query(
            tx.sql`SELECT version FROM ${versionTableName} WHERE id=0`,
          );
          if (versionRecords.length) {
            if (typeof versionRecords[0].version === 'string') {
              return versionRecords[0].version;
            } else {
              throw new Error(
                `The schema of the ${versionTableName} does not match the expected schema.`,
              );
            }
          }
          return '0.0.0';
        },
        async updateVersion(
          _oldVersion,
          newVersion,
          oldVersionIsLessThan,
        ): Promise<void> {
          if (oldVersionIsLessThan('2.0.0')) {
            await tx.query(tx.sql`
              CREATE TABLE ${appliedMigrationsTableName} (
                id BIGSERIAL NOT NULL PRIMARY KEY,
                index INT NOT NULL,
                name TEXT NOT NULL,
                script TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL,
                ignored_error TEXT NULL,
                obsolete BOOLEAN NOT NULL
              );
            `);
          }
          const updatedRecords = await tx.query(tx.sql`
            UPDATE ${versionTableName} SET version=${newVersion}
            RETURNING id
          `);
          if (!updatedRecords.some((r) => r.id === 0)) {
            await tx.query(tx.sql`
              INSERT INTO ${versionTableName} (id, version)
              VALUES (0, ${newVersion})
            `);
          }
        },
        async getMigrations(): Promise<AppliedMigration[]> {
          const migrations: {
            index: number;
            name: string;
            script: string;
            applied_at: Date;
            ignored_error: string | null;
            obsolete: boolean;
          }[] = await tx.query(tx.sql`
            SELECT index, name, script, applied_at, ignored_error, obsolete
            FROM ${appliedMigrationsTableName}
          `);
          return migrations;
        },
        async markAsApplied(migration: AppliedMigration): Promise<void> {
          const existingRecords: {applied_at: Date}[] = await tx.query(tx.sql`
            SELECT applied_at FROM ${appliedMigrationsTableName}
            WHERE index=${migration.index} AND obsolete=${false}
          `);
          if (existingRecords.length) {
            throw new Error(
              `${
                migration.name
              } was already applied at ${existingRecords[0].applied_at.toISOString()}`,
            );
          }
          await tx.query(tx.sql`
            INSERT INTO ${appliedMigrationsTableName}
              (
                index, name, script,
                applied_at, ignored_error, obsolete
              )
            VALUES
              (
                ${migration.index}, ${migration.name}, ${migration.script},
                ${migration.applied_at},
                ${migration.ignored_error},
                ${migration.obsolete}
              )
          `);
        },
        async ignoreError(migration: AppliedMigration): Promise<void> {
          await tx.query(tx.sql`
            UPDATE ${appliedMigrationsTableName}
            SET ignored_error=${migration.ignored_error}
            WHERE index=${migration.index} AND obsolete=${false}
          `);
        },
        async markAsObsolete(migration: AppliedMigration): Promise<void> {
          await tx.query(tx.sql`
            UPDATE ${appliedMigrationsTableName}
            SET obsolete=${true}
            WHERE index=${migration.index} AND obsolete=${false}
          `);
        },

        async applyMigration(migration) {
          await migration(tx);
        },
      });
    });
  }

  loadMigration(
    migrationFileName: string,
  ): Result<Migration, MigrationWithNoValidExport> {
    switch (extname(migrationFileName)) {
      case '.sql':
        return Result.ok(async (db: Transaction) => {
          await db.query([db.sql.file(migrationFileName)]);
        });
      case '.js':
      case '.mjs':
      case '.jsx':
        return getExport(require(migrationFileName), migrationFileName);
      case '.ts':
      case '.tsx':
        return getExport(require(migrationFileName), migrationFileName);
      default:
        throw new Error(
          `Unsupported extension "${extname(migrationFileName)}"`,
        );
    }
  }
  async dispose() {
    await this._connection.dispose();
  }
}

function getExport(mod: any, filename: string) {
  if (mod) {
    if (typeof mod.applyMigration === 'function') {
      return Result.ok<Migration>(mod.applyMigration);
    }
    if (typeof mod.default === 'function') {
      return Result.ok<Migration>(mod.default);
    }
    if (typeof mod === 'function') {
      return Result.ok<Migration>(mod);
    }
  }
  return Result.fail<MigrationWithNoValidExport>({
    code: 'migration_has_no_export',
    filename: filename,
  });
}

async function getPgVersion(connection: Queryable): Promise<[number, number]> {
  // e.g. PostgreSQL 10.1 on x86_64-apple-darwin16.7.0, compiled by Apple LLVM version 9.0.0 (clang-900.0.38), 64-bit
  const [{version: sqlVersionString}] = await connection.query(
    connection.sql`SELECT version();`,
  );
  const match = /PostgreSQL (\d+).(\d+)/.exec(sqlVersionString);
  if (match) {
    const [, major, minor] = match;
    return [parseInt(major, 10), parseInt(minor, 10)];
  }
  return [0, 0];
}
