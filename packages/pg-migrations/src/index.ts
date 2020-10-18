import {getPublicApi} from '@databases/migrations-base';
import connect, {ConnectionPool, Connection, sql} from '@databases/pg';
import PostgresDatabaseEngine, {
  Migration,
  MigrationsConfig,
} from './PostgresDatabaseEngine';
import assertIsDirectory from './assertIsDirectory';

export type {Migration};
export type {ConnectionPool, Connection};
export {connect, sql};

export interface Parameters extends Partial<MigrationsConfig> {
  connection: ConnectionPool;
  migrationsDirectory: string;
}
const {
  applyMigrations,
  ignoreError,
  markMigrationAsApplied,
  markMigrationAsUnapplied,
  restoreMigrationFromDatabase,
} = getPublicApi<Migration, Parameters>(
  ({
    connection,
    migrationsDirectory,
    versionTableName = 'atdatabases_migrations_version',
    appliedMigrationsTableName = 'atdatabases_migrations_applied',
  }) =>
    new PostgresDatabaseEngine(connection, {
      versionTableName,
      appliedMigrationsTableName,
      migrationsDirectory: assertIsDirectory(migrationsDirectory, 'throw'),
    }),
);

export {
  applyMigrations,
  ignoreError,
  markMigrationAsApplied,
  markMigrationAsUnapplied,
  restoreMigrationFromDatabase,
};
