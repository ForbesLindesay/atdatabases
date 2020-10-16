import Result from '../types/Result';
import {
  MissingMigrationError,
  MissingParameterError,
} from '../types/MigrationError';
import {Command} from '../runCommand';

export default function markMigrationAsApplied(): Command<
  void,
  MissingMigrationError | MissingParameterError
> {
  return (ctx) => {
    const {migration_file} = ctx.parameters;

    if (migration_file === undefined) {
      return Result.fail<MissingParameterError>({
        code: 'missing_parameter',
        type: 'migration_file',
        name: '--migration',
      });
    }

    const migration = ctx.migrationFiles.find(
      (m) => m.index === migration_file,
    );

    if (!migration) {
      return Result.fail<MissingMigrationError>({
        code: 'missing_migration',
        index: migration_file,
      });
    }

    ctx.markMigrationAsApplied({
      index: migration.index,
      name: migration.name,
      script: migration.script,
    });

    return Result.ok();
  };
}
