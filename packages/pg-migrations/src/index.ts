import {getPublicApi, type PublicAPI} from '@databases/migrations-base';
import connect, {
  ConnectionPool,
  Connection,
  Transaction,
  Queryable,
  sql,
} from '@databases/pg';
import PostgresDatabaseEngine, {
  Migration,
  MigrationsConfig,
} from './PostgresDatabaseEngine';
import assertIsDirectory from './assertIsDirectory';
import cli from './cli';

export type {Migration};
export type {ConnectionPool, Connection, Transaction, Queryable};
export {connect, sql};

export {cli};

export interface Parameters extends Partial<MigrationsConfig> {
  connection: ConnectionPool;
  migrationsDirectory: string;
}
const api = getPublicApi<Migration, Parameters>(
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

export const applyMigrations: PublicAPI<Parameters>['applyMigrations'] =
  api.applyMigrations;
export const ignoreError: PublicAPI<Parameters>['ignoreError'] =
  api.ignoreError;
export const markMigrationAsApplied: PublicAPI<Parameters>['markMigrationAsApplied'] =
  api.markMigrationAsApplied;
export const markMigrationAsUnapplied: PublicAPI<Parameters>['markMigrationAsUnapplied'] =
  api.markMigrationAsUnapplied;
export const restoreMigrationFromDatabase: PublicAPI<Parameters>['restoreMigrationFromDatabase'] =
  api.restoreMigrationFromDatabase;
