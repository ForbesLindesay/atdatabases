import {getPublicApi} from '@databases/migrations-base';
import connect, {ConnectionPool, Connection, sql} from '@databases/pg';
import PostgresDatabaseEngine, {
  Migration,
  MigrationsConfig,
} from './PostgresDatabaseEngine';

export type {Migration};
export type {ConnectionPool, Connection};
export {connect, sql};

const {
  applyMigrations,
  ignoreError,
  markMigrationAsApplied,
  markMigrationAsUnapplied,
  restoreMigrationFromDatabase,
} = getPublicApi<Migration, ConnectionPool, MigrationsConfig>(
  (
    connection,
    {
      versionTableName = 'atdatabases_migrations_version',
      appliedMigrationsTableName = 'atdatabases_migrations_applied',
    },
  ) =>
    new PostgresDatabaseEngine(connection, {
      versionTableName,
      appliedMigrationsTableName,
    }),
);

export {
  applyMigrations,
  ignoreError,
  markMigrationAsApplied,
  markMigrationAsUnapplied,
  restoreMigrationFromDatabase,
};
