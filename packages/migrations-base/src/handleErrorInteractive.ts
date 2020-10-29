import assertNever from 'assert-never';
import chalk = require('chalk');
import isInteractive = require('is-interactive');
import * as interrogator from 'interrogator';
import MigrationError from './types/MigrationError';
import Result from './types/Result';
import MigrationsContext from './MigrationContext';

// Aim is to provide interactive help for fixing:
//
// - DuplicateMigrationFilesError
// - MigrationFileMissingError
// - MigrationFileEditedError
// - MigrationOrderChangeError
export default async function handleError(
  error: MigrationError,
  ctx: MigrationsContext,
): Promise<Result<void, MigrationError>> {
  if (!isInteractive()) return Result.fail(error);
  switch (error.code) {
    case 'migration_file_missing': {
      console.error(
        `The migration ${chalk.cyan(
          error.appliedMigration.name,
        )} has been applied to the database but does not exist in your local migrations directory.`,
      );
      console.error(``);
      console.error(
        `HINT: If you would prefer not to see this error in the future, you can pass "--ignore-error migration_file_missing"`,
      );
      console.error(``);
      const result = await interrogator.list(
        'How would you like to resolve this?',
        [
          {
            value: 'restore',
            name:
              'Restore the migration on your filesystem using the migration script in the database',
            short: 'restore local file',
          },
          {
            value: 'abort',
            name: 'Abort and do not apply any new migrations',
          },
          {
            value: 'ignore_temporary',
            name: 'Ignore this migration for now',
          },
          {
            value: 'ignore_permanently',
            name: 'Ignore this migration forever',
          },
          {
            value: 'delete',
            name:
              'Delete the record of the database migration having been run (if the migration is re-added to your file system it will get re-applied and could fail)',
            short: 'delete record',
          },
        ] as const,
      );
      switch (result) {
        case 'abort':
          return Result.fail(error);
        case 'ignore_temporary':
          ctx.ignoreErrorTemporarily(error.appliedMigration, error.code);
          return Result.ok();
        case 'ignore_permanently':
          ctx.ignoreErrorPermanently(error.appliedMigration, error.code);
          return Result.ok();
        case 'restore':
          ctx.writeMigrationFile({
            index: error.appliedMigration.index,
            name: error.appliedMigration.name,
            script: error.appliedMigration.script,
          });
          return Result.ok();
        case 'delete':
          ctx.markAppliedMigrationAsObsolete(error.appliedMigration);
          return Result.ok();
      }
      return assertNever(result);
    }
    case 'migration_file_edited': {
      console.error(
        `The migration ${chalk.cyan(
          error.appliedMigration.name,
        )} has been applied to the database but the aplied migration does not match the file in your migrations directory.`,
      );
      console.error(``);
      console.error(
        `HINT: If you would prefer not to see this error in the future, you can pass "--ignore-error migration_file_edited"`,
      );
      console.error(``);
      const result = await interrogator.list(
        'How would you like to resolve this?',
        [
          {
            value: 'delete',
            name:
              'Attempt to reapply the migration that is on your local filesystem',
          },
          {
            value: 'abort',
            name: 'Abort and do not apply any new migrations',
          },
          {
            value: 'ignore_temporary',
            name: 'Ignore this migration for now',
          },
          {
            value: 'ignore_permanently',
            name: 'Ignore this migration forever',
          },
          {
            value: 'restore',
            name:
              'Restore the migration on your filesystem using the migration script in the database',
            short: 'restore local file',
          },
        ] as const,
      );
      switch (result) {
        case 'abort':
          return Result.fail(error);
        case 'ignore_temporary':
          ctx.ignoreErrorTemporarily(error.appliedMigration, error.code);
          return Result.ok();
        case 'ignore_permanently':
          ctx.ignoreErrorPermanently(error.appliedMigration, error.code);
          return Result.ok();
        case 'restore':
          ctx.deleteMigrationFile(error.migrationFile);
          ctx.writeMigrationFile({
            index: error.appliedMigration.index,
            name: error.appliedMigration.name,
            script: error.appliedMigration.script,
          });
          return Result.ok();
        case 'delete':
          ctx.markAppliedMigrationAsObsolete(error.appliedMigration);
          return Result.ok();
      }
      return assertNever(result);
    }
    case 'migration_order_change': {
      console.error(
        'You have unapplied migrations that should have been applied before migrations that have already been applied.',
      );
      console.error(``);
      let appliedCount = 0;
      let foundUnapplied;
      for (const migration of ctx.migrationFiles) {
        const applied = ctx.getAppliedMigration(migration);
        if (applied) {
          appliedCount++;
        } else if (!foundUnapplied) {
          if (appliedCount) {
            console.error(`...${appliedCount} applied migrations...`);
          }
          foundUnapplied = true;
        }
        if (foundUnapplied) {
          if (applied) {
            console.error(
              ` - ${chalk.red(
                applied.name,
              )} applied at ${applied.applied_at.toISOString()}`,
            );
          } else {
            console.error(` - ${chalk.cyan(migration.name)} not applied`);
          }
        }
      }
      console.error(``);
      console.error(
        `HINT: If you would prefer not to see this error in the future, you can pass "--ignore-error migration_order_change"`,
      );
      console.error(``);
      const result = await interrogator.list(
        'How would you like to resolve this?',
        [
          {
            value: 'ignore_temporary',
            name:
              'Apply the migrations that have not yet been applied, even though they may be out of order',
          },
          {
            value: 'abort',
            name: 'Abort and do not apply any new migrations',
          },
        ] as const,
      );
      switch (result) {
        case 'abort':
          return Result.fail(error);
        case 'ignore_temporary':
          for (const appliedMigration of error.appliedMigrations) {
            ctx.ignoreErrorTemporarily(appliedMigration, error.code);
          }
          return Result.ok();
      }
      return assertNever(result);
    }
  }
  return Result.fail(error);
}
