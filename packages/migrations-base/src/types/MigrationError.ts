import MigrationFile from './MigrationFile';
import AppliedMigration from './AppliedMigration';

export interface DatabaseVersionError {
  code: 'database_version';
  minimumVersion: string;
  actualVersion: string;
}

export interface DatabaseUsesNewerVersionError {
  code: 'database_uses_newer_version';
  databaseVersion: string;
  packageVersion: string;
}

export interface DatabaseUsesOlderVersionError {
  code: 'database_uses_older_version';
  databaseVersion: string;
  packageVersion: string;
}

export interface MigrationFilenamesError {
  code: 'migration_filenames';
  files: string[];
}

export interface MigrationWithNoValidExport {
  code: 'migration_has_no_export';
  filename: string;
}

export interface ConcurrentMigrationsError {
  code: 'concurrent_migrations';
}

export interface DuplicateMigrationFilesError {
  code: 'duplicate_migration_files';
  files: MigrationFile[];
}
export interface MigrationFileMissingError {
  code: 'migration_file_missing';
  appliedMigration: AppliedMigration;
}
export interface MigrationFileEditedError {
  code: 'migration_file_edited';
  appliedMigration: AppliedMigration;
  migrationFile: MigrationFile;
}
export interface MigrationOrderChangeError {
  code: 'migration_order_change';
  appliedMigrations: AppliedMigration[];
  unappliedMigrations: MigrationFile[];
}

export interface MissingMigrationError {
  code: 'missing_migration';
  index: number;
}

export interface MissingParameterError {
  code: 'missing_parameter';
  type: 'applied_migration' | 'migration_file' | 'error_type';
  name: string;
}

type MigrationError =
  | DatabaseVersionError
  | DatabaseUsesNewerVersionError
  | DatabaseUsesOlderVersionError
  | MigrationFilenamesError
  | MigrationWithNoValidExport
  | ConcurrentMigrationsError
  | DuplicateMigrationFilesError
  | MigrationFileMissingError
  | MigrationFileEditedError
  | MigrationOrderChangeError
  | MissingMigrationError
  | MissingParameterError;

export default MigrationError;
