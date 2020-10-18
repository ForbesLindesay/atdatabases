import assertNever from 'assert-never';
import MigrationError from '../types/MigrationError';
import {DatabaseEngineBase} from '../types/DatabaseEngine';

export default function throwError(
  error: MigrationError,
  {databaseName, packageName, cliName}: DatabaseEngineBase,
): never {
  switch (error.code) {
    case 'database_version':
      throw new Error(
        `${packageName} does not support ${databaseName} version ${error.actualVersion} upgrade to at least version ${error.minimumVersion}.`,
      );
    case 'database_uses_newer_version':
      throw new Error(
        `This database has been migrated using ${packageName} version ${error.databaseVersion}. Your local copy of ${packageName} is version ${error.packageVersion}. Please update your version of ${packageName}.`,
      );
    case 'database_uses_older_version':
      throw new Error(
        `This database has not been migrated using ${packageName} version ${error.packageVersion} before. Version updates cannot be automaticaly applied when --dry-run is enabled.`,
      );
    case 'migration_filenames':
      throw new Error(
        `Migration filenames should start with an integer then a "-". ${error.files[0]} is not a valid migration.`,
      );
    case 'migration_has_no_export':
      throw new Error(`${error.filename} has no valid export.`);
    case 'concurrent_migrations':
      throw new Error(
        `Another migrations script was run on this database concurrently.`,
      );
    case 'duplicate_migration_files':
      throw new Error(
        `There are multiple migrations with the same index: ${error.files.join(
          ', ',
        )}`,
      );
    case 'migration_file_missing':
      throw new Error(
        `The migration ${error.appliedMigration.name} has been applied to the database but does not exist in your local migrations directory.`,
      );
    case 'migration_file_edited':
      throw new Error(
        `The migration ${error.appliedMigration.name} has been applied to the database but the aplied migration does not match the file in your migrations directory.`,
      );
    case 'migration_order_change':
      throw new Error(
        `You have unapplied migrations (${error.unappliedMigrations.join(
          ', ',
        )}) that should have been applied before migrations that have already been applied (${error.appliedMigrations.join(
          ', ',
        )}).`,
      );
    case 'missing_migration':
      throw new Error(`Unable to find the migration with index ${error.index}`);
      break;
    case 'missing_parameter':
      throw new Error(`This command requires a value for: ${error.name}`);
      break;
    default:
      void assertNever(error, true);
      throw new Error('Unexpected error encountered');
  }
}
