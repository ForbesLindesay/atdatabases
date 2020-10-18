export type {default as AppliedMigration} from './types/AppliedMigration';
export type {
  default as DatabaseEngine,
  DatabaseEngineTransaction,
} from './types/DatabaseEngine';
export type {
  default as MigrationError,
  DatabaseVersionError,
  MigrationWithNoValidExport,
} from './types/MigrationError';
export {default as Result} from './types/Result';

export {
  default as DirectoryContext,
  IDirectoryContext,
} from './DirectoryContext';
export {
  default as MigrationContext,
  MigrationCommandParameters,
} from './MigrationContext';

export {default as runCommand, Command} from './runCommand';

export {default as applyMigrations} from './commands/applyMigrations';
export {default as ignoreError} from './commands/ignoreError';
export {default as markMigrationAsApplied} from './commands/markMigrationAsApplied';
export {default as markMigrationAsUnapplied} from './commands/markMigrationAsUnapplied';
export {default as restoreMigrationFromDatabase} from './commands/restoreMigrationFromDatabase';

export {default as getPublicApi} from './getPublicApi';
export {
  default as getCommandLineInterface,
  commands,
  CommandLineInterfaceConfig,
} from './getCommandLineInterface';

export {default as printError} from './methods/printError';

export * as parameters from 'parameter-reducers';
