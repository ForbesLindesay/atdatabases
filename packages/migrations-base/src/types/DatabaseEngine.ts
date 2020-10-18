import AppliedMigration from './AppliedMigration';
import Result from './Result';
import {
  DatabaseVersionError,
  MigrationWithNoValidExport,
} from './MigrationError';

export interface DatabaseEngineTransaction<TMigration> {
  getVersion(): Promise<string>;
  updateVersion(
    oldVersion: string,
    newVersion: string,
    oldVersionIsLessThan: (newVersion: string) => boolean,
  ): Promise<void>;

  getMigrations(): Promise<AppliedMigration[]>;
  markAsApplied(migration: AppliedMigration): Promise<void>;
  ignoreError(migration: AppliedMigration): Promise<void>;
  markAsObsolete(migration: AppliedMigration): Promise<void>;

  applyMigration(migration: TMigration): Promise<void>;
}

export interface DatabaseEngineBase {
  readonly databaseName: string; // e.g. "Postgres", "MySQL", etc.
  readonly packageName: string; // e.g. "@databases/pg-migrations", "@databases/mysql-migrations", etc.
  readonly cliName: string; // e.g. "pg-migrations", "mysql-migrations", etc.
  readonly packageVersion: string; // semver version e.g. "1.0.0"
}

export default interface DatabaseEngine<TMigration> extends DatabaseEngineBase {
  checkDatabaseVersion(): Promise<Result<void, DatabaseVersionError>>;

  tx<TResult>(
    fn: (tx: DatabaseEngineTransaction<TMigration>) => Promise<TResult>,
  ): Promise<TResult>;

  loadMigration(
    migrationFileName: string,
  ): Result<TMigration, MigrationWithNoValidExport>;

  dispose(): Promise<void>;
}
