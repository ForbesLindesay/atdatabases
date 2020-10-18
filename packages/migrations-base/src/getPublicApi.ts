import DatabaseEngine from './types/DatabaseEngine';
import MigrationError from './types/MigrationError';
import runCommand, {RunCommandOptions, Command} from './runCommand';
import {SequenceErrorIgnoreCode} from './methods/validateMigrationsSequence';
import DirectoryContext from './DirectoryContext';
import applyMigrations from './commands/applyMigrations';
import throwError from './methods/throwError';
import ignoreError from './commands/ignoreError';
import {MigrationCommandParameters} from './MigrationContext';
import markMigrationAsApplied from './commands/markMigrationAsApplied';
import markMigrationAsUnapplied from './commands/markMigrationAsUnapplied';
import restoreMigrationFromDatabase from './commands/restoreMigrationFromDatabase';

export interface PublicAPI<TConnection, TParameters> {
  readonly applyMigrations: (
    connection: TConnection,
    directory: string,
    parameters?: Partial<TParameters & RunCommandOptions<MigrationError>> & {
      ignoredErrors?: SequenceErrorIgnoreCode[];
    },
  ) => Promise<void>;
  readonly ignoreError: (
    connection: TConnection,
    directory: string,
    parameters: Partial<TParameters & RunCommandOptions<MigrationError>> & {
      migrationIndex: number;
      errorType: SequenceErrorIgnoreCode;
    },
  ) => Promise<void>;
  readonly markMigrationAsApplied: (
    connection: TConnection,
    directory: string,
    parameters: Partial<TParameters & RunCommandOptions<MigrationError>> & {
      migrationIndex: number;
    },
  ) => Promise<void>;
  readonly markMigrationAsUnapplied: (
    connection: TConnection,
    directory: string,
    parameters: Partial<TParameters & RunCommandOptions<MigrationError>> & {
      migrationIndex: number;
    },
  ) => Promise<void>;
  readonly restoreMigrationFromDatabase: (
    connection: TConnection,
    directory: string,
    parameters: Partial<TParameters & RunCommandOptions<MigrationError>> & {
      migrationIndex: number;
    },
  ) => Promise<void>;
}
export default function getPublicApi<TMigration, TConnection, TParameters>(
  getEngine: (
    connection: TConnection,
    parameters: Partial<TParameters>,
  ) => DatabaseEngine<TMigration>,
): PublicAPI<TConnection, TParameters> {
  async function run(
    connection: TConnection,
    directory: string,
    runParameters: Partial<TParameters & RunCommandOptions<MigrationError>>,
    commandParameters: MigrationCommandParameters,
    command: Command<void, MigrationError>,
  ) {
    const engine = getEngine(connection, runParameters);
    const directoryContext = new DirectoryContext(directory);
    const result = await runCommand(
      engine,
      directoryContext,
      command,
      commandParameters,
      runParameters,
    );
    if (!result.ok) {
      throwError(result.reason, engine);
    }
  }

  return {
    async applyMigrations(connection, directory, parameters = {}) {
      await run(
        connection,
        directory,
        parameters,
        {ignored_errors: parameters.ignoredErrors},
        applyMigrations(),
      );
    },
    async ignoreError(connection, directory, parameters) {
      await run(
        connection,
        directory,
        parameters,
        {
          error_type: parameters.errorType,
          applied_migration: parameters.migrationIndex,
        },
        ignoreError(),
      );
    },
    async markMigrationAsApplied(connection, directory, parameters) {
      await run(
        connection,
        directory,
        parameters,
        {
          migration_file: parameters.migrationIndex,
        },
        markMigrationAsApplied(),
      );
    },
    async markMigrationAsUnapplied(connection, directory, parameters) {
      await run(
        connection,
        directory,
        parameters,
        {
          applied_migration: parameters.migrationIndex,
        },
        markMigrationAsUnapplied(),
      );
    },
    async restoreMigrationFromDatabase(connection, directory, parameters) {
      await run(
        connection,
        directory,
        parameters,
        {
          applied_migration: parameters.migrationIndex,
        },
        restoreMigrationFromDatabase(),
      );
    },
  };
}
