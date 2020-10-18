import Result from '../types/Result';
import {
  MissingMigrationError,
  MissingParameterError,
} from '../types/MigrationError';
import {Command} from '../runCommand';

export default function restoreMigrationFromDatabase(): Command<
  void,
  MissingMigrationError | MissingParameterError
> {
  return (ctx) => {
    const {applied_migration} = ctx.parameters;

    if (applied_migration === undefined) {
      return Result.fail<MissingParameterError>({
        code: 'missing_parameter',
        type: 'applied_migration',
        name: '--migration',
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

    ctx.writeMigrationFile({
      index: migration.index,
      name: migration.name,
      script: migration.script,
    });

    return Result.ok();
  };
}
