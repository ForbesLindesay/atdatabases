import Result from '../types/Result';
import {
  MissingMigrationError,
  MissingParameterError,
} from '../types/MigrationError';
import {Command} from '../runCommand';

export default function ignoreError(): Command<
  void,
  MissingMigrationError | MissingParameterError
> {
  return (ctx) => {
    const {applied_migration, error_type} = ctx.parameters;

    if (applied_migration === undefined) {
      return Result.fail<MissingParameterError>({
        code: 'missing_parameter',
        type: 'applied_migration',
        name: '--migration',
      });
    }
    if (error_type === undefined) {
      return Result.fail<MissingParameterError>({
        code: 'missing_parameter',
        type: 'error_type',
        name: '--error',
      });
    }

    const migration = ctx.appliedMigrations.find(
      (m) => m.index === applied_migration,
    );

    if (!migration) {
      return Result.fail<MissingMigrationError>({
        code: 'missing_migration',
        index: applied_migration,
      });
    }

    ctx.ignoreErrorPermanently(migration, error_type);
    return Result.ok();
  };
}
