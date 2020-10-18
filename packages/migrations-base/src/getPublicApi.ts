import DatabaseEngine from './types/DatabaseEngine';
import MigrationError from './types/MigrationError';
import runCommand, {RunCommandOptions, Command} from './runCommand';
import {SequenceErrorIgnoreCode} from './methods/validateMigrationsSequence';
import applyMigrations from './commands/applyMigrations';
import throwError from './methods/throwError';
import ignoreError from './commands/ignoreError';
import {MigrationCommandParameters} from './MigrationContext';
import markMigrationAsApplied from './commands/markMigrationAsApplied';
import markMigrationAsUnapplied from './commands/markMigrationAsUnapplied';
import restoreMigrationFromDatabase from './commands/restoreMigrationFromDatabase';

export interface PublicAPI<TParameters> {
  readonly applyMigrations: (
    parameters: TParameters &
      RunCommandOptions<MigrationError> & {
        ignoredErrors?: SequenceErrorIgnoreCode[];
      },
  ) => Promise<void>;
  readonly ignoreError: (
    parameters: TParameters &
      RunCommandOptions<MigrationError> & {
        migrationIndex: number;
        errorType: SequenceErrorIgnoreCode;
      },
  ) => Promise<void>;
  readonly markMigrationAsApplied: (
    parameters: TParameters &
      RunCommandOptions<MigrationError> & {
        migrationIndex: number;
      },
  ) => Promise<void>;
  readonly markMigrationAsUnapplied: (
    parameters: TParameters &
      RunCommandOptions<MigrationError> & {
        migrationIndex: number;
      },
  ) => Promise<void>;
  readonly restoreMigrationFromDatabase: (
    parameters: TParameters &
      RunCommandOptions<MigrationError> & {
        migrationIndex: number;
      },
  ) => Promise<void>;
}
export default function getPublicApi<TMigration, TParameters>(
  getEngine: (parameters: TParameters) => DatabaseEngine<TMigration>,
): PublicAPI<TParameters> {
  async function run(
    runParameters: TParameters & RunCommandOptions<MigrationError>,
    commandParameters: MigrationCommandParameters,
    command: Command<void, MigrationError>,
  ) {
    const engine = getEngine(runParameters);
    const result = await runCommand(
      engine,
      command,
      commandParameters,
      runParameters,
    );
    if (!result.ok) {
      throwError(result.reason, engine);
    }
  }

  return {
    async applyMigrations(parameters) {
      await run(
        parameters,
        {ignored_errors: parameters.ignoredErrors},
        applyMigrations(),
      );
    },
    async ignoreError(parameters) {
      await run(
        parameters,
        {
          error_type: parameters.errorType,
          applied_migration: parameters.migrationIndex,
        },
        ignoreError(),
      );
    },
    async markMigrationAsApplied(parameters) {
      await run(
        parameters,
        {
          migration_file: parameters.migrationIndex,
        },
        markMigrationAsApplied(),
      );
    },
    async markMigrationAsUnapplied(parameters) {
      await run(
        parameters,
        {
          applied_migration: parameters.migrationIndex,
        },
        markMigrationAsUnapplied(),
      );
    },
    async restoreMigrationFromDatabase(parameters) {
      await run(
        parameters,
        {
          applied_migration: parameters.migrationIndex,
        },
        restoreMigrationFromDatabase(),
      );
    },
  };
}
