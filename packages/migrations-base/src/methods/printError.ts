import assertNever from 'assert-never';
import chalk from 'chalk';
import MigrationError from '../types/MigrationError';
import {DatabaseEngineBase} from '../types/DatabaseEngine';

export default function printError(
  error: MigrationError,
  {databaseName, packageName, cliName}: DatabaseEngineBase,
) {
  switch (error.code) {
    case 'database_version':
      console.error(
        `${packageName} does not support ${databaseName} version ${chalk.cyan(
          error.actualVersion,
        )} upgrade to at least version ${chalk.cyan(error.minimumVersion)}.`,
      );
      break;
    case 'database_uses_newer_version':
      console.error(
        `This database has been migrated using ${packageName} version ${chalk.cyan(
          error.databaseVersion,
        )}.`,
      );
      console.error(
        `Your local copy of ${packageName} is version ${chalk.cyan(
          error.packageVersion,
        )}.`,
      );
      console.error(
        `Attempting to apply migrations with an outdated copy of ${packageName} could lead to errors.`,
      );
      console.error(`Please update your version of ${packageName}`);
      break;
    case 'database_uses_older_version':
      console.error(
        `This database has not been migrated using ${packageName} version ${chalk.cyan(
          error.packageVersion,
        )} before.`,
      );
      console.error(
        `Version updates cannot be automaticaly applied when --dry-run is enabled.`,
      );
      break;
    case 'migration_filenames':
      console.error(
        `Migration filenames should start with an integer then a "-". For example:`,
      );
      console.error(``);
      console.error(`  - ${chalk.cyan('001-init.sql')}`);
      console.error(`  - ${chalk.cyan('001-init.ts')}`);
      console.error(`  - ${chalk.cyan('001-init.js')}`);
      console.error(``);
      if (error.files.length === 1) {
        console.error(
          `${chalk.cyan(error.files[0])} is not a valid migration filename.`,
        );
      } else {
        console.error(`These filenames are not valid migrations:`);
        console.error(``);
        for (const invalidFilename of error.files) {
          console.error(` - ${chalk.cyan(invalidFilename)}`);
        }
      }
      console.error(``);
      break;
    case 'migration_has_no_export':
      console.error(`${chalk.cyan(error.filename)} has no valid export.`);
      console.error(
        `To be used as a migration it must either have a default export, or a named export called "applyMigration".`,
      );
      break;
    case 'concurrent_migrations':
      console.error(
        `Another migrations script was run on this database concurrently.`,
      );
      console.error(`Please try again.`);
      break;
    case 'duplicate_migration_files':
      console.error(`There are multiple migrations with the same index.`);
      if (error.files.length === 2) {
        console.error(`You need to rename one of:`);
      } else {
        console.error(`You need to rename all but one of:`);
      }
      console.error(``);
      for (const duplicate of error.files) {
        console.error(` - ${chalk.cyan(duplicate.name)}`);
      }
      console.error(``);
      break;
    case 'migration_file_missing':
      console.error(
        `The migration ${chalk.cyan(
          error.appliedMigration.name,
        )} has been applied to the database but does not exist in your local migrations directory.`,
      );
      console.error(``);
      console.error(`To restore the missing file, run:`);
      console.error(``);
      console.error(
        `  ${cliName} restore-from-db -m ${error.appliedMigration.index} <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      console.error(`To ignore the missing file, run:`);
      console.error(``);
      console.error(
        `  ${cliName} ignore-error -m ${error.appliedMigration.index} -e migration_file_missing <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      console.error(
        `HINT: If you would prefer not to see this error in the future, you can pass "--ignore-error migration_file_missing"`,
      );
      console.error(``);
      break;
    case 'migration_file_edited':
      console.error(
        `The migration ${chalk.cyan(
          error.appliedMigration.name,
        )} has been applied to the database but the aplied migration does not match the file in your migrations directory.`,
      );
      console.error(``);
      console.error(`To attempt to re-apply the local migration run:`);
      console.error(``);
      console.error(
        `  ${cliName} mark-unapplied -m ${error.appliedMigration.index} <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      console.error(`Then re-run: ${cliName} apply  <MIGRATIONS_DIRECTORY>`);
      console.error(``);
      console.error(
        `To restore the original file, delete the current one then run:`,
      );
      console.error(``);
      console.error(
        `  ${cliName} restore-from-db -m ${error.appliedMigration.index} <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      console.error(`To ignore the discrepancy file, run:`);
      console.error(``);
      console.error(
        `  ${cliName} ignore-error -m ${error.appliedMigration.index} -e migration_file_edited <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      console.error(
        `HINT: If you would prefer not to see this error in the future, you can pass "--ignore-error migration_file_edited"`,
      );
      console.error(``);
      break;
    case 'migration_order_change':
      console.error(
        'You have unapplied migrations that should have been applied before migrations that have already been applied.',
      );
      console.error(``);
      for (const migration of error.unappliedMigrations) {
        console.error(` - ${chalk.cyan(migration.name)} not applied`);
      }
      for (const migration of error.appliedMigrations) {
        console.error(
          ` - ${chalk.red(
            migration.name,
          )} applied at ${migration.applied_at.toISOString()}`,
        );
      }
      console.error(``);
      console.error(
        `To apply the migrations even though they are out of order, run:`,
      );
      console.error(``);
      console.error(
        `  ${cliName} apply -e migration_order_change <MIGRATIONS_DIRECTORY>`,
      );
      console.error(``);
      break;
    case 'missing_migration':
      console.error(`Unable to find the migration with index ${error.index}`);
      break;
    case 'missing_parameter':
      console.error(`This command requires a value for: ${error.name}`);
      break;
    default:
      void assertNever(error, true);
      throw new Error('Unexpected error encountered');
  }
}
