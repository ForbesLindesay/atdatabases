import MigrationsContext from '../MigrationContext';
import Result from '../types/Result';
import {
  DuplicateMigrationFilesError,
  MigrationFileMissingError,
  MigrationFileEditedError,
  MigrationOrderChangeError,
} from '../types/MigrationError';

export type SequenceError =
  | DuplicateMigrationFilesError
  | MigrationFileMissingError
  | MigrationFileEditedError
  | MigrationOrderChangeError;
export type SequenceErrorIgnoreCode = Exclude<
  SequenceError['code'],
  'duplicate_migration_files'
>;
export default function validateMigrationsSequence(
  ctx: MigrationsContext,
  ignoredErrors: SequenceErrorIgnoreCode[] = [],
): Result<void, SequenceError> {
  // 1. Check for duplicate migrations, starting with the highest index.
  //    Starting at the highest index means you can resolve a duplicate
  //    without worrying about there being additional duplicates after
  //    this one.
  for (
    let index = Math.max(...ctx.migrationFiles.map((f) => f.index));
    index >= 0;
    index--
  ) {
    const files = ctx.migrationFiles.filter((m) => m.index === index);
    if (files.length > 1) {
      return Result.fail<DuplicateMigrationFilesError>({
        code: 'duplicate_migration_files',
        files,
      });
    }
  }

  // 2. Check for applied migrations that have been deleted or edited
  for (const appliedMigration of ctx.appliedMigrations) {
    const migrationFile = ctx.getMigrationFile(appliedMigration.index);
    if (
      !migrationFile &&
      appliedMigration.ignored_error !== 'migration_file_missing' &&
      !ignoredErrors.includes('migration_file_missing')
    ) {
      return Result.fail<MigrationFileMissingError>({
        code: 'migration_file_missing',
        appliedMigration,
      });
    }
    if (
      migrationFile &&
      migrationFile.script !== appliedMigration.script &&
      appliedMigration.ignored_error !== 'migration_file_edited' &&
      !ignoredErrors.includes('migration_file_edited')
    ) {
      return Result.fail<MigrationFileEditedError>({
        code: 'migration_file_edited',
        appliedMigration,
        migrationFile,
      });
    }
  }

  // 3. Check for migrations that will be applied out of sequence &&
  if (!ignoredErrors.includes('migration_order_change')) {
    for (const migrationFile of ctx.migrationFiles.filter(
      (m) => !ctx.hasAppliedMigration(m),
    )) {
      const unappliedMigrations = [migrationFile];
      const appliedMigrations = [];
      for (const migration of ctx.migrationFiles.filter(
        (m) => m.index > migrationFile.index,
      )) {
        const appliedMigration = ctx.getAppliedMigration(migration);
        if (appliedMigration) {
          appliedMigrations.push(appliedMigration);
        } else if (appliedMigrations.length === 0) {
          unappliedMigrations.push(migration);
        } else {
          break;
        }
      }
      if (
        appliedMigrations.some(
          (m) => m.ignored_error !== 'migration_order_change',
        )
      ) {
        return Result.fail<MigrationOrderChangeError>({
          code: 'migration_order_change',
          appliedMigrations,
          unappliedMigrations,
        });
      }
    }
  }
  return Result.ok();
}
