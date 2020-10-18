import assertNever from 'assert-never';
import deepEqual = require('deep-equal');
import MigrationsContext, {sortMigrations} from '../MigrationContext';
import DatabaseEngine from '../types/DatabaseEngine';
import Result from '../types/Result';
import {
  MigrationWithNoValidExport,
  ConcurrentMigrationsError,
} from '../types/MigrationError';
import Operation from '../types/Operation';

export default async function applyOperations<TMigration>(
  ctx: MigrationsContext,
  engine: DatabaseEngine<TMigration>,
  logging: {
    beforeOperation: (
      operation: Operation,
    ) => Promise<void | 'stop' | 'rollback'>;
    afterOperation: (operation: Operation) => Promise<void>;
  },
): Promise<
  Result<void, MigrationWithNoValidExport | ConcurrentMigrationsError>
> {
  return await engine.tx(async (tx) => {
    const appliedMigrations = sortMigrations(await tx.getMigrations());
    if (!deepEqual(ctx.originalAppliedMigrations, appliedMigrations)) {
      return Result.fail({code: 'concurrent_migrations'});
    }
    const rolllbackSteps: (() => Promise<void>)[] = [];
    const rollback = async () => {
      while (rolllbackSteps.length) {
        try {
          await rolllbackSteps.pop()!();
        } catch (_ex) {
          // ignore nested error
        }
      }
    };
    try {
      for (const op of ctx.operations) {
        const before = await logging.beforeOperation(op);
        if (before === 'rollback') {
          await rollback();
          return Result.ok();
        } else if (before === 'stop') {
          return Result.ok();
        }
        switch (op.kind) {
          case 'apply':
            const migrationLoadResult = engine.directory.loadMigration(
              op.value.name,
            );

            if (!migrationLoadResult.ok) {
              await rollback();
              return migrationLoadResult;
            }
            await tx.applyMigration(migrationLoadResult.value);
            break;
          case 'applied':
            await tx.markAsApplied(op.value);
            break;
          case 'ignore_error':
            await tx.ignoreError(op.value);
            break;
          case 'obsolete':
            await tx.markAsObsolete(op.value);
            break;

          case 'write': {
            let exists = false;
            try {
              await engine.directory.read(op.value.name);
              exists = true;
            } catch (ex) {
              exists = false;
            }
            if (exists) {
              throw new Error('refusing to overwrite existing file');
            }
            await engine.directory.write(op.value.name, op.value.script);
            rolllbackSteps.push(async () => {
              await engine.directory.delete(op.value.name);
            });
            break;
          }
          case 'rename':
            await engine.directory.rename(op.value.from.name, op.value.to.name);
            rolllbackSteps.push(async () => {
              await engine.directory.rename(
                op.value.to.name,
                op.value.from.name,
              );
            });
            break;
          case 'delete': {
            const originalSource = await engine.directory.read(op.value.name);
            await engine.directory.delete(op.value.name);
            rolllbackSteps.push(async () => {
              await engine.directory.write(op.value.name, originalSource);
            });
            break;
          }
          default:
            assertNever(op);
            break;
        }
        await logging.afterOperation(op);
      }
    } catch (ex) {
      await rollback();
      throw ex;
    }
    return Result.ok();
  });
}
