import validateMigrationsSequence from '../methods/validateMigrationsSequence';
import Result from '../types/Result';
import {
  DuplicateMigrationFilesError,
  MigrationFileMissingError,
  MigrationFileEditedError,
  MigrationOrderChangeError,
} from '../types/MigrationError';
import {Command} from '../runCommand';

export default function applyMigrations(): Command<
  void,
  | DuplicateMigrationFilesError
  | MigrationFileMissingError
  | MigrationFileEditedError
  | MigrationOrderChangeError
> {
  return (ctx) => {
    const {ignored_errors = []} = ctx.parameters;
    const sequenceValidationResult = validateMigrationsSequence(
      ctx,
      ignored_errors,
    );
    if (!sequenceValidationResult.ok) {
      return sequenceValidationResult;
    }
    for (const migration of ctx.migrationFiles) {
      if (!ctx.hasAppliedMigration(migration)) {
        ctx.applyMigration(migration);
        ctx.markMigrationAsApplied(migration);
        if (ctx.parameters.commit_after_each_migration) {
          ctx.commit();
        }
      }
    }
    return Result.ok();
  };
}
